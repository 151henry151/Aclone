// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { landscapeSchema } from '../src/shared/landscape.ts';
import { growRoads } from '../src/shared/roads.ts';
import { townRoads, roadDistance, type Road } from '../src/shared/town.ts';
import {
  roadComponents,
  roadSamples,
  roadSite,
  roadRoute,
  pointDistance,
} from '../src/shared/road-routing.ts';
import { planRoadDetour } from '../src/shared/road-projects.ts';
function world() {
  const w = createWorld('puddlewick', 'Road tests', 'server');
  w.creator = creatorSchema.parse({ roads: false });
  w.landscape = landscapeSchema.parse({ heightmap: Array(33 * 33).fill(10) });
  w.buildings = [];
  w.towns = [{ ...w.towns[0], x: 0, z: 0 }];
  w.roads = [{ a: { x: -30, z: 0 }, b: { x: 30, z: 0 }, width: 5 }];
  return w;
}
function day(w: ReturnType<typeof world>) {
  const from = (w.roadGrowth ?? 0) * w.settings.dayLength;
  const before = (w.roads ?? []).reduce((n, r) => n + pointDistance(r.a, r.b), 0);
  growRoads(w, from, from + w.settings.dayLength);
  const after = (w.roads ?? []).reduce((n, r) => n + pointDistance(r.a, r.b), 0);
  assert.ok(after - before <= 12.000001, 'all crews share the 12 m daily budget');
}
function assertClear(w: ReturnType<typeof world>, roads: readonly Road[]) {
  for (const r of roads) {
    const site = roadSite(w, r.width);
    assert.ok(roadSamples(r, 0.5).every(site.clear), `road obstructed: ${JSON.stringify(r)}`);
  }
}
test('remote town connects from both ends, persists mid-work, then stops growing', () => {
  let w = world();
  w.towns.push({
    ...structuredClone(w.towns[0]),
    id: 'remote',
    name: "Mabel's Reach",
    x: 420,
    z: 80,
    radius: 50,
  });
  w.buildings.push(makeBuilding('centre', 'town', 420, 80));
  day(w);
  assert.equal(w.roadProject?.kind, 'town');
  assert.equal(w.roads!.length, 3);
  assert.ok(roadDistance([w.roads![2]], 420, 80) < 24, 'remote town lays its end too');
  assert.equal(roadComponents(townRoads(w)).length, 2, 'not connected prematurely');
  w = JSON.parse(JSON.stringify(w));
  for (let i = 0; i < 80 && (w.roadProject || roadComponents(townRoads(w)).length > 1); i++) day(w);
  assert.equal(w.roadProject, undefined);
  assert.equal(roadComponents(townRoads(w)).length, 1);
  assertClear(w, townRoads(w));
  assert.ok(w.roads!.length <= 40, 'curving country road stays compact across daily growth');
  const length = w.roads!.length;
  for (let i = 0; i < 5; i++) day(w);
  assert.equal(w.roads!.length, length, 'no duplicate inter-town road');
});
test('a remote town with its own private lanes still connects to the original network', () => {
  const w = world();
  w.towns.push({ ...structuredClone(w.towns[0]), id: 'remote', x: 300, z: 0, radius: 50 });
  w.roads!.push({ a: { x: 280, z: 0 }, b: { x: 320, z: 0 }, width: 5 });
  for (let i = 0; i < 30; i++) day(w);
  assert.equal(roadComponents(townRoads(w)).length, 1);
});
test('blocked existing roads develop a connected bypass around rotated buildings and all farm plots', () => {
  for (const kind of ['warehouse', 'farm']) {
    let w = world();
    w.towns = [];
    w.roads = Array.from({ length: 12 }, (_, i) => ({
      a: { x: -60 + i * 10, z: 0 },
      b: { x: -50 + i * 10, z: 0 },
      width: 5,
    }));
    const building = makeBuilding(
      'obstacle',
      kind,
      kind === 'farm' ? -20 : 0,
      kind === 'farm' ? -12 : 0,
    );
    building.rotation = kind === 'farm' ? 0 : 0.65;
    if (kind === 'farm') building.farmPlots = 8;
    w.buildings.push(building);
    assert.ok(planRoadDetour(w), kind + ' gets a bypass plan');
    const initial = w.roads.length;
    day(w);
    assert.equal(w.retiredRoads?.length ?? 0, 0, 'keep original road until bypass completes');
    w = JSON.parse(JSON.stringify(w));
    for (let i = 0; i < 80 && (!w.retiredRoads?.length || w.roadProject); i++) day(w);
    assert.ok(w.retiredRoads?.length, kind + ' original section retired');
    assert.ok(w.roads!.length > initial);
    assertClear(w, townRoads(w));
    assert.equal(roadComponents(townRoads(w)).length, 1, 'both ends still connected');
    const n = w.roads!.length;
    for (let i = 0; i < 5; i++) day(w);
    assert.equal(w.roads!.length, n, 'bypass is not repeated');
  }
});
test('a blocked junction keeps every approach connected after replacement', () => {
  const w = world();
  w.towns = [];
  w.roads = [
    { a: { x: -40, z: 0 }, b: { x: 0, z: 0 }, width: 5 },
    { a: { x: 0, z: 0 }, b: { x: 40, z: 0 }, width: 5 },
    { a: { x: 0, z: 0 }, b: { x: 0, z: 40 }, width: 5 },
  ];
  w.buildings.push(makeBuilding('obstacle', 'home', 0, 0));
  for (let i = 0; i < 50; i++) day(w);
  assertClear(w, townRoads(w));
  assert.equal(roadComponents(townRoads(w)).length, 1);
  for (const p of [
    { x: -40, z: 0 },
    { x: 40, z: 0 },
    { x: 0, z: 40 },
  ])
    assert.ok(roadDistance(townRoads(w), p.x, p.z) <= 0);
});
test('road planning respects water, map boundaries and disabled town roads', () => {
  const w = world();
  assert.equal(roadRoute(w, { x: 0, z: 0 }, { x: 7000, z: 0 }), undefined);
  w.settings.seaLevel = 12;
  assert.equal(roadRoute(w, { x: 0, z: 0 }, { x: 100, z: 0 }), undefined);
  w.settings.seaLevel = -2;
  w.towns[0].permissions.residents.roads = false;
  w.towns[0].permissions.guests.roads = false;
  assert.equal(roadRoute(w, { x: 0, z: 0 }, { x: 100, z: 0 }), undefined);
});
test('a newly obstructed planned route replans without laying through the obstruction', () => {
  const w = world();
  w.towns.push({ ...structuredClone(w.towns[0]), id: 'remote', x: 300, z: 0, radius: 30 });
  day(w);
  w.buildings.push(makeBuilding('new-wall', 'warehouse', 120, 0));
  for (let i = 0; i < 60; i++) day(w);
  assert.equal(roadComponents(townRoads(w)).length, 1);
  assertClear(w, townRoads(w));
});

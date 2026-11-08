// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { townRoads } from '../src/shared/town';
import { effectivePavement } from '../src/shared/city-paving';
import { roadSite, roadRouteSteps } from '../src/shared/road-routing';
import { finishRoadWork } from '../src/shared/road-work';
import { bridgeRoads } from '../src/shared/bridge-network';
import { growPavedTrunkSteps } from '../src/shared/city-trunks';

test('completed public bridges join ordinary and paved graphs; unfinished, closed and removed ones do not', () => {
  const { w, bridge } = completedBridgeSite();
  const old = structuredClone(w.roads);
  const edges = bridgeRoads(w);
  assert.equal(edges.length, 3, 'two approaches and the clear span');
  assert.ok(edges.every((e) => townRoads(w).includes(e)));
  assert.ok(
    edges.every((e) =>
      effectivePavement(w).some((r) => r.bridge === e.bridge && r.a.x === e.a.x && r.a.z === e.a.z),
    ),
  );
  assert.deepEqual(w.roads, old, 'retain all established dirt geometry');
  const stable = townRoads(w);
  assert.equal(townRoads(w), stable, 'unchanged queries reuse their road graph');
  bridge.condition = 0;
  assert.equal(bridgeRoads(w).length, 0);
  assert.equal(townRoads(w).length, old!.length);
  bridge.condition = 100;
  delete bridge.completedAt;
  assert.equal(bridgeRoads(w).length, 0);
  bridge.completedAt = w.time;
  w.settings.bridgePublicAccess = false;
  assert.equal(
    bridgeRoads(w).length,
    0,
    'public routing cannot lead residents into an owner-only crossing',
  );
  w.settings.bridgePublicAccess = true;
  w.bridges = [];
  assert.equal(effectivePavement(w).length, w.pavedRoads!.length);
});

test('a dry road route crosses the elevated deck through its anchors and refuses a sideways shortcut', () => {
  const { w, bridge, point } = completedBridgeSite();
  w.settings.roadFords = false;
  const site = roadSite(w, 5);
  assert.equal(site.segment(bridge.approachA, bridge.approachB), true);
  assert.equal(site.segment(point(0, -20), point(0, 20)), false);
  const path = finishRoadWork(roadRouteSteps(w, point(-180, 45), point(180, 45), 5));
  assert.ok(
    path && path.length > 2,
    'detour to the actual bridge rather than crossing the river directly',
  );
  for (let i = 1; i < path.length; i++) assert.ok(site.segment(path[i - 1], path[i]));
});

test('city trunks choose a completed bridge away from the direct crossing while retaining old dirt roads', () => {
  const { w, bridge, point } = completedBridgeSite();
  w.settings.roadFords = false;
  const start = point(-180, 45),
    goal = point(180, 45);
  w.towns[0] = { ...w.towns[0], ...point(-220, 45), radius: 40 };
  w.towns[1] = { ...w.towns[1], ...goal, radius: 40 };
  w.roads = [
    { a: point(-220, 45), b: start, width: 5 },
    { a: goal, b: point(200, 45), width: 5 },
  ];
  w.pavedRoads = w.roads.map((r, i) => ({ ...r, town: w.towns[i].id, kind: 'urban' }));
  const original = structuredClone(w.roads);
  const used = finishRoadWork(growPavedTrunkSteps(w, w.towns[0], [w.pavedRoads[0]], 1500));
  assert.ok(used > 0);
  assert.ok(!w.pavingProjects?.[w.towns[0].id]?.waitingForBridge);
  assert.deepEqual(w.roads.slice(0, original.length), original);
  assert.ok(effectivePavement(w).some((r) => r.bridge === bridge.id));
  const site = roadSite(w, 5);
  for (const r of w.pavedRoads)
    assert.ok(site.segment(r.a, r.b), 'new trunk stays dry or supported');
});

test('repeated road queries reuse bridge geometry without serializing it again', () => {
  const { w, bridge } = completedBridgeSite();
  let serialized = 0;
  Object.defineProperty(bridge.a, 'toJSON', {
    value() {
      serialized++;
      return { x: this.x, z: this.z };
    },
  });
  const roads = bridgeRoads(w);
  serialized = 0;
  for (let i = 0; i < 1000; i++) assert.equal(bridgeRoads(w), roads);
  assert.equal(serialized, 0, 'scenery and movement repeatedly query the same bridge roads');
});

test('a standalone bridge is a crossing option, not a destination for unrelated public road growth', async () => {
  const { planRoadConnectionSteps } = await import('../src/shared/road-projects');
  const { w, point } = completedBridgeSite();
  w.roads = [{ a: point(-200), b: point(-150), width: 5 }];
  w.towns = [{ ...w.towns[0], ...point(-200) }];
  assert.equal(finishRoadWork(planRoadConnectionSteps(w)), undefined);
});

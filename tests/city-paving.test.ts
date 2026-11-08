// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { landscapeSchema } from '../src/shared/landscape';
import * as roads from '../src/shared/roads';
import type { World } from '../src/shared/types';

function settlement() {
  const w = createWorld('city-paving', 'City paving', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  w.buildings = [];
  w.players = {};
  w.zones = [];
  w.terrain = [];
  delete w.airfield;
  delete w.spaceportSite;
  Object.assign(w.settings, { seaLevel: -10, mapSize: 2000 });
  w.towns = [{ ...w.towns[0], x: 0, z: 0, radius: 200, residents: [] }];
  const p = addPlayer(w, 'owner', 'Resident');
  const home = makeBuilding('home', 'home', 0, 30);
  home.owner = p.id;
  p.home = home.id;
  const shop = makeBuilding('shop', 'market', 30, 30);
  shop.owner = p.id;
  const publicHall = makeBuilding('hall', 'town', -30, 30);
  publicHall.government = true;
  w.buildings = [home, shop, publicHall];
  w.towns[0].residents = [p.id];
  Object.assign(w.settings, {
    cityBuildings: 3,
    cityBusinesses: 1,
    cityResidents: 1,
    cityQualificationDays: 3,
    cityDemotionDays: 2,
    cityRetentionFraction: 0.8,
    cityPaving: true,
    cityPavingPerDay: 1,
  });
  return w;
}
// Use the existing daily entry point so passing tests require production integration.
function day(w: World) {
  const start = w.time;
  w.time += w.settings.dayLength;
  roads.growRoads(w, start, w.time);
  const limit = performance.now() + 2000;
  while (
    (w.roadGrowthDue !== undefined || (w as any).pavingDue !== undefined) &&
    performance.now() < limit
  )
    roads.growRoads(w, w.time, w.time);
  assert.equal((w as any).pavingDue, undefined, 'finish bounded daily paving work');
}
function city(w: World) {
  return (w as any).cityDevelopment?.[w.towns[0].id];
}
test('city qualification waits for sustained development and survives restart', () => {
  let w = settlement();
  day(w);
  assert.ok(city(w), 'daily road work assesses city development');
  assert.equal(city(w).qualified, false);
  assert.deepEqual(city(w).counts, { buildings: 3, businesses: 1, residents: 1 });
  day(w);
  assert.equal(city(w).qualified, false);
  w = JSON.parse(JSON.stringify(w));
  day(w);
  assert.equal(city(w).qualified, true);
});
test('temporary shrinkage retains status; sustained shrinkage demotes without erasing roads', () => {
  const w = settlement();
  for (let i = 0; i < 3; i++) day(w);
  assert.equal(city(w)?.qualified, true);
  w.buildings = w.buildings.filter((b) => b.kind !== 'market');
  day(w);
  assert.equal(city(w).qualified, true);
  day(w);
  assert.equal(city(w).qualified, false);
});
test('building counts ignore unfinished premises, empty houses and missing owners; residents deduplicate', () => {
  const w = settlement();
  for (const [id, kind, owner, construction] of [
    ['empty', 'home', 'owner', undefined],
    ['unfinished', 'market', 'owner', { wood: 1 }],
    ['abandoned', 'market', 'missing', undefined],
  ] as const) {
    const b = makeBuilding(id, kind, 60, 30);
    Object.assign(b, { owner, construction, government: false });
    w.buildings.push(b);
  }
  day(w);
  assert.deepEqual(city(w)?.counts, { buildings: 3, businesses: 1, residents: 1 });
});
test('a gap resets qualification; a changed policy starts a fresh observation period', () => {
  const w = settlement();
  day(w);
  const shop = w.buildings.pop()!;
  day(w);
  w.buildings.push(shop);
  day(w);
  assert.equal(city(w)?.qualified, false);
  Object.assign(w.settings, { cityBuildings: 2 });
  day(w);
  day(w);
  assert.equal(city(w)?.qualified, false);
  day(w);
  assert.equal(city(w)?.qualified, true);
});
function streets() {
  const w = settlement();
  Object.assign(w.settings, {
    cityQualificationDays: 1,
    cityDensityDays: 2,
    cityDensityBuildings: 4,
    cityDensityRadius: 60,
    cityDensitySampleSpacing: 10,
    roadGrowthPerDay: 0,
  });
  w.roads = [
    { a: { x: 0, z: 0 }, b: { x: 180, z: 0 }, width: 5 },
    { a: { x: 0, z: 0 }, b: { x: 0, z: -180 }, width: 5 },
  ];
  w.buildings = w.buildings.filter((b) => b.kind === 'home');
  for (const x of [0, 30, 60, 90, 120, 150])
    for (const z of [-30, 30]) {
      const b = makeBuilding(`shop-${x}-${z}`, 'market', x, z);
      b.owner = 'owner';
      b.government = false;
      w.buildings.push(b);
    }
  const farm = makeBuilding('remote-farm', 'farm', 30, -160);
  farm.owner = 'owner';
  farm.government = false;
  w.buildings.push(farm);
  return w;
}
function paved(
  w: World,
): { a: { x: number; z: number }; b: { x: number; z: number }; width: number }[] {
  return (w as any).pavedRoads ?? [];
}
function pavedLength(w: World) {
  return paved(w).reduce((n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), 0);
}
test('sustained density paves outward at the configured budget while the farm lane stays dirt', () => {
  let w = streets();
  day(w);
  assert.equal(pavedLength(w), 0);
  day(w);
  assert.equal(pavedLength(w), 1, 'density qualification starts real pavement');
  assert.ok(
    paved(w).every((r) => r.a.z === 0 && r.b.z === 0),
    'prefer the denser east corridor',
  );
  for (let i = 0; i < 19; i++) day(w);
  assert.equal(pavedLength(w), 20);
  w = JSON.parse(JSON.stringify(w));
  day(w);
  assert.equal(pavedLength(w), 21, 'restart resumes rather than duplicating an allowance');
  roads.growRoads(w, w.time, w.time);
  assert.equal(pavedLength(w), 21);
  Object.assign(w.settings, { cityPavingPerDay: 100 });
  for (let i = 0; i < 6; i++) day(w);
  assert.ok(
    paved(w).some((r) => r.b.x >= 150),
    'dense street eventually paves',
  );
  assert.ok(
    paved(w).every((r) => Math.min(r.a.z, r.b.z) > -100),
    'sparse access stays dirt inside city',
  );
  assert.equal(w.roads?.length, 2, 'paving preserves original roads');
});
test('density loss, paused paving and no city cannot add pavement or delete existing work', () => {
  const w = streets();
  day(w);
  day(w);
  assert.equal(pavedLength(w), 1);
  Object.assign(w.settings, { cityPaving: false });
  day(w);
  assert.equal(pavedLength(w), 1);
  Object.assign(w.settings, { cityPaving: true });
  w.buildings = w.buildings.filter((b) => b.kind === 'home');
  for (let i = 0; i < 5; i++) day(w);
  assert.equal(pavedLength(w), 1);
  const empty = streets();
  Object.assign(empty.settings, { cityBuildings: 999 });
  for (let i = 0; i < 5; i++) day(empty);
  assert.equal(pavedLength(empty), 0);
});
test('an isolated dense cluster beyond a sparse corridor cannot leapfrog to pavement', () => {
  const w = streets();
  for (const b of w.buildings) if (b.kind === 'market') b.x += 120;
  Object.assign(w.settings, { cityPavingPerDay: 100 });
  for (let i = 0; i < 5; i++) day(w);
  assert.equal(pavedLength(w), 0);
});
test('initial catch-up cannot invent years of city qualification and a paused clock does not accrue it', () => {
  const w = settlement();
  roads.growRoads(w, 0, 600000);
  assert.equal(city(w)?.qualified, false);
  Object.assign(w.settings, { dayLength: 0 });
  roads.growRoads(w, 600000, 900000);
  assert.equal(city(w)?.qualified, false);
});
test('a yielding paving job publishes its daily allowance atomically and restarts safely after edits', async (t) => {
  const w = streets();
  Object.assign(w.settings, { cityDensityDays: 1, cityPavingPerDay: 100 });
  let clock = 0;
  t.mock.method(performance, 'now', () => (clock += 10));
  w.time += w.settings.dayLength;
  roads.growRoads(w, 0, w.time);
  let calls = 0;
  while ((w as any).pavingDue !== undefined && ++calls < 10000) {
    assert.equal(
      pavedLength(w),
      0,
      'unfinished job must not publish pavement without charging its day',
    );
    if (calls === 80) w.buildings.push(makeBuilding('edit', 'home', 300, 300));
    roads.growRoads(w, w.time, w.time);
  }
  assert.ok(calls < 10000);
  assert.equal(pavedLength(w), 100);
});
test('a day-length edit cannot freeze city qualification at the old day number', () => {
  const w = settlement();
  day(w);
  Object.assign(w.settings, { dayLength: w.settings.dayLength * 10 });
  day(w);
  day(w);
  assert.equal(city(w)?.qualified, false);
  day(w);
  assert.equal(city(w)?.qualified, true);
});
function twoCities() {
  const w = streets();
  w.towns[0].radius = 100;
  Object.assign(w.settings, {
    cityDensityDays: 1,
    cityPavingPerDay: 100,
    cityBusinesses: 0,
    cityResidents: 0,
  });
  const next = {
    ...structuredClone(w.towns[0]),
    id: 'east-city',
    name: 'East city',
    x: 600,
    residents: [],
  };
  w.towns.push(next);
  for (const x of [540, 570, 600, 630, 660])
    for (const z of [-30, 30]) {
      const b = makeBuilding(`east-${x}-${z}`, 'market', x, z);
      b.owner = 'owner';
      b.government = false;
      w.buildings.push(b);
    }
  w.roads!.push({ a: { x: 180, z: 0 }, b: { x: 700, z: 0 }, width: 5 });
  return w;
}
test('one connected city exit enables a trunk without paving every rural lane', () => {
  const w = twoCities();
  for (let i = 0; i < 8; i++) day(w);
  assert.ok(
    paved(w).some((r) => r.a.x > 200 || r.b.x > 200),
    'paved trunk leaves the first city',
  );
  assert.ok((w as any).pavedRoads?.some((r: any) => r.kind === 'trunk'));
  assert.ok(
    paved(w).every((r) => Math.min(r.a.z, r.b.z) > -100),
    'rural branch stays dirt',
  );
});
test('a small town and a disconnected boundary pavement patch cannot unlock a trunk', () => {
  const w = twoCities();
  w.buildings = w.buildings.filter((b) => b.x < 500);
  for (let i = 0; i < 5; i++) day(w);
  assert.ok(!(w as any).pavedRoads?.some((r: any) => r.kind === 'trunk'));
  const isolated = twoCities();
  for (const b of isolated.buildings) if (b.x < 500 && b.kind === 'market') b.x = 150;
  for (const z of [50, 75]) {
    const b = makeBuilding('retained-' + z, 'market', 0, z);
    b.owner = 'owner';
    b.government = false;
    isolated.buildings.push(b);
  }
  (isolated as any).pavedRoads = [
    {
      a: { x: 95, z: 0 },
      b: { x: 100, z: 0 },
      width: 5,
      town: isolated.towns[0].id,
      kind: 'urban',
    },
  ];
  for (let i = 0; i < 4; i++) day(isolated);
  assert.equal(
    city(isolated).qualified,
    true,
    'origin stays a city while its exit is disconnected',
  );
  assert.ok(
    !(isolated as any).pavedRoads.some(
      (r: any) => r.kind === 'trunk' && r.town === isolated.towns[0].id,
    ),
  );
});
test('city rules validate, round-trip through designs and explain their current settings', async () => {
  const { act } = await import('../src/shared/simulation');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { roadRules } = await import('../src/shared/road-rules');
  const w = settlement();
  const patch = {
    cityPaving: false,
    cityBuildings: 95,
    cityBusinesses: 45,
    cityResidents: 40,
    cityQualificationDays: 40,
    cityDemotionDays: 20,
    cityRetentionFraction: 0.7,
    cityPavingPerDay: 0.5,
    cityDensityRadius: 70,
    cityDensityBuildings: 6,
    cityDensityDays: 45,
    cityDensitySampleSpacing: 8,
  };
  act(w, 'owner', { type: 'settings', patch });
  const target = createWorld('target', 'Target', 'owner');
  applyDesign(target, exportDesign(w));
  for (const [key, value] of Object.entries(patch)) {
    assert.equal((roadRules(target.settings) as any)[key], value);
    assert.ok(settingsFields(w.settings).includes(`name="${key}"`));
  }
  const before = JSON.stringify(w.settings);
  for (const patch of [
    { cityBuildings: 1.5 },
    { cityDensityBuildings: 0 },
    { cityPaving: 1 },
    { cityPavingPerDay: -1 },
    { cityRetentionFraction: 2 },
    { cityDensityRadius: Infinity },
  ]) {
    assert.throws(() => act(w, 'owner', { type: 'settings', patch }));
    assert.equal(JSON.stringify(w.settings), before);
  }
  assert.match(rulesSummary(w), /City paving off/);
  for (const value of ['95', '45', '40', '20', '70%', '0.5', '70 m', '6', '8 m'])
    assert.ok(rulesSummary(w).includes(value), value);
});
test('portable designs preserve actual dirt and paved geometry, with fresh settlement qualification', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { effectivePavement } = await import('../src/shared/city-paving');
  const w = streets();
  day(w);
  day(w);
  assert.equal(pavedLength(w), 1);
  const imported = createWorld('imported', 'Imported', 'owner');
  applyDesign(imported, exportDesign(w));
  assert.deepEqual(imported.roads, w.roads);
  assert.deepEqual(effectivePavement(imported), effectivePavement(w));
  assert.equal(imported.cityDevelopment, undefined, 'import does not invent qualified residents');
});
test('town panel states city progress, paving pauses and a missing bridge', async () => {
  const { townPanel } = await import('../src/client/town-panel');
  const w = settlement(),
    hall = w.buildings.find((b) => b.kind === 'town')!;
  w.towns[0].plinth = hall.id;
  day(w);
  let html = townPanel(w, w.players.owner, hall);
  assert.match(html, /City qualification/);
  assert.match(html, /1\/3/);
  day(w);
  day(w);
  html = townPanel(w, w.players.owner, hall);
  assert.match(html, /City of/);
  Object.assign(w.settings, { cityPaving: false });
  html = townPanel(w, w.players.owner, hall);
  assert.match(html, /Paving paused/);
  w.pavingProjects = {
    [w.towns[0].id]: {
      destination: 'east',
      goal: { x: 200, z: 0 },
      path: [{ x: 100, z: 0 }],
      width: 5,
      waitingForBridge: { near: { x: 100, z: 0 }, far: { x: 150, z: 0 } },
    },
  };
  html = townPanel(w, w.players.owner, hall);
  assert.match(html, /Awaiting a bridge/);
});
test('public snapshots omit private paving work tables and expose concise progress', async () => {
  const { prepareFrame } = await import('../src/server/snapshots');
  const w = streets();
  day(w);
  day(w);
  w.pavingProjects = {
    [w.towns[0].id]: {
      destination: 'east',
      goal: { x: 200, z: 0 },
      path: [
        { x: 100, z: 0 },
        { x: 130, z: 0 },
      ],
      width: 5,
      waitingForBridge: { near: { x: 130, z: 0 }, far: { x: 180, z: 0 } },
    },
  };
  const fields = prepareFrame(w).fields;
  for (const key of ['pavingEligibility', 'pavingProjects', 'pavingFeeders', 'pavingPolicy'])
    assert.equal(fields[key], undefined, key + ' stays server-side');
  const status = JSON.parse(fields.pavingStatus)[w.towns[0].id];
  assert.equal(status.metresRemaining, 30);
  assert.equal(status.waitingForBridge.near.x, 130);
});
test('pavement queries retain cache identity and remove overlays of retired or edited roads', async () => {
  const { effectivePavement } = await import('../src/shared/city-paving');
  const { roadKey } = await import('../src/shared/town');
  const w = streets();
  day(w);
  day(w);
  const initial = effectivePavement(w);
  assert.equal(initial.length, 1);
  assert.equal(effectivePavement(w), initial, 'stable snapshots do not redraw roads each frame');
  w.retiredRoads = [roadKey(w.roads![0])];
  assert.equal(effectivePavement(w).length, 0);
  w.retiredRoads = [];
  assert.equal(effectivePavement(w).length, 1);
  w.roads![0].b.x += 1;
  assert.equal(effectivePavement(w).length, 0);
});
test('an uninhabited public house is not an occupied building', () => {
  const w = settlement(),
    home = makeBuilding('vacant-public', 'home', 60, 60);
  home.government = true;
  w.buildings.push(home);
  day(w);
  assert.equal(city(w)?.counts.buildings, 3);
});
test('designs preserve the starter-road layout underlying pavement', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { townRoads, roadKey } = await import('../src/shared/town');
  const { effectivePavement } = await import('../src/shared/city-paving');
  const w = createWorld('legacy', 'Legacy', 'owner');
  w.townLayout = 1;
  const road = townRoads(w)[0];
  w.pavedRoads = [{ ...road, town: w.towns[0].id, source: roadKey(road), kind: 'urban' }];
  const target = createWorld('target', 'Target', 'owner');
  applyDesign(target, exportDesign(w));
  assert.deepEqual(effectivePavement(target), w.pavedRoads);
});
test('paving turns through a real crossing midway along both narrow roads', () => {
  const w = streets();
  w.roads = [
    { a: { x: 0, z: 0 }, b: { x: 80, z: 0 }, width: 2 },
    { a: { x: 15, z: -95 }, b: { x: 15, z: 95 }, width: 2 },
  ];
  w.buildings = [];
  for (const x of [-20, 45])
    for (const z of [-60, -30, 30, 60]) {
      const b = makeBuilding(`cross-${x}-${z}`, 'market', x, z);
      b.owner = 'owner';
      b.government = false;
      w.buildings.push(b);
    }
  Object.assign(w.settings, { cityResidents: 0, cityDensityDays: 1, cityPavingPerDay: 100 });
  for (let i = 0; i < 4; i++) day(w);
  assert.ok(paved(w).some((r) => r.a.x === 15 && Math.max(Math.abs(r.a.z), Math.abs(r.b.z)) > 30));
});
test('slow trunk growth compacts collinear segments and follows explicit road retirement', async () => {
  const { growPavedTrunkSteps } = await import('../src/shared/city-trunks');
  const { finishRoadWork } = await import('../src/shared/road-work');
  const { effectivePavement } = await import('../src/shared/city-paving');
  const { roadKey } = await import('../src/shared/town');
  const w = twoCities();
  day(w);
  w.pavingProjects = {
    [w.towns[0].id]: {
      destination: 'east-city',
      goal: { x: 600, z: 0 },
      width: 5,
      path: [
        { x: 100, z: 0 },
        { x: 600, z: 0 },
      ],
    },
  };
  const connected = [{ a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, width: 5 }],
    before = w.roads!.length;
  for (let i = 0; i < 30; i++) finishRoadWork(growPavedTrunkSteps(w, w.towns[0], connected, 1));
  assert.ok(w.roads!.length - before <= 1, 'one metre per day must not create a segment per metre');
  const newRoad = w.roads!.at(-1)!;
  w.retiredRoads = [roadKey(newRoad)];
  assert.ok(!effectivePavement(w).some((r) => r.kind === 'trunk'));
});
test('the location header follows city qualification and demotion', async () => {
  const { townLocation } = await import('../src/client/town-panel');
  const w = settlement(),
    town = w.towns[0];
  assert.equal(townLocation(w, town), `In the town of ${town.name}`);
  for (let i = 0; i < 3; i++) day(w);
  assert.equal(townLocation(w, town), `In the city of ${town.name}`);
  assert.equal(townLocation(w, { x: 300, z: 0 }), `Closest city is ${town.name}`);
  w.buildings = [];
  day(w);
  day(w);
  assert.equal(townLocation(w, town), `In the town of ${town.name}`);
});
test('moving a destination invalidates a trunk aimed at its old site', async () => {
  const { growPavedTrunkSteps } = await import('../src/shared/city-trunks');
  const { finishRoadWork } = await import('../src/shared/road-work');
  const w = twoCities();
  day(w);
  const town = w.towns[0],
    target = w.towns[1];
  w.pavingProjects = {
    [town.id]: {
      destination: target.id,
      goal: { x: 600, z: 0 },
      width: 5,
      path: [
        { x: 100, z: 0 },
        { x: 600, z: 0 },
      ],
    },
  };
  target.z = 600;
  const before = pavedLength(w);
  finishRoadWork(
    growPavedTrunkSteps(w, town, [{ a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, width: 5 }], 1),
  );
  assert.equal(pavedLength(w), before, 'do not build toward the abandoned city site');
  assert.equal(w.pavingProjects[town.id], undefined);
});
test('flooded or blocked centre pavement never unlocks a disconnected trunk', () => {
  for (const obstacle of ['flood', 'building']) {
    const w = twoCities();
    day(w);
    // Keep the eastern settlement qualified but unable to pave its own exit.
    w.settings.cityDensityBuildings = 1000;
    const town = w.towns[0];
    w.pavedRoads = [
      { a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, width: 5, town: town.id, kind: 'urban' },
    ];
    if (obstacle === 'flood') w.terrain.push({ x: 50, z: 0, radius: 20, height: -100 });
    else w.buildings.push(makeBuilding('new-obstacle', 'warehouse', 50, 0));
    const old = JSON.stringify(w.pavedRoads);
    day(w);
    assert.ok(
      !w.pavedRoads.some((r) => r.kind === 'trunk'),
      obstacle + ' breaks paved connectivity',
    );
    assert.equal(JSON.stringify(w.pavedRoads), old, 'preserve existing surface history');
  }
});
test('a bridge-waiting plan resumes when the crossing becomes dry', async () => {
  const { growPavedTrunkSteps } = await import('../src/shared/city-trunks');
  const { finishRoadWork } = await import('../src/shared/road-work');
  const w = twoCities();
  day(w);
  const town = w.towns[0];
  w.pavingProjects = {
    [town.id]: {
      destination: 'east-city',
      goal: { x: 600, z: 0 },
      width: 5,
      path: [{ x: 100, z: 0 }],
      feederQueued: true,
      waitingForBridge: { near: { x: 100, z: 0 }, far: { x: 150, z: 0 } },
    },
  };
  const used = finishRoadWork(
    growPavedTrunkSteps(w, town, [{ a: { x: 0, z: 0 }, b: { x: 100, z: 0 }, width: 5 }], 1),
  );
  assert.equal(used, 1, 'resume after water is removed');
  assert.equal(w.pavingProjects[town.id].waitingForBridge, undefined);
});
test('a long paving survey survives a day boundary while qualification remains unchanged', (t) => {
  const w = streets();
  Object.assign(w.settings, { cityDensityDays: 1, cityPavingPerDay: 1 });
  let clock = 0;
  t.mock.method(performance, 'now', () => (clock += 10));
  for (let i = 0; i < 5000 && !pavedLength(w); i++) {
    const before = w.time;
    // Fast world clock: a daily assessment happens while the solver is yielded.
    if (i % 30 === 0) w.time += w.settings.dayLength;
    roads.growRoads(w, before, w.time);
  }
  assert.ok(pavedLength(w) > 0, 'unchanged qualification must not continually restart work');
});
test('queued dirt feeders grow with the existing shared road budget and survive restart', () => {
  let w = streets();
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, { roadGrowthPerDay: 12, cityPaving: false });
  w.pavingFeeders = [
    {
      kind: 'connection',
      width: 5,
      path: [
        { x: 0, z: 0 },
        { x: 120, z: 0 },
      ],
    },
  ];
  day(w);
  const length = () => w.roads!.reduce((n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), 0);
  assert.equal(length(), 12);
  assert.equal(w.pavingFeeders.length, 0);
  assert.equal(w.roadProject?.kind, 'connection');
  w = JSON.parse(JSON.stringify(w));
  day(w);
  assert.equal(length(), 24);
  const before = length();
  w.buildings.push(makeBuilding('block-feeder', 'warehouse', 60, 0));
  day(w);
  assert.equal(length(), before, 'do not build a feeder with a newly blocked remaining route');
  assert.equal(w.roadProject, undefined);
});
test('reimporting a design into an unoccupied world resets earlier city observations and pending work', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const source = streets();
  day(source);
  day(source);
  const target = createWorld('unoccupied', 'Unoccupied', 'owner');
  // An unoccupied world can have automatic public development before import.
  target.cityDevelopment = structuredClone(source.cityDevelopment);
  target.cityAssessedDay = 30;
  target.cityDayLength = 600;
  target.pavingEligibility = { old: 30 };
  target.pavingPolicy = 'old';
  target.pavingDay = 30;
  target.pavingDue = 31;
  target.pavingDayLength = 600;
  target.pavingProjects = {
    old: {
      destination: 'old',
      goal: { x: 10, z: 0 },
      path: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
      ],
      width: 5,
    },
  };
  target.pavingFeeders = [
    {
      kind: 'connection',
      width: 5,
      path: [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
      ],
    },
  ];
  applyDesign(target, exportDesign(source));
  for (const key of [
    'cityDevelopment',
    'cityAssessedDay',
    'cityDayLength',
    'pavingEligibility',
    'pavingPolicy',
    'pavingDay',
    'pavingDue',
    'pavingDayLength',
    'pavingProjects',
    'pavingFeeders',
  ] as const)
    assert.equal(target[key], undefined, key + ' belongs to the previous simulation');
  assert.deepEqual(target.pavedRoads, source.pavedRoads, 'authored surfaces still import');
});
test('bridge-waiting town status does not claim that an unusable ford exists', async () => {
  const { townPanel } = await import('../src/client/town-panel');
  const w = settlement(),
    hall = w.buildings.find((b) => b.kind === 'town')!;
  w.towns[0].plinth = hall.id;
  w.settings.roadFords = false;
  w.pavingStatus = {
    [w.towns[0].id]: {
      destination: 'east',
      metresRemaining: 0,
      waitingForBridge: { near: { x: 100, z: 0 }, far: { x: 150, z: 0 } },
    },
  };
  const html = townPanel(w, w.players.owner, hall);
  assert.match(html, /Awaiting a bridge/);
  assert.doesNotMatch(html, /the ford remains a dirt route/);
});

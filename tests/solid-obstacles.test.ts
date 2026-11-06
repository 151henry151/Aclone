// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, move, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { terrainHeight } from '../src/shared/terrain';
import { worldResources } from '../src/shared/resources';
import { constructionSiteReason } from '../src/shared/construction-site';
import { roadSite } from '../src/shared/road-routing';
import { Store } from '../src/server/store';
const input = { throttle: 1, steer: 0, boost: false };
function setup() {
  const w = createWorld('solid-test', 'Solid scenery', 'owner');
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  Object.assign(w.settings, { mapSize: 2000, seaLevel: -10, vehicleMaintenance: true });
  w.creator = creatorSchema.parse({ roads: false, scenery: true });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  const p = addPlayer(w, 'owner', 'Driver');
  Object.assign(p, {
    x: 300,
    z: 300,
    y: 20,
    speed: 10,
    heading: 0,
    engine: true,
    online: true,
    fuel: 64,
  });
  return { w, p };
}
async function objects(w: ReturnType<typeof setup>['w']) {
  const { sceneryChunk } = await import('../src/shared/scenery-obstacles');
  return [-2, -1, 0, 1, 2].flatMap((x) => [-2, -1, 0, 1, 2].flatMap((z) => sceneryChunk(w, x, z)));
}
test('solid scenery and contact modes have central configurable defaults and reject invalid edits atomically', async () => {
  const { w, p } = setup();
  assert.equal((w.settings as any).solidScenery, 'trunks-and-boulders');
  assert.equal((w.settings as any).vehicleCollision, 'glancing');
  assert.equal((w.settings as any).pedestrianBlocking, true);
  assert.equal((w.settings as any).offlineVehicleObstacleSeconds, 60);
  assert.equal((w.settings as any).vehicleGlancingDegrees, 15);
  assert.equal((w.settings as any).vehicleGlancingSpeed, 0.7);
  for (const patch of [
    { solidScenery: 'crowns' },
    { vehicleCollision: 'bounce' },
    { offlineVehicleObstacleSeconds: -1 },
    { vehicleGlancingDegrees: 46 },
    { vehicleGlancingSpeed: 1.1 },
    { pedestrianBlocking: 1 },
  ]) {
    const before = structuredClone(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.deepEqual(w, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: {
      solidScenery: 'trunks',
      vehicleCollision: 'stop-only',
      pedestrianBlocking: false,
      offlineVehicleObstacleSeconds: 0,
      vehicleGlancingDegrees: 0,
      vehicleGlancingSpeed: 0,
    },
  });
  const { rulesSummary } = await import('../src/shared/rulesets');
  assert.match(rulesSummary(w), /trunks.*stop-only/);
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const fresh = setup().w;
  fresh.players = {};
  applyDesign(fresh, exportDesign(w));
  assert.equal((fresh.settings as any).offlineVehicleObstacleSeconds, 0);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal((store.loadWorlds()[0].world.settings as any).solidScenery, 'trunks');
  } finally {
    store.close();
  }
});
test('shared chunk objects are deterministic across snapshots, saves and quality-independent clients', async () => {
  const { w } = setup(),
    a = await objects(w),
    b = await objects(structuredClone(w));
  assert.ok(a.some((o) => o.kind === 'tree'));
  assert.ok(a.some((o) => o.kind === 'boulder'));
  assert.deepEqual(a, b);
  assert.equal(new Set(a.map((o) => o.id)).size, a.length);
  for (const o of a) {
    assert.ok(Number.isFinite(o.x + o.z + o.radius + o.height));
    assert.ok(o.radius > 0 && o.height > 0);
  }
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(await objects(store.loadWorlds()[0].world), a);
  } finally {
    store.close();
  }
});
test('layout changes clear roads, buildings and water without moving unrelated candidate ids', async () => {
  const { w } = setup(),
    a = await objects(w),
    tree = a.find((o) => o.kind === 'tree')!;
  w.roads = [{ a: { x: tree.x - 10, z: tree.z }, b: { x: tree.x + 10, z: tree.z }, width: 5 }];
  w.revision++;
  let b = await objects(w);
  assert.ok(!b.some((o) => o.id === tree.id));
  const common = b.filter((o) => a.some((v) => v.id === o.id));
  for (const o of common)
    assert.deepEqual(
      o,
      a.find((v) => v.id === o.id),
    );
  const next = b.find((o) => o.kind === 'tree')!;
  w.buildings.push(makeBuilding('new-site', 'home', next.x, next.z));
  w.revision++;
  b = await objects(w);
  assert.ok(!b.some((o) => o.id === next.id));
  w.settings.seaLevel = 100;
  w.revision++;
  assert.equal((await objects(w)).length, 0);
});
test('resource boulders use shared authored transforms and disabled scenery has no invisible objects', async () => {
  const { w } = setup();
  const { stoneGroundBoulders } = await import('../src/shared/scenery-obstacles');
  const node = worldResources(w).find((n) => n.item === 'stone')!;
  const stones = stoneGroundBoulders(w, node);
  assert.equal(stones.length, 3);
  assert.equal(stones[0].x, node.x - 1.25);
  assert.equal(stones[0].z, node.z - 0.6);
  assert.ok((await objects(w)).some((o) => o.id === stones[0].id));
  w.creator!.scenery = false;
  w.coastalBluffs = [];
  assert.equal((await objects(w)).length, 0);
});
for (const kind of ['tree', 'boulder'])
  test(`swept tractor contact stops at a ${kind} with no fuel, health or condition penalty`, async () => {
    const { w, p } = setup(),
      o = (await objects(w)).find((o) => o.kind === kind)!;
    Object.assign(p, { x: o.x, z: o.z - o.radius - 2, y: terrainHeight(w, o.x, o.z), speed: 10 });
    p.fleetState = { 0: { acquiredAt: 0, metres: 0, condition: 100 } };
    const before = {
      x: p.x,
      z: p.z,
      fuel: p.fuel,
      health: p.health,
      fleet: structuredClone(p.fleetState),
    };
    move(w, p, input, 0.5);
    assert.equal(p.speed, 0);
    assert.equal(p.x, before.x);
    assert.equal(p.z, before.z);
    assert.equal(p.fuel, before.fuel);
    assert.equal(p.health, before.health);
    assert.deepEqual(p.fleetState, before.fleet);
  });
test('a player can escape an initial trunk overlap and walking slides around a round trunk', async () => {
  const { w, p } = setup(),
    o = (await objects(w)).find((o) => o.kind === 'tree')!;
  Object.assign(p, { x: o.x, z: o.z, y: terrainHeight(w, o.x, o.z), speed: 4 });
  move(w, p, input, 0.1);
  assert.ok(p.z > o.z);
  Object.assign(p, {
    vehicle: 5,
    x: o.x + o.radius + 0.1,
    z: o.z - 0.8,
    y: terrainHeight(w, o.x, o.z),
    heading: 0,
    speed: 4,
  });
  const from = { x: p.x, z: p.z };
  move(w, p, input, 0.25);
  assert.ok(p.z > from.z);
  assert.ok(p.x > from.x);
  assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= o.radius + 0.24);
});
test('road survey and construction preview consult the same solid obstacle set', async () => {
  const { w } = setup(),
    o = (await objects(w)).find((o) => o.kind === 'boulder' && Math.hypot(o.x, o.z) > 50)!;
  const from = { x: o.x - 10, z: o.z },
    to = { x: o.x + 10, z: o.z };
  assert.equal(roadSite(w).segment(from, to), false);
  const candidate = makeBuilding('candidate', 'home', o.x, o.z);
  assert.match(constructionSiteReason(w, candidate) ?? '', /tree|boulder|scenery/i);
  (w.settings as any).solidScenery = 'off';
  assert.equal(roadSite(w).segment(from, to), true);
  assert.equal(constructionSiteReason(w, candidate), undefined);
});

test('NPC ground routes detour around the same trunks and boulders, and escape a saved overlap', async () => {
  const { w, p } = setup();
  const { Navigator } = await import('../src/server/npc/navigation');
  const { sceneryBlocksSegment } = await import('../src/shared/ground-contacts');
  const o = (await objects(w)).find((o) => o.kind === 'tree' && Math.hypot(o.x, o.z) > 80)!;
  Object.assign(p, { x: o.x - 20, z: o.z, speed: 0 });
  const nav = new Navigator(w, p, { x: o.x + 20, z: o.z }, 2);
  let from = { x: p.x, z: p.z };
  for (const to of nav.waypoints()) {
    assert.equal(sceneryBlocksSegment(w, from, to, 1.3, true), false, 'route edge clears scenery');
    from = to;
  }
  Object.assign(p, { x: o.x, z: o.z });
  assert.ok(new Navigator(w, p, { x: o.x + 20, z: o.z }, 2).waypoints().length > 0);
});

test('same-tick replacement of terrain and roads invalidates cached solids', async () => {
  const { w } = setup();
  const a = await objects(w),
    tree = a.find((o) => o.kind === 'tree')!;
  w.landscape = { ...w.landscape!, heightmap: Array(1089).fill(-100) };
  assert.equal((await objects(w)).length, 0);
  w.landscape = { ...w.landscape!, heightmap: Array(1089).fill(20) };
  assert.ok((await objects(w)).some((o) => o.id === tree.id));
  w.roads = [{ a: { x: tree.x - 10, z: tree.z }, b: { x: tree.x + 10, z: tree.z }, width: 5 }];
  assert.ok(!(await objects(w)).some((o) => o.id === tree.id));
  w.roads = [{ a: { x: 700, z: 700 }, b: { x: 710, z: 710 }, width: 5 }];
  assert.ok((await objects(w)).some((o) => o.id === tree.id));
});

test('world-builder controls expose named modes, contact rules and catalogue footprint dimensions', async () => {
  const { settingsFields } = await import('../src/client/creator-editor');
  const { vehicleEditor } = await import('../src/client/vehicle-editor');
  const { vehicles } = await import('../src/shared/catalog');
  const { w } = setup();
  const html = settingsFields(w.settings);
  assert.match(html, /<legend>Solid scenery and vehicle contacts<\/legend>/);
  for (const key of ['solidScenery', 'vehicleCollision'])
    assert.match(html, new RegExp(`<select name="${key}"`));
  assert.match(html, /name="clearRouteParking" type="checkbox"/);
  assert.match(vehicleEditor(w, 0), /name="width"/);
  for (const v of vehicles)
    if (v.mode !== 3 && v.mode !== 8) {
      assert.ok(v.length && v.length > 0, `${v.name}: length`);
      assert.ok(v.width && v.width > 0, `${v.name}: width`);
    }
});

test('solid modes change collision queries without rerolling or hiding the scenery', async () => {
  const { w } = setup();
  const { sceneryChunk, sceneryObstaclesNear } = await import('../src/shared/scenery-obstacles');
  const before = sceneryChunk(w, 0, 0);
  assert.ok(before.some((o) => o.kind === 'tree'));
  assert.ok(before.some((o) => o.kind === 'boulder'));
  w.settings.solidScenery = 'trunks';
  assert.ok(
    sceneryObstaclesNear(w, { x: 0, z: 0 }, { x: 256, z: 256 }).every((o) => o.kind === 'tree'),
  );
  w.settings.solidScenery = 'off';
  assert.equal(sceneryObstaclesNear(w, { x: 0, z: 0 }, { x: 256, z: 256 }).length, 0);
  assert.deepEqual(sceneryChunk(w, 0, 0), before);
  w.time++;
  assert.equal(sceneryChunk(w, 0, 0), before, 'ordinary clock ticks reuse the cached chunk');
});

test('a stopped tractor stays against a trunk under continued throttle and varying tick lengths', async () => {
  const { w, p } = setup();
  const tree = (await objects(w)).find((o) => o.kind === 'tree')!;
  Object.assign(p, { x: tree.x, z: tree.z - tree.radius - 1.24 - 0.8, heading: 0, speed: 8 });
  move(w, p, input, 0.3);
  assert.equal(p.speed, 0);
  const stopped = { x: p.x, z: p.z, fuel: p.fuel };
  for (const dt of [0.05, 0.1, 0.04, 0.08, 0.05]) move(w, p, input, dt);
  assert.deepEqual({ x: p.x, z: p.z, fuel: p.fuel }, stopped);
  p.heading = Math.PI;
  move(w, p, input, 0.1);
  assert.ok(p.z < stopped.z, 'turning away releases the contact');
  assert.equal(p.sceneryStop, undefined);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  move,
  makeBuilding,
  terrainHeight,
} from '../src/shared/simulation';
import { PARISH_SPAWN, spawnReserved, buildingSpawnReason } from '../src/shared/spawn-reserve';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { Store } from '../src/server/store';
function fixture(flat = false) {
  const w = createWorld('respawn-rules', 'Arrival rules', 'owner');
  w.script = '';
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.roads = [];
  w.settings.mapSize = 500;
  if (flat)
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(8),
    };
  const p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
const patch = (w: ReturnType<typeof fixture>['w'], respawnX: number, respawnZ: number) =>
  act(w, 'owner', { type: 'settings', patch: { respawnX, respawnZ } });

test('default and legacy arrivals keep the shared point; edits affect future arrivals and grounded death recovery only', () => {
  const { w, p } = fixture();
  assert.equal((w.settings as any).respawnX, 0);
  assert.equal((w.settings as any).respawnZ, 17);
  assert.deepEqual({ x: p.x, z: p.z }, PARISH_SPAWN);
  assert.equal(p.y, 0.15);
  delete (w.settings as any).respawnX;
  delete (w.settings as any).respawnZ;
  const legacy = addPlayer(w, 'legacy', 'Legacy');
  assert.deepEqual({ x: legacy.x, y: legacy.y, z: legacy.z }, { x: 0, y: 0.15, z: 17 });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(8),
  };
  const before = structuredClone(p);
  patch(w, 80, -80);
  assert.deepEqual(p, before);
  assert.equal(addPlayer(w, p.id, p.name), p, 'rejoining never teleports an existing player');
  const newcomer = addPlayer(w, 'new', 'New neighbour');
  assert.deepEqual({ x: newcomer.x, y: newcomer.y, z: newcomer.z }, { x: 80, y: 8, z: -80 });
  p.online = true;
  p.age = w.settings.maxAge;
  advance(w, 0.05);
  assert.equal(p.deaths, 1);
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, { x: 80, y: terrainHeight(w, 80, -80), z: -80 });
  const after = structuredClone(p);
  assert.throws(() => act(w, p.id, { type: 'respawn' }), /requires travel/);
  assert.deepEqual(p, after);
});

test('construction and farm reservations follow the configured point while towns and explicit zones remain protected', () => {
  const { w } = fixture(true);
  patch(w, 100, 100);
  assert.ok(spawnReserved(w, 100, 100));
  assert.equal(spawnReserved(w, 0, 17), false);
  assert.match(buildingSpawnReason(w, makeBuilding('new', 'home', 100, 100))!, /respawn/);
  assert.equal(buildingSpawnReason(w, makeBuilding('old', 'home', 0, 17)), undefined);
  const farm = makeBuilding('farm', 'farm', 100 - 26, 100 - 9);
  farm.rotation = 0;
  assert.match(farmExpansionBlocker(w, farm)!, /respawn/);
  w.zones.push({ id: 'arrival', kind: 'spawn', x: -100, z: 90, radius: 10 });
  assert.ok(spawnReserved(w, -100, 90));
  w.towns.push({ id: 'town', x: 0, z: 0 } as any);
  assert.ok(spawnReserved(w, 0, 0));
});

test('invalid, wet and occupied arrival sites reject before mutating settings', () => {
  const { w } = fixture(true);
  patch(w, 80, -80);
  w.buildings.push(makeBuilding('home', 'home', 110, -80));
  w.terrain.push({ x: -80, z: 80, radius: 20, height: -20 });
  for (const [x, z] of [
    [NaN, 0],
    [Infinity, 0],
    [251, 0],
    [0, -251],
    [-50001, 0],
    [-80, 80],
    [110, -80],
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => patch(w, x, z));
    assert.deepEqual(w.settings, before);
  }
  act(w, 'owner', { type: 'settings', patch: { spawnClearance: 0 } });
  assert.throws(() => patch(w, 110, -80), /clear|occupied|blocked/i);
  // A later terrain edit does not prevent unrelated legacy settings changes.
  w.terrain.push({ x: 80, z: -80, radius: 20, height: -20 });
  act(w, 'owner', { type: 'settings', patch: { chatMaxLength: 1300 } });
  assert.equal(w.settings.chatMaxLength, 1300);
});

test('coordinates round trip through creation/editor/summary/residents/saves/designs and invalid imports are atomic', async () => {
  const { w, p } = fixture(true);
  patch(w, 80.5, -80.5);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  assert.match(settingsFields(w.settings), /name="respawnX"[^>]*value="80.5"/);
  assert.match(settingsFields(w.settings), /name="respawnZ"[^>]*value="-80.5"/);
  assert.match(rulesSummary(w), /80\.5.*-80\.5/);
  const dest = createWorld('dest', 'Destination', 'other');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const observed = observe(
      w,
      p,
      { plan: [], index: 0 } as any,
      new NpcMemory(store),
      'resident',
    ).worldRules;
    for (const rules of [saved.settings, dest.settings, observed]) {
      assert.equal((rules as any).respawnX, 80.5);
      assert.equal((rules as any).respawnZ, -80.5);
    }
    const bad = structuredClone(exportDesign(w));
    (bad.settings as any).respawnX = 251;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});

test('submerged land-vehicle recovery uses the configured dry point', () => {
  const { w, p } = fixture(true);
  patch(w, 80, -80);
  w.terrain.push({ x: -80, z: 80, radius: 20, height: -20 });
  Object.assign(p, { x: -80, z: 80, y: -5, vehicle: 0, speed: 0, engine: false });
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.05);
  assert.deepEqual({ x: p.x, y: p.y, z: p.z }, { x: 80, y: 8, z: -80 });
});

test('high tide, solid objects and barriers reject unsafe coordinate edits', async () => {
  const { w } = fixture(true);
  const { creatorSchema } = await import('../src/shared/creator');
  patch(w, 80, -80);
  w.creator = creatorSchema.parse({
    objects: [{ id: 'solid', name: 'Solid prop', model: 'block', x: -100, z: -100, solid: true }],
  });
  const landscape = structuredClone(w.landscape!);
  landscape.barriers.push({
    id: 'fence',
    kind: 'fence',
    points: [
      { x: 90, z: 80 },
      { x: 110, z: 80 },
    ],
    width: 0.3,
    height: 1.5,
  });
  act(w, 'owner', { type: 'landscape', landscape });
  w.terrain.push({ x: -120, z: 40, radius: 20, height: -7 });
  act(w, 'owner', { type: 'settings', patch: { tidalRange: 4, seaLevel: 0 } });
  for (const [x, z] of [
    [-100, -100],
    [100, 80],
    [-120, 40],
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => patch(w, x, z), /clear|dry|blocked|tide/i, `${x}, ${z}`);
    assert.deepEqual(w.settings, before);
  }
});

import { canoePanel } from '../src/client/canoe-panel';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { canoeRules } from '../src/shared/canoe-rules';
import { createCanoe, carriedCanoe } from '../src/client/canoe-model';
import { prepareFrame } from '../src/server/snapshots';
import { vehicleDef } from '../src/shared/vehicle-config';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  carry,
  move,
  advance,
} from '../src/shared/simulation';
import { Store } from '../src/server/store';
import { terrainHeight } from '../src/shared/terrain';

function setup() {
  const w = createWorld('canoe', 'Canoe', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.settings.seaLevel = -50;
  Object.assign(p, {
    x: 0,
    z: -200,
    y: terrainHeight(w, 0, -200),
    vehicle: 5,
    inventory: {},
    cash: 100000,
    online: true,
    speed: 0,
  });
  const carpenter = makeBuilding('carpenter', 'carpenter', -15, -200);
  w.buildings.push(carpenter);
  return { w, p, carpenter };
}
test('canoe purchase creates one owned carried hull with its weight and persists set-down ownership', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  assert.ok(p.carrying, 'purchase lifts the canoe overhead');
  assert.equal(p.cash, 85000);
  assert.equal(carry(p, w), 8);
  const c = w.smallCraft![p.carrying!];
  assert.equal(c.state, 'carried');
  assert.equal(c.owner, p.id);
  act(w, p.id, { type: 'canoe', operation: 'setDown' });
  assert.equal(p.carrying, undefined);
  assert.equal(c.state, 'setDown');
  assert.equal(carry(p, w), 0);
  const q = addPlayer(w, 'other', 'Other');
  Object.assign(q, { x: p.x, z: p.z, y: p.y, vehicle: 5, speed: 0, inventory: {} });
  assert.throws(() => act(w, q.id, { type: 'canoe', operation: 'pickup', id: c.id }), /owner/i);
  act(w, p.id, { type: 'settings', patch: { canoePublicPickup: true } });
  act(w, q.id, { type: 'canoe', operation: 'pickup', id: c.id });
  assert.equal(q.carrying, c.id);
  assert.equal(c.owner, q.id);
});
test('carried canoes slow walking and boost alike, weigh once, and refuse conflicting activities before mutation', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  p.inventory.jetpack = 1;
  p.fuel = 10;
  const start = { x: p.x, z: p.z, y: p.y };
  for (const boost of [false, true]) {
    Object.assign(p, { ...start, speed: 0 });
    for (let i = 0; i < 100; i++) move(w, p, { throttle: 1, steer: 0, boost, lift: 1 }, 0.05);
    assert.ok(p.speed > 0 && p.speed <= 2, 'slow even when boost is held');
    assert.ok(p.y <= terrainHeight(w, p.x, p.z) + 0.01, 'cannot jump or jetpack');
  }
  for (const type of [
    'vehicle',
    'crow',
    'gather',
    'build',
    'work',
    'joinGame',
    'hitch',
    'farm',
    'plant',
    'task',
    'construct',
    'supply',
  ]) {
    const before = JSON.stringify(p);
    assert.throws(() => act(w, p.id, { type, slot: 0, game: 'fishing' }), /canoe/i, type);
    assert.equal(JSON.stringify(p), before, type);
  }
  p.speed = 0;
  Object.assign(p, start);
  p.inventory.wood = 100;
  act(w, p.id, { type: 'canoe', operation: 'setDown' });
  assert.throws(
    () => act(w, p.id, { type: 'canoe', operation: 'pickup', id: Object.keys(w.smallCraft!)[0] }),
    /weight|carry|cargo/i,
  );
});
test('wood crafting, home storage and retrieval preserve one hull, enforce home limit and reject invalid purchases', () => {
  const { w, p, carpenter } = setup();
  assert.throws(
    () => act(w, p.id, { type: 'canoe', operation: 'craft', building: carpenter.id }),
    /wood/i,
  );
  p.inventory.wood = 8;
  act(w, p.id, { type: 'canoe', operation: 'craft', building: carpenter.id });
  assert.equal(p.inventory.wood ?? 0, 0);
  assert.ok(p.carrying);
  const home = makeBuilding('home', 'home', 0, -200);
  home.owner = p.id;
  w.buildings.push(home);
  act(w, p.id, { type: 'canoe', operation: 'store', building: home.id });
  assert.equal(home.stock.canoe, 1);
  assert.equal(Object.keys(w.smallCraft!).length, 0);
  assert.equal(p.carrying, undefined);
  act(w, p.id, { type: 'canoe', operation: 'retrieve', building: home.id });
  assert.equal(home.stock.canoe ?? 0, 0);
  assert.ok(p.carrying);
  home.stock.canoe = 2;
  assert.throws(
    () => act(w, p.id, { type: 'canoe', operation: 'store', building: home.id }),
    /limit|full/i,
  );
  home.stock.canoe = 0;
  act(w, p.id, { type: 'canoe', operation: 'store', building: home.id });
  p.cash = 0;
  assert.throws(
    () => act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id }),
    /cash/i,
  );
  assert.equal(Object.keys(w.smallCraft!).length, 0);
  p.inventory.canoe = 1;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'stock',
        building: home.id,
        item: 'canoe',
        quantity: 2,
        direction: 'deposit',
      }),
    /stock|limit|full/i,
  );
  act(w, p.id, { type: 'canoe', operation: 'carry' });
  assert.equal(p.inventory.canoe ?? 0, 0);
  assert.equal(carry(p, w), 8);
});
test('canoe rules validate and set-down state survives restart and boat-loss death by default', async () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { canoePrice: 10000, canoeWeight: 6, canoeCarrySpeed: 0.3, canoeHomeLimit: 1 },
  });
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { canoeCarrySpeed: 2 } }));
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  assert.equal(p.cash, 90000);
  assert.equal(carry(p, w), 6);
  act(w, p.id, { type: 'canoe', operation: 'setDown' });
  const c = Object.values(w.smallCraft!)[0];
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.deepEqual(loaded.smallCraft, w.smallCraft);
  } finally {
    store.close();
  }
  w.settings.loseBoatsOnDeath = true;
  p.age = w.settings.maxAge + 1;
  advance(w, 1);
  assert.ok(w.smallCraft![c.id]);
  act(w, p.id, { type: 'settings', patch: { canoeLoseOnLandDeath: true } });
  p.age = w.settings.maxAge + 1;
  p.invulnerableUntil = 0;
  advance(w, 1);
  assert.equal(w.smallCraft![c.id], undefined);
});
test('carried death follows inventory loss and snapshots expose the hull without cash', () => {
  for (const lose of [false, true]) {
    const { w, p, carpenter } = setup();
    act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
    const id = p.carrying!;
    w.settings.loseInventoryOnDeath = lose;
    const visible = JSON.parse(prepareFrame(w).players[p.id]);
    assert.equal(visible.carrying, id);
    assert.equal(visible.cash, undefined);
    p.age = w.settings.maxAge + 1;
    p.invulnerableUntil = 0;
    advance(w, 1);
    assert.equal(p.carrying, undefined);
    assert.equal(!!w.smallCraft![id], !lose);
    if (!lose) assert.equal(w.smallCraft![id].state, 'setDown');
  }
});
test('carrying speed is the world multiplier and blocked construction/task actions do not start work', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  w.buildings = [];
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(3),
  };
  for (const multiplier of [0.3, 0.7])
    for (const boost of [false, true]) {
      w.settings.canoeCarrySpeed = multiplier;
      const q = structuredClone(p);
      q.y = 3;
      q.speed = 0;
      for (let i = 0; i < 400; i++) move(w, q, { throttle: 1, steer: 0, boost }, 0.05);
      assert.ok(Math.abs(q.speed - vehicleDef(w, 5).speed * multiplier) < 1e-6);
    }
});
test('canoe hull has sealed ends and an open cockpit; carried hull is inverted above head height', () => {
  const hull = createCanoe(),
    mesh = hull.children[0] as import('three').Mesh;
  const indices = mesh.geometry.index!.array,
    edges = new Map<string, number>();
  for (let i = 0; i < indices.length; i += 3)
    for (const [a, b] of [
      [indices[i], indices[i + 1]],
      [indices[i + 1], indices[i + 2]],
      [indices[i + 2], indices[i]],
    ]) {
      const key = [a, b].sort((a, b) => a - b).join(':');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  assert.equal(
    [...edges.values()].filter((n) => n === 1).length,
    14,
    'only the 14 rim edges remain open',
  );
  const carried = carriedCanoe();
  assert.equal(carried.rotation.z, Math.PI);
  assert.ok(carried.position.y > 2);
});
test('canoe rules survive design export and legacy defaults while personal hulls remain private save state', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'settings', patch: { canoeHomeLimit: 1, canoeWood: 5, canoePrice: 12000 } });
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  const design = exportDesign(w);
  assert.equal(design.settings.canoeHomeLimit, 1);
  assert.equal('smallCraft' in design, false);
  const target = createWorld('target', 'Target', 'owner');
  target.players = {};
  applyDesign(target, design);
  assert.equal(canoeRules(target.settings).canoeWood, 5);
  assert.equal(canoeRules(target.settings).canoePrice, 12000);
  assert.equal(canoeRules({}).canoeCarrySpeed, 0.4);
  const home = makeBuilding('home', 'home', 0, -200);
  home.owner = p.id;
  w.buildings.push(home);
  p.atHome = true;
  p.home = home.id;
  act(w, p.id, { type: 'canoe', operation: 'store', building: home.id });
  assert.equal(home.stock.canoe, 1);
  p.inventory.canoe = 1;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'stock',
        building: home.id,
        item: 'canoe',
        quantity: 1,
        direction: 'deposit',
      }),
    /limit/,
  );
});
test('canoe purchase controls use the same completed boathouse range as the server', () => {
  const { w, p, carpenter } = setup();
  carpenter.kind = 'boathouse';
  carpenter.x = 35;
  assert.match(canoePanel(w, p), /Buy canoe/);
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  assert.ok(p.carrying);
});

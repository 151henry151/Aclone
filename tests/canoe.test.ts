import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { boatShoreCollision } from '../src/shared/boat-shore';
import { surfaceWaterLevel } from '../src/shared/ocean';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
import { canoeLanding, canoeWater } from '../src/shared/canoe-shore';
import { vehicleCondition } from '../src/shared/vehicle-services';
import { canoePanel } from '../src/client/canoe-panel';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { canoeRules } from '../src/shared/canoe-rules';
import { createCanoe, carriedCanoe, createPaddledCanoe } from '../src/client/canoe-model';
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

test('canoe launches from an ordinary coast, paddles without boost or fuel, beaches and boards the same saved hull', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  const id = p.carrying!;
  w.smallCraft![id].paint = '#336699';
  w.buildings = [];
  w.settings.mapSize = 500;
  w.settings.seaLevel = 0;
  w.settings.tidalRange = 0;
  w.settings.oceanWaves = 0;
  // A shallow bank along x=0; no building or dock supplies this landing.
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * 2),
  };
  Object.assign(p, {
    x: -1,
    z: -40,
    y: terrainHeight(w, -1, -40),
    heading: 0,
    speed: 0,
    inventory: { fuel: 12 },
  });
  act(w, p.id, { type: 'canoe', operation: 'launch' });
  assert.equal(p.vehicle, 34);
  assert.equal(p.carrying, undefined);
  assert.equal(p.smallCraft, id);
  assert.equal(w.smallCraft![id].state, 'launched');
  assert.equal(p.engine, false);
  const fuel = p.fuel;
  for (let i = 0; i < 150; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.05);
  assert.ok(p.speed <= 1.2);
  assert.equal(p.fuel, fuel);
  p.speed = 0;
  assert.throws(
    () => act(w, p.id, { type: 'lifeboat', operation: 'launch' }),
    /canoe|motor|fuel-free/i,
  );
  p.speed = 0;
  Object.assign(p, { x: 3, z: -40 });
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  assert.equal(p.vehicle, 5);
  assert.equal(w.smallCraft![id].state, 'moored');
  assert.equal(p.smallCraft, undefined);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world,
      sp = saved.players[p.id];
    act(saved, sp.id, { type: 'canoe', operation: 'board', id });
    assert.equal(sp.vehicle, 34);
    assert.equal(sp.smallCraft, id);
    assert.equal(sp.inventory.fuel, 12);
    assert.equal(saved.smallCraft![id].paint, '#336699');
  } finally {
    store.close();
  }
});
test('canoe launch refuses missing water, excessive cargo and vehicle-menu duplication without mutation', () => {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  const id = p.carrying!;
  assert.throws(() => act(w, p.id, { type: 'canoe', operation: 'launch' }), /water|shore|bank/i);
  assert.equal(p.carrying, id);
  assert.equal(w.smallCraft![id].state, 'carried');
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 34, building: carpenter.id }),
    /canoe/i,
  );
  p.inventory.fuel = 13;
  assert.throws(() => act(w, p.id, { type: 'canoe', operation: 'launch' }), /hold|weight|cargo/i);
  assert.equal(p.inventory.fuel, 13);
  assert.equal(p.carrying, id);
});
function afloatCanoe() {
  const { w, p, carpenter } = setup();
  act(w, p.id, { type: 'canoe', operation: 'buy', building: carpenter.id });
  w.buildings = [];
  Object.assign(w.settings, {
    mapSize: 500,
    seaLevel: 0,
    tidalRange: 0,
    oceanWaves: 0,
    vehicleMaintenance: false,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * 2),
  };
  Object.assign(p, {
    x: -1,
    z: -40,
    y: terrainHeight(w, -1, -40),
    heading: 0,
    speed: 0,
    inventory: { fuel: 3 },
  });
  act(w, p.id, { type: 'canoe', operation: 'launch' });
  return { w, p, id: p.smallCraft! };
}
test('canoe afloat death loses the hull or preserves the same recoverable hull and cargo under ordinary boat rules', () => {
  for (const lose of [false, true]) {
    const { w, p, id } = afloatCanoe();
    w.settings.loseBoatsOnDeath = lose;
    p.age = w.settings.maxAge + 1;
    advance(w, 0.1);
    assert.equal(p.smallCraft, undefined);
    if (lose) {
      assert.equal(w.smallCraft![id], undefined);
      assert.equal(w.boatRescues?.[p.id], undefined);
    } else {
      const rescue = w.boatRescues![p.id];
      assert.equal(rescue.boat.smallCraft, id);
      assert.equal(rescue.cargo.fuel, 3);
      Object.assign(p, {
        vehicle: 29,
        x: rescue.boat.x,
        z: rescue.boat.z,
        y: 0,
        speed: 0,
        inventory: {},
      });
      act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
      assert.equal(p.vehicle, 34);
      assert.equal(p.smallCraft, id);
      assert.equal(p.inventory.fuel, 3);
      assert.equal(w.smallCraft![id].state, 'launched');
    }
  }
});
test('gentle canoe shore contact has no damage, recoil or throttle lock and allows beaching; a second person cannot board', () => {
  const { w, p, id } = afloatCanoe();
  p.heading = -Math.PI / 2;
  let previous = p.x;
  for (let i = 0; i < 160; i++) {
    previous = p.x;
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    if (p.speed === 0) break;
  }
  assert.ok(p.x <= previous, 'no recoil away from land');
  assert.equal(vehicleCondition(p), 100);
  assert.equal(p.boatShoreThrottle, undefined);
  p.speed = 0;
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  const q = addPlayer(w, 'visitor', 'Visitor');
  Object.assign(q, { x: p.x, z: p.z, y: p.y, vehicle: 5, speed: 0, inventory: {} });
  assert.throws(() => act(w, q.id, { type: 'canoe', operation: 'board', id }), /own/i);
  act(w, p.id, { type: 'canoe', operation: 'board', id });
  assert.throws(() => act(w, q.id, { type: 'hitch', player: p.id }));
  assert.equal(q.hitch, undefined);
});
test('a canoe launches from an elevated riverbank using the river surface rather than the sea datum', () => {
  const w = createWorld('puddlewick', 'River canoe', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  const p = addPlayer(w, 'owner', 'Owner');
  p.vehicle = 5;
  p.speed = 0;
  p.inventory = {};
  p.carrying = 'river-canoe';
  const river = w.northernIsland!.rivers[0],
    banks = riverBanks(river.points);
  let found = false;
  for (let i = 3; i < river.points.length - 3 && !found; i++) {
    const at = river.points[i],
      prev = river.points[i - 1],
      heading = Math.atan2(prev.x - at.x, prev.z - at.z);
    if (at.level < w.settings.seaLevel + 5 || !canoeWater(w, at.x, at.z, heading)) continue;
    for (const side of ['left', 'right'] as const) {
      const bank = banks[i][side],
        length = Math.hypot(bank.x - at.x, bank.z - at.z);
      const x = bank.x + ((bank.x - at.x) / length) * 0.5,
        z = bank.z + ((bank.z - at.z) / length) * 0.5,
        y = terrainHeight(w, x, z);
      if (y <= at.level || y - at.level > 1.5) continue;
      Object.assign(p, { x, z, y, heading });
      w.smallCraft = {
        'river-canoe': {
          id: 'river-canoe',
          kind: 'canoe',
          owner: p.id,
          state: 'carried',
          x,
          z,
          heading,
          paint: '#a84e32',
        },
      };
      assert.ok(canoeLanding(w, p, false), 'a clear elevated riverbank is launchable');
      act(w, p.id, { type: 'canoe', operation: 'launch' });
      assert.equal(p.vehicle, 34);
      assert.ok(p.y > w.settings.seaLevel + 5);
      found = true;
      break;
    }
  }
  assert.ok(found, 'survey finds a real headwater bank');
});
test('paddling animation retains a live seated skeleton and survives repeated movement updates', () => {
  const boat = createPaddledCanoe('#336699');
  assert.doesNotThrow(() => {
    for (let i = 0; i < 20; i++) boat.animate(i / 10, 1.2);
  });
  const person = boat.group.userData.driver as import('three').Group;
  assert.ok(person.getObjectByName('arm--1'));
  assert.equal(person.getObjectByName('hips')!.position.y, 0);
  assert.ok(person.getObjectByName('thigh--1')!.rotation.x < -1);
});
test('headwater survey finds a reach the canoe can paddle through but the canal hull cannot sweep through', () => {
  const w = createWorld('puddlewick', 'Headwater', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  let found = false;
  for (const river of w.northernIsland!.rivers)
    for (let i = 2; i < river.points.length - 2 && !found; i++) {
      const p = river.points[i],
        up = river.points[i - 1],
        heading = Math.atan2(up.x - p.x, up.z - p.z),
        to = { x: p.x + Math.sin(heading) * 3, z: p.z + Math.cos(heading) * 3 };
      if (
        !canoeWater(w, p.x, p.z, heading) ||
        boatShoreCollision(w, p, to, 0.46, heading, 1.8, 0.08, true) ||
        !boatShoreCollision(w, p, to, 1.3, heading, 6)
      )
        continue;
      const player = addPlayer(w, 'owner', 'Owner');
      Object.assign(player, {
        vehicle: 34,
        x: p.x,
        z: p.z,
        y: surfaceWaterLevel(w, p.x, p.z),
        heading,
        speed: 0,
        inventory: {},
        engine: false,
      });
      for (let n = 0; n < 80; n++) move(w, player, { throttle: 1, steer: 0, boost: false }, 0.05);
      assert.ok(
        Math.hypot(player.x - p.x, player.z - p.z) > 2,
        'actual canoe movement enters the narrow reach',
      );
      found = true;
    }
  assert.ok(found, 'a natural upstream passage excludes the larger canal hull');
});
test('boathouse and fishing pier launch and moor the same canoe at their ordinary landings', () => {
  const w = createWorld('puddlewick', 'Dock canoe', 'owner');
  ensurePuddlewickBoatyard(w);
  const p = addPlayer(w, 'owner', 'Owner');
  p.vehicle = 5;
  p.speed = 0;
  p.inventory = { canoe: 1 };
  const yard = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, yard.land, { y: travelHeight(w, yard.land.x, yard.land.z) });
  act(w, p.id, { type: 'canoe', operation: 'carry' });
  const id = p.carrying!;
  act(w, p.id, { type: 'canoe', operation: 'launch' });
  assert.deepEqual({ x: p.x, z: p.z }, yard.berth);
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  assert.equal(w.smallCraft![id].landing, yard.id);
  assert.match(canoePanel(w, p), /Board canoe/);
  act(w, p.id, { type: 'canoe', operation: 'board', id });
  const pier = boatLandings(w).find((d) => !d.building && !d.river)!;
  Object.assign(p, pier.berth, { speed: 0 });
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  assert.equal(w.smallCraft![id].landing, pier.id);
  act(w, p.id, { type: 'canoe', operation: 'board', id });
  assert.equal(p.smallCraft, id);
});
test('canoe has an interior floor above the calm water surface so a moored hull does not look flooded', () => {
  const hull = createCanoe();
  const floor = hull.getObjectByName('canoe-floor') as import('three').Mesh;
  assert.ok(floor, 'visible watertight interior');
  floor.geometry.computeBoundingBox();
  assert.ok(
    floor.geometry.boundingBox!.min.y >= 0.05,
    'floor clears the rendered inland water plane',
  );
});
test('a canoe cannot consume Fuel into a nonexistent tank', () => {
  const { w, p } = afloatCanoe();
  const before = { fuel: p.fuel, cargo: { ...p.inventory } };
  assert.throws(() => act(w, p.id, { type: 'use', item: 'fuel' }), /no fuel|no motor|fuel-free/i);
  assert.deepEqual({ fuel: p.fuel, cargo: p.inventory }, before);
});

test('lifting a moored canoe clears its old bank so later set-down pickup uses its new location', () => {
  const { w, p, id } = afloatCanoe();
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  act(w, p.id, { type: 'canoe', operation: 'pickup', id });
  Object.assign(p, { x: -30, z: -40, y: travelHeight(w, -30, -40), heading: 0 });
  act(w, p.id, { type: 'canoe', operation: 'setDown' });
  const c = w.smallCraft![id];
  Object.assign(p, { x: c.x, z: c.z, y: travelHeight(w, c.x, c.z) });
  assert.doesNotThrow(() => act(w, p.id, { type: 'canoe', operation: 'pickup', id }));
  assert.equal(p.carrying, id);
  assert.equal(c.land, undefined);
  assert.equal(c.landing, undefined);
});

test('moving, airborne, too-shallow and obstructed shore launches refuse before changing a hull or cargo', () => {
  for (const reason of ['moving', 'airborne', 'shallow', 'blocked']) {
    const { w, p, id } = afloatCanoe();
    act(w, p.id, { type: 'canoe', operation: 'beach' });
    act(w, p.id, { type: 'canoe', operation: 'pickup', id });
    if (reason === 'moving') p.speed = 2;
    if (reason === 'airborne') p.y += 10;
    if (reason === 'shallow') w.settings.canoeMinDepth = 1;
    if (reason === 'blocked') w.buildings.push(makeBuilding('block', 'home', p.x, p.z));
    const before = JSON.stringify({ p, hull: w.smallCraft![id] });
    assert.throws(
      () => act(w, p.id, { type: 'canoe', operation: 'launch' }),
      /Stop outside|ground|No clear water/,
    );
    assert.equal(JSON.stringify({ p, hull: w.smallCraft![id] }), before, reason);
  }
});

test('a bank-moored canoe follows changing water height and the river slope', async () => {
  const { floatCanoe } = await import('../src/client/canoe-model');
  assert.equal(typeof floatCanoe, 'function');
  const { w, p } = afloatCanoe();
  const model = createCanoe();
  floatCanoe(model, w, p.x, p.z, p.heading, w.time, 0);
  assert.ok(Math.abs(model.position.y - surfaceWaterLevel(w, p.x, p.z)) < 0.001);
  w.settings.seaLevel += 1;
  floatCanoe(model, w, p.x, p.z, p.heading, w.time, 0);
  assert.ok(Math.abs(model.position.y - surfaceWaterLevel(w, p.x, p.z)) < 0.001);
  const riverWorld = createWorld('puddlewick', 'River pose', 'owner');
  riverWorld.settings.mapSize = 18500;
  riverWorld.terrainMapSize = 12500;
  riverWorld.townLayout = 2;
  expandPuddlewickIsland(riverWorld);
  const points = riverWorld.northernIsland!.rivers[0].points,
    at = points[10],
    next = points[11];
  floatCanoe(
    model,
    riverWorld,
    at.x,
    at.z,
    Math.atan2(next.x - at.x, next.z - at.z),
    riverWorld.time,
    0,
  );
  assert.ok(Math.abs(model.rotation.x) > 0.001, 'moored hull follows the sloping river');
});

test('ordinary vehicle controls cannot summon a moored canoe or turn an occupied hull into a second boat', () => {
  const w = createWorld('puddlewick', 'No duplicated canoe', 'owner');
  ensurePuddlewickBoatyard(w);
  const p = addPlayer(w, 'owner', 'Owner'),
    yard = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, {
    vehicle: 5,
    speed: 0,
    inventory: { canoe: 1 },
    online: true,
    ...yard.land,
    y: travelHeight(w, yard.land.x, yard.land.z),
  });
  act(w, p.id, { type: 'canoe', operation: 'carry' });
  act(w, p.id, { type: 'canoe', operation: 'launch' });
  const id = p.smallCraft!;
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 5, building: yard.id }),
    /canoe.*controls/i,
  );
  assert.equal(p.smallCraft, id);
  act(w, p.id, { type: 'canoe', operation: 'beach' });
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 34, building: yard.id }),
    /canoe.*controls/i,
  );
  assert.equal(p.vehicle, 5);
  assert.equal(w.smallCraft![id].state, 'moored');
  assert.equal(Object.keys(w.mooredBoats ?? {}).length, 0);
});

test('canoe recovery refuses an overfull hold without pouring Fuel into a nonexistent tank', () => {
  const { w, p } = afloatCanoe();
  p.inventory.fuel = 12;
  p.age = w.settings.maxAge + 1;
  advance(w, 0.1);
  const r = w.boatRescues![p.id];
  Object.assign(p, { vehicle: 29, ...r.boat, y: 0, speed: 0, inventory: { fuel: 1 }, fuel: 0 });
  const before = JSON.stringify({ p, r });
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /exceeds.*hold/);
  assert.equal(JSON.stringify({ p, r }), before);
});
test('a canoe abandoned on an elevated river can be recovered at that river surface', () => {
  const { w, p, id } = afloatCanoe();
  w.id = 'puddlewick';
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  delete w.landscape;
  expandPuddlewickIsland(w);
  const at = w
    .northernIsland!.rivers.flatMap((r) => r.points)
    .find((pt) => pt.level > w.settings.seaLevel + 5 && canoeWater(w, pt.x, pt.z, 0));
  assert.ok(at);
  Object.assign(p, { x: at.x, z: at.z, y: at.level, age: w.settings.maxAge + 1 });
  advance(w, 0.1);
  const r = w.boatRescues![p.id];
  Object.assign(p, { vehicle: 29, x: r.boat.x, z: r.boat.z, y: at.level, speed: 0, inventory: {} });
  assert.doesNotThrow(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }));
  assert.equal(p.smallCraft, id);
  assert.ok(Math.abs(p.y - surfaceWaterLevel(w, p.x, p.z)) < 0.01);
});

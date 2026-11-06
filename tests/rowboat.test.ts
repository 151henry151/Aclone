// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move } from '../src/shared/simulation';
import { vehicles } from '../src/shared/catalog';
import { vehicleDef } from '../src/shared/vehicle-config';
import { boatLanding, boatLandings } from '../src/shared/boathouse';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { travelHeight } from '../src/shared/dock';
import { surfaceWaterLevel } from '../src/shared/ocean';
import { terrainHeight } from '../src/shared/terrain';
import { Store } from '../src/server/store';
const ROWBOAT = 36;
function setup() {
  const w = createWorld('puddlewick', 'Rowboats', 'owner');
  ensurePuddlewickBoatyard(w);
  const p = addPlayer(w, 'owner', 'Rower');
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.land, {
    vehicle: 5,
    y: travelHeight(w, d.land.x, d.land.z),
    inventory: {},
    cash: 1000000,
    online: true,
  });
  w.settings.vehicleLicences = false;
  return { w, p, d };
}
test('rowboat appends a configurable fuel-free two-person hull smaller than the motorboat', () => {
  const { w, p } = setup();
  assert.equal(vehicles[ROWBOAT]?.name, 'Rowboat');
  const v = vehicleDef(w, ROWBOAT);
  assert.equal(v.capacity, 30);
  assert.equal(v.hitch, 1);
  assert.equal(v.speed, 1.6);
  assert.equal(v.length, 3.8);
  assert.equal(v.beam, 1.5);
  assert.equal(v.fuel, 0);
  assert.equal(v.tank, undefined);
  assert.equal(v.price, 40000);
  act(w, p.id, {
    type: 'vehicleTuning',
    slot: ROWBOAT,
    capacity: 35,
    speed: 2,
    hitch: 0,
    price: 50000,
  });
  assert.equal(vehicleDef(w, ROWBOAT).capacity, 35);
  assert.equal(vehicleDef(w, ROWBOAT).hitch, 0);
});
test('purchase, row without fuel or boost, and enforce cargo capacity before boarding', () => {
  const { w, p, d } = setup();
  p.inventory = { stone: 16 };
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: ROWBOAT, building: d.id }),
    /cargo|weight|carry|capacity/i,
  );
  p.inventory = { stone: 15 };
  const cash = p.cash;
  act(w, p.id, { type: 'vehicle', slot: ROWBOAT, building: d.id });
  assert.equal(p.cash, cash - 40000);
  assert.equal(p.vehicle, ROWBOAT);
  Object.assign(p, { x: 0, z: 1000, y: surfaceWaterLevel(w, 0, 1000), fuel: 0, heading: 0 });
  for (let i = 0; i < 200; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.1);
  assert.ok(p.speed > 1.3 && p.speed <= 1.6);
  assert.equal(p.fuel, 0);
});
test('beached rowboat keeps its shore landing and owner through SQLite restart', () => {
  const { w, p, d } = setup();
  act(w, p.id, { type: 'vehicle', slot: ROWBOAT, building: d.id });
  // Find a real sandy bay edge that has a full wet hull beside a dry bank.
  let found = false;
  for (let x = -180; x <= 180 && !found; x += 2)
    for (let z = 150; z < 190; z += 0.2) {
      const depth = surfaceWaterLevel(w, x, z) - terrainHeight(w, x, z);
      if (depth < 0.15 || depth > 0.8) continue;
      Object.assign(p, { x, z, heading: Math.PI / 2, y: surfaceWaterLevel(w, x, z), speed: 0 });
      const landing = boatLanding(w, p, true);
      if ((landing as any)?.beached) {
        found = true;
        break;
      }
    }
  assert.ok(found, 'a stopped rowboat can beach beside the sandy shore');
  const at = { x: p.x, z: p.z };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const saved = w.mooredBoats![`${p.id}:${ROWBOAT}`];
  assert.deepEqual({ x: saved.x, z: saved.z }, at);
  assert.ok((saved as any).beached);
  const store = new Store(':memory:');
  store.saveWorld(w);
  const loaded = store.loadWorlds()[0].world;
  store.db.close();
  const q = loaded.players[p.id];
  assert.equal(q.vehicle, 5);
  act(loaded, q.id, { type: 'vehicle', slot: ROWBOAT });
  assert.equal(q.vehicle, ROWBOAT);
  assert.deepEqual({ x: q.x, z: q.z }, at);
  assert.equal(loaded.mooredBoats![`${q.id}:${ROWBOAT}`], undefined);
});

import { rowboatRules } from '../src/shared/rowboat-rules';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { advance } from '../src/shared/simulation';
function bankBoat(slope = 2) {
  const { w, p } = setup();
  w.buildings = [];
  Object.assign(w.settings, { mapSize: 500, seaLevel: 0, tidalRange: 0, oceanWaves: 0 });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * slope),
  };
  Object.assign(p, {
    vehicle: ROWBOAT,
    fleet: [0, 5, ROWBOAT],
    x: 2,
    z: -40,
    y: 0,
    heading: 0,
    speed: 0,
    inventory: {},
    fuel: 0,
  });
  return { w, p };
}
test('gentle shore contact leaves the whole hull afloat without recoil or condition loss', () => {
  const { w, p } = bankBoat();
  p.heading = -Math.PI / 2;
  p.fleetState = { [ROWBOAT]: { acquiredAt: 0, metres: 0, condition: 91 } };
  let last = p.x;
  for (let i = 0; i < 100; i++) {
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.1);
    assert.ok(p.x <= last + 1e-9, 'no recoil');
    last = p.x;
  }
  assert.ok(p.x >= vehicleDef(w, ROWBOAT).length! / 2);
  assert.equal(p.fleetState[ROWBOAT].condition, 91);
});
test('a second occupant rides, cannot steer, and must leave before the rower; third is refused', () => {
  const { w, p } = bankBoat();
  const d = boatLanding(w, p, true)!;
  assert.ok(d?.beached);
  const q = addPlayer(w, 'q', 'Rider'),
    third = addPlayer(w, 'third', 'Third');
  for (const a of [q, third])
    Object.assign(a, d.land, {
      vehicle: 5,
      y: travelHeight(w, d.land.x, d.land.z),
      speed: 0,
      online: true,
      inventory: {},
    });
  act(w, q.id, { type: 'hitch', player: p.id });
  assert.equal(q.hitch, p.id);
  assert.throws(() => act(w, third.id, { type: 'hitch', player: p.id }), /room/);
  third.x -= 20;
  const heading = p.heading;
  move(w, q, { throttle: 1, steer: 1, boost: true }, 1);
  assert.equal(p.heading, heading);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }), /passengers/);
  act(w, q.id, { type: 'detach' });
  third.x -= 20;
  q.x -= 20;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.vehicle, 5);
});
test('beached ownership refuses theft; public pickup transfers exactly one existing boat', () => {
  const { w, p } = bankBoat();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const q = addPlayer(w, 'q', 'Other');
  Object.assign(q, { x: p.x, z: p.z, y: p.y, vehicle: 5, inventory: {}, cash: 0, online: true });
  p.x -= 20;
  const action = { type: 'vehicle', slot: ROWBOAT, owner: p.id };
  assert.throws(() => act(w, q.id, action), /owner|private|public/i);
  act(w, p.id, { type: 'settings', patch: { rowboatPublicPickup: true } });
  act(w, q.id, action);
  assert.equal(q.vehicle, ROWBOAT);
  assert.ok(q.fleet!.includes(ROWBOAT));
  assert.ok(!p.fleet!.includes(ROWBOAT));
  assert.equal(Object.keys(w.mooredBoats!).length, 0);
  assert.equal(q.cash, 0);
  assert.equal(q.carrying, undefined);
});
test('rules validate and travel in designs; disabling purchases preserves existing rowboats', () => {
  const { w, p, d } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { rowboatsEnabled: false, rowboatBankRange: 6, rowboatStepOutDepth: 1.1 },
  });
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: ROWBOAT, building: d.id }), /disabled/);
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { rowboatBankRange: 20 } }));
  const target = createWorld('target', 'Target', 'other');
  applyDesign(target, exportDesign(w));
  assert.equal(rowboatRules(target.settings).rowboatStepOutDepth, 1.1);
  assert.equal(rowboatRules(target.settings).rowboatsEnabled, false);
  p.fleet = [0, 5, ROWBOAT];
  act(w, p.id, { type: 'vehicle', slot: ROWBOAT, building: d.id });
  assert.equal(p.vehicle, ROWBOAT);
});
test('rowboat death preserves a recoverable hull or loses it under the world rule', () => {
  for (const lose of [false, true]) {
    const { w, p } = bankBoat();
    Object.assign(p, { x: 40, z: -40, inventory: { wood: 10 } });
    w.settings.loseBoatsOnDeath = lose;
    p.age = w.settings.maxAge + 1;
    advance(w, 0.1);
    assert.equal(p.deaths, 1);
    assert.equal(p.vehicle, 5);
    if (lose) {
      assert.ok(!p.fleet!.includes(ROWBOAT));
      assert.equal(w.boatRescues?.[p.id], undefined);
    } else {
      assert.equal(w.boatRescues![p.id].boat.slot, ROWBOAT);
      assert.equal(w.boatRescues![p.id].boat.paint, '');
      assert.equal(w.boatRescues![p.id].cargo.wood, 10);
    }
  }
});

import { createRowboat } from '../src/client/rowboat';
import * as T from 'three';
test('rowboat renders a finite clinker hull with stowed and moving oars and a human rower', () => {
  const boat = createRowboat();
  const initial = boat.oars.map((o) => o.rotation.y);
  let triangles = 0;
  boat.group.traverse((o) => {
    const m = o as T.Mesh;
    if (!m.isMesh) return;
    const a = m.geometry.getAttribute('position');
    for (let i = 0; i < a.count; i++) assert.ok(Number.isFinite(a.getX(i) + a.getY(i) + a.getZ(i)));
    triangles += (m.geometry.index?.count ?? a.count) / 3;
  });
  assert.ok(triangles < 20000);
  assert.ok(boat.group.userData.driver);
  boat.animate(1, 1.6, true);
  assert.notDeepEqual(
    boat.oars.map((o) => o.rotation.y),
    initial,
  );
  boat.animate(1, 0, false);
  assert.deepEqual(
    boat.oars.map((o) => o.rotation.y),
    initial,
  );
  assert.ok(boat.group.userData.eye.y > 1 && boat.group.userData.eye.y < 2);
});

test('rowboats cannot consume Fuel or carry themselves; recovery never pours fuel into a nonexistent tank', () => {
  const { w, p } = bankBoat();
  p.inventory.fuel = 2;
  const before = structuredClone(p);
  assert.throws(() => act(w, p.id, { type: 'use', item: 'fuel' }), /fuel|tank/i);
  assert.deepEqual(p, before);
  assert.throws(
    () => act(w, p.id, { type: 'canoe', operation: 'pickup', id: `${p.id}:${ROWBOAT}` }),
    /canoe|shore|stop|boat|hull/i,
  );
  assert.equal(p.carrying, undefined);
});
test('remote, moving, deeper and newly obstructed beached boats refuse access without mutation', () => {
  const { w, p } = bankBoat();
  p.speed = 0.6;
  assert.equal(boatLanding(w, p, true), undefined);
  p.speed = 0;
  p.x = 20;
  assert.equal(boatLanding(w, p, true), undefined);
  p.x = 2;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const bank = { x: p.x, z: p.z, y: p.y };
  p.x -= 30;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: ROWBOAT }), /moored|Visit/);
  Object.assign(p, bank);
  w.terrain.push({ x: 2, z: -40, radius: 3, height: 5 });
  w.revision++;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: ROWBOAT }), /moored|Visit/);
  assert.ok(w.mooredBoats![`${p.id}:${ROWBOAT}`]);
});
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
test('a rowboat can stop, leave and reboard at a real elevated riverbank without a dock', () => {
  const { w, p } = setup();
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  Object.assign(p, { vehicle: ROWBOAT, fleet: [0, 5, ROWBOAT], inventory: {}, speed: 0 });
  const river = w.northernIsland!.rivers[0],
    banks = riverBanks(river.points);
  let found = false;
  for (let i = 3; i < river.points.length - 3 && !found; i++)
    for (const side of ['left', 'right'] as const) {
      const center = river.points[i],
        bank = banks[i][side],
        length = Math.hypot(bank.x - center.x, bank.z - center.z),
        heading = Math.atan2(river.points[i + 1].x - center.x, river.points[i + 1].z - center.z);
      if (center.level < 5) continue;
      for (let inset = 0.8; inset < 4; inset += 0.2) {
        Object.assign(p, {
          x: bank.x + ((center.x - bank.x) / length) * inset,
          z: bank.z + ((center.z - bank.z) / length) * inset,
          heading,
          y: center.level,
        });
        if (boatLanding(w, p, true)?.beached) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
  assert.ok(found, 'generated river has a clear shallow boarding bank');
  const before = { x: p.x, z: p.z };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.ok(p.y > 5);
  act(w, p.id, { type: 'vehicle', slot: ROWBOAT });
  assert.deepEqual({ x: p.x, z: p.z }, before);
});
test('rocky gently sloping banks use the same beaching rules as sand', () => {
  const { w, p } = bankBoat(4);
  w.landscape!.surfaces = [
    { id: 'rock-bank', kind: 'gravel', x: 0, z: -40, width: 30, depth: 30, rotation: 0 } as any,
  ];
  assert.ok(boatLanding(w, p, true)?.beached);
  act(w, p.id, { type: 'vehicle', slot: 5 });
  act(w, p.id, { type: 'vehicle', slot: ROWBOAT });
  assert.equal(p.vehicle, ROWBOAT);
});

test('public pickup preserves an authored separate hold, cost basis and vehicle condition', () => {
  const { w, p } = bankBoat();
  w.settings.rowboatPublicPickup = true;
  w.vehicleTuning = { 36: { holdCapacity: 100, cargoKind: 'box' } };
  p.boatHold = { stone: 20 };
  p.boatHoldBasis = { stone: 12000 };
  p.fleetState = { 36: { acquiredAt: 0, metres: 100, condition: 70 } };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const q = addPlayer(w, 'q', 'Other');
  Object.assign(q, { x: p.x, z: p.z, y: p.y, vehicle: 5, inventory: {}, online: true });
  p.x -= 20;
  act(w, q.id, { type: 'vehicle', slot: 36, owner: p.id });
  assert.deepEqual(q.boatHold, { stone: 20 });
  assert.deepEqual(q.boatHoldBasis, { stone: 12000 });
  assert.equal(q.fleetState![36].condition, 70);
});

test('a stored rowboat cannot be summoned to another rower’s temporary bank landing', () => {
  const { w, p } = bankBoat();
  const d = boatLanding(w, p, true)!;
  const q = addPlayer(w, 'q', 'Other rower');
  Object.assign(q, d.land, {
    vehicle: 5,
    fleet: [0, 5, 36],
    inventory: {},
    y: travelHeight(w, d.land.x, d.land.z),
    online: true,
  });
  // The boat is close enough for a passenger, but it is not this player's mooring.
  p.online = false;
  assert.throws(() => act(w, q.id, { type: 'vehicle', slot: 36 }), /moored|stored|bank|berth/i);
  assert.equal(q.vehicle, 5);
});

test('mooring preserves the rowboat’s catalogue finish instead of repainting the hull blue', () => {
  const { w, p } = bankBoat();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(w.mooredBoats![`${p.id}:36`].paint, '');
});

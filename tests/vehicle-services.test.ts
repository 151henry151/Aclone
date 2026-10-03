// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, move } from '../src/shared/simulation.ts';
import { vehicleRecord, repairStatus, mapAvailable } from '../src/shared/vehicle-services.ts';
import { prepareFrame } from '../src/server/snapshots.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('vehicles', 'Vehicles', 'a');
  const a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo');
  a.online = b.online = true;
  a.x = b.x = 0;
  a.z = b.z = 0;
  a.y = b.y = 0;
  a.cash = 100000;
  a.inventory = { steel: 5, tools: 1 };
  a.skills = ['mechanic'];
  const garage = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [garage];
  vehicleRecord(w, b).condition = 40;
  return { w, a, b, garage };
}
test('roadside mechanic consumes parts, retains tools, caps repair and persists per vehicle', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'repairVehicle', player: b.id });
  assert.equal(vehicleRecord(w, b).condition, 65);
  assert.equal(a.inventory.steel, 4);
  assert.equal(a.inventory.tools, 1);
  b.vehicle = 1;
  assert.equal(vehicleRecord(w, b).condition, 100);
  b.vehicle = 0;
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.players.b.fleetState?.[0].condition, 65);
  } finally {
    store.close();
  }
});
test('garage service transfers labour revenue, consumes carried parts, and never double charges', () => {
  const { w, a, garage } = setup();
  vehicleRecord(w, a).condition = 99;
  const before = a.cash,
    investment = garage.investment;
  act(w, a.id, { type: 'serviceVehicle', building: garage.id });
  assert.equal(vehicleRecord(w, a).condition, 100);
  assert.equal(a.inventory.steel, 4);
  assert.equal(before - a.cash, 1000);
  assert.equal(garage.investment - investment, 1000);
  const json = JSON.stringify(w);
  assert.throws(() => act(w, a.id, { type: 'serviceVehicle', building: garage.id }), /condition/);
  assert.equal(JSON.stringify(w), json);
});
test('unsafe or unqualified repairs are atomic; public hints cannot authorize them', () => {
  const changes = [
    (a: any, b: any) => (a.skills = []),
    (a: any, b: any) => (a.inventory.steel = 0),
    (a: any, b: any) => (a.inventory.tools = 0),
    (a: any, b: any) => (b.x = 15),
    (a: any, b: any) => (b.online = false),
    (a: any, b: any) => (b.speed = 1),
    (a: any, b: any) => (b.atHome = true),
    (a: any, b: any) => (b.task = { kind: 'labour', end: 10 }),
    (a: any, b: any) => (a.hitch = b.id),
    (a: any, b: any) => (b.vehicle = 5),
  ];
  for (const change of changes) {
    const { w, a, b } = setup();
    change(a, b);
    const before = JSON.stringify(w);
    assert.throws(() => act(w, a.id, { type: 'repairVehicle', player: b.id }));
    assert.equal(JSON.stringify(w), before);
  }
});
test('wear tracks actual distance only and is bounded without blocking a stranded vehicle', () => {
  const { w, a } = setup();
  w.buildings = [];
  a.z = 0;
  a.x = 0;
  a.engine = true;
  a.fuel = 64;
  const before = vehicleRecord(w, a).condition;
  for (let i = 0; i < 100; i++) move(w, a, { throttle: 1, steer: 0, boost: false }, 0.05);
  assert.ok(vehicleRecord(w, a).metres > 20);
  assert.ok(vehicleRecord(w, a).condition < before);
  const distance = vehicleRecord(w, a).metres;
  a.atHome = true;
  move(w, a, { throttle: 1, steer: 0, boost: false }, 60);
  assert.equal(vehicleRecord(w, a).metres, distance);
  a.atHome = false;
  vehicleRecord(w, a).condition = 0;
  a.speed = 0;
  move(w, a, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.ok(a.speed > 0);
});
test('licences are optional, enforce tuned modes before purchase and movement; basic tractor stays free', () => {
  const { w, a, garage } = setup();
  a.cash = 2000000;
  w.settings.vehicleLicences = true;
  const before = JSON.stringify(w);
  assert.throws(() => act(w, a.id, { type: 'vehicle', slot: 2, building: garage.id }), /pilot/);
  assert.equal(JSON.stringify(w), before);
  a.skills.push('pilot');
  act(w, a.id, { type: 'vehicle', slot: 2, building: garage.id });
  a.skills = [];
  a.speed = 5;
  move(w, a, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.equal(a.speed, 0);
  act(w, a.id, { type: 'vehicle', slot: 0 });
  assert.equal(a.vehicle, 0);
});
test('opt-in maps are sold at garages and public assistance reveals no private fleet history', () => {
  const { w, a, b, garage } = setup();
  assert.equal(mapAvailable(w, a), true);
  w.settings.requireMapItem = true;
  assert.equal(mapAvailable(w, a), false);
  act(w, a.id, { type: 'buyMap', building: garage.id });
  assert.equal(mapAvailable(w, a), true);
  const visible = JSON.parse(prepareFrame(w).players.b);
  assert.equal(visible.fleetState, undefined);
  assert.equal(visible.canReceiveRepair, true);
  assert.equal(repairStatus(w, a, visible, true).reason, undefined);
});

test('wear cannot mutate a shallow prediction snapshot and disabling wear preserves condition', () => {
  const { w, a } = setup();
  w.buildings = [];
  vehicleRecord(w, a).condition = 50;
  const predicted = { ...a };
  move(w, predicted, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.equal(vehicleRecord(w, a).condition, 50);
  assert.ok(vehicleRecord(w, predicted).condition < 50);
  w.settings.vehicleMaintenance = false;
  const old = vehicleRecord(w, a).condition;
  move(w, a, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.equal(vehicleRecord(w, a).condition, old);
});
test('passenger panel actions reject unavailable drivers and allow disembarking', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'hitch', player: b.id });
  assert.equal(a.hitch, b.id);
  act(w, a.id, { type: 'detach' });
  assert.equal(a.hitch, undefined);
  for (const field of ['atHome', 'task', 'online'] as const) {
    b.atHome = false;
    b.task = undefined;
    b.online = true;
    if (field === 'task') b.task = { kind: 'labour', end: 20 };
    else b[field] = field === 'atHome';
    assert.throws(() => act(w, a.id, { type: 'hitch', player: b.id }));
  }
});

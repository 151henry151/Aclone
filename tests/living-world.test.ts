// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  advance,
  act,
  makeBuilding,
  move,
} from '../src/shared/simulation.ts';
import { advanceClimate, eveningLights, roadConditions } from '../src/shared/environment.ts';
import { shelter } from '../src/shared/lodging.ts';

test('offline residents keep smoke and consume stored provisions without offline death', () => {
  const w = createWorld('living', 'Living', 'p'),
    p = addPlayer(w, 'p', 'Resident');
  const b = w.buildings.find((b) => b.kind === 'home')!;
  b.owner = p.id;
  p.home = b.id;
  p.atHome = true;
  p.online = false;
  p.hunger = p.thirst = 31000;
  b.stock = { bread: 10, water: 10 };
  advance(w, 600);
  assert.equal(b.smoking, true);
  assert.ok(b.stock.bread < 10);
  assert.ok(b.stock.water < 10);
  b.stock = {};
  const health = p.health,
    age = p.age;
  advance(w, 86400);
  assert.equal(p.health, health);
  assert.equal(p.age, age);
  assert.equal(p.atHome, true);
});
test('lodging charges once, isolates guest stores, survives JSON and expires safely', () => {
  let w = createWorld('inn', 'Inn', 'o');
  const o = addPlayer(w, 'o', 'Keeper'),
    p = addPlayer(w, 'p', 'Guest'),
    q = addPlayer(w, 'q', 'Other');
  const b = makeBuilding('inn', 'bnb', 0, 17);
  b.owner = o.id;
  w.buildings.push(b);
  o.skills.push('innkeeper');
  act(w, o.id, { type: 'lodging', building: b.id, operation: 'configure', rate: 600, open: true });
  const cash = p.cash;
  act(w, p.id, { type: 'lodging', building: b.id, operation: 'rent', hours: 2 });
  assert.equal(p.cash, cash - 1200);
  assert.equal(b.investment, 1200);
  p.inventory.bread = 8;
  act(w, p.id, {
    type: 'lodging',
    building: b.id,
    operation: 'store',
    item: 'bread',
    quantity: 5,
    direction: 'deposit',
  });
  assert.throws(() =>
    act(w, q.id, {
      type: 'lodging',
      building: b.id,
      operation: 'store',
      item: 'bread',
      quantity: 1,
      direction: 'withdraw',
    }),
  );
  act(w, p.id, { type: 'home', building: b.id });
  p.online = false;
  p.hunger = 40000;
  w = JSON.parse(JSON.stringify(w));
  advance(w, 600);
  assert.equal(w.buildings.at(-1)!.smoking, true);
  assert.ok(shelter(w, w.players.p));
  assert.ok(w.buildings.at(-1)!.lodging!.guests.p.stock.bread < 5);
  advance(w, 7200);
  assert.equal(w.players.p.atHome, false);
  assert.ok(w.buildings.at(-1)!.lodging!.guests.p, 'unconsumed supplies survive checkout');
});
test('snow accumulation and thaw are chunk independent and reduce road speeds', () => {
  const a = createWorld('snow', 'Snow', 'o'),
    b = structuredClone(a);
  a.time = b.time = (350 - 59) * 600;
  advanceClimate(a, a.time, a.time + 18000);
  for (let i = 0; i < 18000; i += 60) advanceClimate(b, b.time + i, b.time + i + 60);
  assert.ok(Math.abs(a.climate!.snow - b.climate!.snow) < 1e-8);
  a.climate!.snow = 1;
  a.climate!.wetness = 1;
  assert.ok(roadConditions(a).speed < 0.8);
  const p = addPlayer(a, 'p', 'Snowdriver');
  a.buildings = [];
  p.x = 50;
  p.z = 0;
  for (let i = 0; i < 400; i++) move(a, p, { throttle: 1, steer: 0, boost: false }, 0.05);
  assert.ok(p.speed < 10);
});
test('evening schedules vary by home and day but never light empty homes or midday', () => {
  const w = createWorld('lights', 'Lights', 'p'),
    b = w.buildings.find((b) => b.kind === 'home')!;
  b.smoking = true;
  assert.equal(eveningLights(b, 43200, 80), false);
  assert.equal(eveningLights({ ...b, smoking: false }, 72000, 80), false);
  const outcomes = new Set(
    Array.from({ length: 50 }, (_, i) => eveningLights({ ...b, id: String(i) }, 81000, 80)),
  );
  assert.equal(outcomes.size, 2);
});
test('lodging cannot overbook, double-charge or demolish paid stays and stored supplies', () => {
  const w = createWorld('full', 'Full', 'o'),
    o = addPlayer(w, 'o', 'Owner');
  o.skills.push('innkeeper');
  const b = makeBuilding('rooms', 'bnb', 0, 17);
  b.owner = o.id;
  w.buildings = [b];
  act(w, o.id, { type: 'lodging', building: b.id, operation: 'configure', rate: 100, open: true });
  for (let i = 0; i < 3; i++) {
    const p = addPlayer(w, 'g' + i, 'Guest' + i);
    act(w, p.id, { type: 'lodging', building: b.id, operation: 'rent', hours: 1 });
  }
  const p = addPlayer(w, 'extra', 'Extra'),
    cash = p.cash;
  assert.throws(() =>
    act(w, p.id, { type: 'lodging', building: b.id, operation: 'rent', hours: 1 }),
  );
  assert.equal(p.cash, cash);
  assert.throws(() =>
    act(w, 'g0', { type: 'lodging', building: b.id, operation: 'rent', hours: 1 }),
  );
  assert.equal(b.investment, 300);
  assert.throws(() => act(w, o.id, { type: 'demolish', building: b.id }));
});
test('durable saves retain snow, guest provisions and depleted gathering grounds', async () => {
  const { Store } = await import('../src/server/store.ts');
  const s = new Store(':memory:');
  try {
    const w = createWorld('save', 'Save', 'p');
    const b = makeBuilding('inn', 'hotel', 0, 0);
    w.buildings.push(b);
    b.lodging = { open: true, rate: 600, guests: { p: { until: 3600, stock: { bread: 4 } } } };
    w.climate = { snow: 0.8, wetness: 0.2 };
    w.resources = { 'logs-1': { amount: 3, updated: 60 } };
    s.saveWorld(w);
    const loaded = s.loadWorlds()[0].world;
    assert.deepEqual(loaded.climate, w.climate);
    assert.deepEqual(loaded.resources, w.resources);
    assert.deepEqual(loaded.buildings.at(-1)!.lodging, b.lodging);
  } finally {
    s.close();
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { cropStatus, fertilizerPrice } from '../src/shared/farming.ts';
function setup() {
  const w = createWorld('f', 'Farm', 'o');
  const p = addPlayer(w, 'o', 'Farmer');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = p.id;
  b.investment = 100000;
  p.skills.push('farmer');
  p.x = b.x;
  p.z = b.z;
  return { w, p, b };
}
test('farms produce dated harvests, not automatic wheat; care and rotation affect yields', () => {
  const { w, p, b } = setup();
  b.stock = {};
  advance(w, 6000);
  assert.equal(b.stock.wheat, undefined);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' });
  const plot = b.plots![0];
  assert.ok(plot.ready > w.time);
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 }),
    /ripe/,
  );
  const base = cropStatus(w, b, 0).yield;
  p.inventory.water = 3;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'water', plot: 0 });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 });
  assert.ok(cropStatus(w, b, 0).yield >= base);
  advance(w, plot.ready - w.time);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  assert.equal(p.task?.kind, 'harvest');
  assert.equal(b.stock.wheat, undefined);
  advance(w, 15);
  assert.ok(b.stock.wheat > 0);
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 }),
    /empty/,
  );
});
test('offline catch-up gives the same bounded harvest and survives JSON reload', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 1, crop: 'potatoes' });
  const restored = JSON.parse(JSON.stringify(w));
  advance(w, 100000);
  for (let i = 0; i < 100; i++) advance(restored, 1000);
  assert.deepEqual(
    cropStatus(w, b, 1),
    cropStatus(
      restored,
      restored.buildings.find((v: any) => v.id === b.id),
      1,
    ),
  );
  assert.ok(cropStatus(w, b, 1).yield > 0);
});
test('invalid crops, permissions, season and storage cannot consume seed or duplicate harvest', () => {
  const { w, p, b } = setup();
  const money = b.investment;
  assert.throws(() =>
    act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'bogus' }),
  );
  assert.equal(b.investment, money);
  p.x += 100;
  assert.throws(() =>
    act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' }),
  );
  p.x = b.x;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' });
  advance(w, b.plots![0].ready - w.time);
  b.stock.wheat = b.capacity;
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 }),
    /stockroom/,
  );
  assert.ok(b.plots![0].crop);
});

test('harvest work reserves the plot, completes offline once, and releases on failed storage', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' });
  advance(w, b.plots![0].ready - w.time);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  const q = addPlayer(w, 'worker', 'Worker');
  q.skills = ['farmer'];
  q.x = b.x;
  q.z = b.z;
  b.employees.push(q.id);
  assert.throws(
    () => act(w, q.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 }),
    /harvest/,
  );
  b.stock.wheat = b.capacity;
  p.online = false;
  advance(w, 15);
  assert.equal(b.stock.wheat, b.capacity);
  assert.ok(b.plots![0].crop);
  assert.equal(b.plots![0].harvest, undefined);
  b.stock.wheat = 0;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  advance(w, 15);
  const units = b.stock.wheat;
  advance(w, 15);
  assert.equal(b.stock.wheat, units);
});

test('gravel drainage and compost/topsoil amendments consume real resources and survive harvest', () => {
  const w = createWorld('soil', 'Soil', 'p'),
    p = addPlayer(w, 'p', 'Farmer'),
    b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = p.id;
  p.skills = ['farmer'];
  p.x = b.x;
  p.z = b.z;
  b.investment = 10000;
  b.plots = [{ planted: 0, ready: 0, water: 0, fertilized: false, previous: 'potatoes' }];
  p.inventory = { gravel: 6, dirt: 6, compost: 2 };
  act(w, p.id, { type: 'farm', building: b.id, plot: 0, operation: 'drain' });
  act(w, p.id, { type: 'farm', building: b.id, plot: 0, operation: 'improve' });
  assert.equal(p.inventory.gravel, 0);
  assert.equal(p.inventory.dirt, 0);
  assert.equal(b.plots[0].previous, undefined);
  act(w, p.id, { type: 'farm', building: b.id, plot: 0, operation: 'plant', crop: 'wheat' });
  act(w, p.id, { type: 'farm', building: b.id, plot: 0, operation: 'fertilize' });
  assert.equal(p.inventory.compost, 0);
  assert.equal(b.plots[0].drainage, true);
  advance(w, b.plots[0].ready - w.time);
  act(w, p.id, { type: 'farm', building: b.id, plot: 0, operation: 'harvest' });
  advance(w, 15);
  assert.equal(b.plots[0].drainage, true);
});

test('fallback fertilizer uses the import quote while carried local compost avoids that expense', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 0, crop: 'wheat' });
  const cash = b.investment;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 });
  assert.equal(b.investment, cash - fertilizerPrice);
  assert.equal(w.ledger.at(-1)!.amount, fertilizerPrice);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', plot: 1, crop: 'wheat' });
  const beforeCompost = b.investment;
  p.inventory.compost = 1;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 1 });
  assert.equal(b.investment, beforeCompost);
  assert.equal(p.inventory.compost, 0);
});

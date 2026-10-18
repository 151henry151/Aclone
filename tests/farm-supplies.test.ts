// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';

const setup = () => {
  const w = createWorld('test', 'Test', 'server');
  const p = addPlayer(w, 'resident', 'Resident');
  return { w, p };
};

test('farm employees use stockroom care materials first, with atomic checks and no withdrawal permission', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  Object.assign(p, { x: b.x, z: b.z, skills: ['farmer'], inventory: { water: 4 } });
  b.employees = [p.id];
  b.investment = 100000;
  b.stock = { water: 5, compost: 1, dirt: 6, gravel: 6 };
  act(w, p.id, { type: 'farm', building: b.id, operation: 'plant', crop: 'wheat', plot: 0 });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'water', plot: 0 });
  assert.equal(b.stock.water, 2);
  assert.equal(p.inventory.water, 4);
  act(w, p.id, { type: 'farm', building: b.id, operation: 'water', plot: 0 });
  assert.equal(b.stock.water, 0);
  assert.equal(p.inventory.water, 3);
  const capital = b.investment;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 });
  assert.equal(b.stock.compost, 0);
  assert.equal(b.investment, capital);
  b.plots![1] = { planted: 0, ready: 0, water: 0, fertilized: false };
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'improve', plot: 1 }),
    /compost/,
  );
  assert.equal(b.stock.dirt, 6);
  b.stock.compost = 1;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'improve', plot: 1 });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'drain', plot: 1 });
  assert.equal(b.stock.dirt, 0);
  assert.equal(b.stock.gravel, 0);
  assert.equal(b.stock.compost, 0);
  b.employees = [];
  b.stock.water = 3;
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'water', plot: 0 }),
    /Only the farmer/,
  );
  assert.equal(b.stock.water, 3);
});

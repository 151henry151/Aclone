// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { crops, fertilizerPrice } from '../src/shared/farming';
import { farmStaffBlocker, farmStaffSpent } from '../src/shared/farm-policy';
import { DAY_SECONDS } from '../src/shared/environment';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('f', 'Farm', 'owner'),
    owner = addPlayer(w, 'owner', 'Owner'),
    staff = addPlayer(w, 'staff', 'Staff');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = owner.id;
  b.investment = 100000;
  b.stock = {};
  b.employees = [staff.id];
  for (const p of [owner, staff]) {
    p.x = b.x;
    p.z = b.z;
    p.skills = ['farmer'];
    p.inventory = {};
  }
  const rule = (policy: unknown, id = owner.id) =>
    act(w, id, { type: 'farm', building: b.id, operation: 'policy', policy });
  const plant = (plot: number, crop = 'wheat', id = staff.id) =>
    act(w, id, { type: 'farm', building: b.id, operation: 'plant', plot, crop });
  return { w, b, owner, staff, rule, plant };
}
test('owner crop choices and shared daily staff budget prevent unapproved planting without losing money', () => {
  const { w, b, owner, staff, rule, plant } = setup();
  rule({ crops: ['wheat'], dailyLimit: crops.wheat.seed, reserve: 0 });
  assert.throws(() => plant(0, 'potatoes'), /approved/);
  assert.equal(b.investment, 100000);
  plant(0);
  const after = b.investment;
  assert.throws(() => plant(1), /budget/);
  assert.equal(b.investment, after);
  assert.equal(farmStaffSpent(w, b), crops.wheat.seed);
  plant(1, 'potatoes', owner.id);
  assert.equal(farmStaffSpent(w, b), crops.wheat.seed);
  w.time += DAY_SECONDS;
  plant(2);
  assert.equal(farmStaffSpent(w, b), crops.wheat.seed);
  assert.throws(() => rule({ crops: [], reserve: 0 }, staff.id), /owner/);
  const before = JSON.stringify(w);
  assert.throws(() => rule({ crops: ['bogus'], reserve: 0 }));
  assert.equal(JSON.stringify(w), before);
});
test('cash reserve and fertilizer budget are enforced but stocked compost and harvest remain usable', () => {
  const { w, b, staff, rule, plant } = setup();
  rule({ crops: ['wheat'], reserve: b.investment - crops.wheat.seed + 1 });
  assert.throws(() => plant(0), /reserve/);
  rule({ crops: ['wheat'], dailyLimit: crops.wheat.seed, reserve: 0 });
  plant(0);
  const fertilize = () =>
    act(w, staff.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 });
  assert.throws(fertilize, /budget/);
  assert.equal(b.plots![0].fertilized, false);
  b.stock.compost = 1;
  fertilize();
  assert.equal(b.stock.compost, 0);
  rule({ crops: [], dailyLimit: 0, reserve: b.investment });
  assert.throws(() => plant(1), /approved/);
  w.time = b.plots![0].ready;
  act(w, staff.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  assert.equal(staff.task?.kind, 'harvest');
});
test('staff limits survive saves, design export retains policy but does not copy spent budget', () => {
  const { w, b, staff, rule, plant } = setup();
  rule({ crops: ['wheat'], dailyLimit: 10000, reserve: 100 });
  plant(0);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    assert.deepEqual(
      restored.buildings.find((o) => o.id === b.id)!.farmStaffSpending,
      b.farmStaffSpending,
    );
  } finally {
    store.close();
  }
  const other = createWorld('copy', 'Copy', 'owner');
  applyDesign(other, exportDesign(w));
  const copy = other.buildings.find((o) => o.id === b.id)!;
  assert.deepEqual(copy.farmPolicy, b.farmPolicy);
  assert.equal(copy.farmStaffSpending, undefined);
  rule(null);
  assert.equal(farmStaffBlocker(w, staff, b, fertilizerPrice, 'potatoes'), undefined);
});

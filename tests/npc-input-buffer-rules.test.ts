// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import {
  inputStockTarget,
  procurementTarget,
  procurementDraw,
  productionBudget,
  ownerBidRoutine,
} from '../src/server/npc/business-policy';
import { businessEstimate } from '../src/server/npc/enterprise';
import { accounts } from '../src/shared/reports';
import { operationAction } from '../src/server/npc/player-operations';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = {
  npcInputReserveBatches: 6,
  npcInputMaximumBatches: 24,
  npcInputSalesHours: 2,
  npcOutputCapacityShare: 0.75,
  npcOutputMinimumBatches: 12,
  npcOutputBufferMultiplier: 2,
};
function setup() {
  const w = createWorld('input-buffers', 'Input buffers', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('bakery', 'bakery', 0, 0),
    supplier = makeBuilding('mill', 'mill', 20, 0);
  b.owner = p.id;
  b.capacity = 100;
  b.stock = { flour: 0, bread: 0 };
  b.buy = { flour: 100 };
  b.sell = { bread: 4000 };
  b.wage = 100;
  b.investment = 100000;
  b.production = {
    skill: 'baker',
    seconds: 600,
    tier: 1,
    inputs: { flour: 2 },
    outputs: { bread: 3 },
  };
  supplier.stock = { flour: 500 };
  supplier.sell = { flour: 100 };
  w.buildings = [b, supplier];
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    ownerOperation: false,
    activeWork: false,
  });
  Object.assign(p, { x: 0, z: 0, cash: 100000, inventory: {}, hunger: 0, thirst: 0, fuel: 100 });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, b, supplier, edit };
}
test('input buffer defaults and absent keys preserve exact batch and backlog targets', () => {
  const { w, b } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(inputStockTarget(b, 'flour', w), 12);
  assert.equal(inputStockTarget(b, 'flour'), 12);
  b.stock.bread = 35;
  assert.equal(inputStockTarget(b, 'flour', w), 12);
  b.stock.bread = 36;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  b.stock.bread = 0;
  accounts(w, b).sold.bread = 120;
  w.time += 3600;
  assert.equal(inputStockTarget(b, 'flour', w), 48);
  b.stock.bread = 75;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
});
test('changed reserve ceiling sales hours and output cutoffs control real input targets', () => {
  const { w, b } = setup();
  Object.assign(w.settings, {
    npcInputReserveBatches: 2,
    npcInputMaximumBatches: 4,
    npcInputSalesHours: 0.5,
    npcOutputCapacityShare: 1,
    npcOutputMinimumBatches: 1,
    npcOutputBufferMultiplier: 1,
  });
  assert.equal(inputStockTarget(b, 'flour', w), 4);
  accounts(w, b).sold.bread = 18;
  w.time += 3600;
  assert.equal(inputStockTarget(b, 'flour', w), 6);
  b.accounts!.sold.bread = 120;
  assert.equal(inputStockTarget(b, 'flour', w), 8);
  b.stock.bread = 11;
  assert.equal(inputStockTarget(b, 'flour', w), 8);
  b.stock.bread = 12;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  Object.assign(w.settings, { npcOutputMinimumBatches: 6 });
  assert.equal(inputStockTarget(b, 'flour', w), 8);
  Object.assign(w.settings, { npcOutputCapacityShare: 0.05 });
  b.stock.bread = 5;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  b.stock.bread = 0;
  Object.assign(w.settings, { npcInputSalesHours: 0 });
  assert.equal(inputStockTarget(b, 'flour', w), 4);
});
test('zero budgets and physical room bound stock targets without inventing stock or changing farm recipes', () => {
  const { w, b } = setup();
  Object.assign(w.settings, { npcInputReserveBatches: 0, npcInputMaximumBatches: 0 });
  const before = JSON.stringify(b);
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  assert.equal(JSON.stringify(b), before);
  Object.assign(w.settings, {
    npcInputReserveBatches: 6,
    npcInputMaximumBatches: 24,
    npcOutputCapacityShare: 0,
  });
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  Object.assign(w.settings, { npcOutputCapacityShare: 1, npcOutputMinimumBatches: 1000 });
  b.capacity = 10;
  b.stock.bread = 8;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  b.stock.bread = 0;
  assert.equal(inputStockTarget(b, 'flour', w), 6);
  b.production!.inputs.flour = 20;
  assert.equal(inputStockTarget(b, 'flour', w), 10);
  b.kind = 'farm';
  assert.equal(inputStockTarget(b, 'flour', w), undefined);
});
test('input rules change production acquisition and procurement budgets but leave payroll and breeding requirements intact', () => {
  const { w, p, b } = setup();
  const original = productionBudget(w, b)!,
    acquisition = businessEstimate(w, b)!;
  assert.equal(original.reserve, 1200 + original.idealWorkers * 100 * 6);
  assert.equal(acquisition.reserve, (acquisition.inputs + acquisition.wages) * 6);
  Object.assign(w.settings, { npcInputReserveBatches: 2 });
  const changed = productionBudget(w, b)!,
    quote = businessEstimate(w, b)!;
  assert.equal(changed.reserve, original.reserve - 800);
  assert.equal(quote.reserve, acquisition.reserve - acquisition.inputs * 4);
  p.cash = 0;
  assert.equal(procurementDraw(w, p, b, 'flour', 4, 100), 400);
  assert.equal(procurementDraw(w, p, b, 'flour', 5, 100), undefined);
  const dairy = makeBuilding('dairy', 'dairy', 0, 0);
  dairy.stock = { cows: 2 };
  w.buildings.push(dairy);
  const cows = procurementTarget(w, dairy, 'cows'),
    water = procurementTarget(w, dairy, 'water');
  assert.ok(cows > 0 && water > 0);
  Object.assign(w.settings, { npcInputReserveBatches: 0 });
  assert.equal(procurementTarget(w, dairy, 'cows'), cows);
  assert.equal(procurementTarget(w, dairy, 'water'), 0);
});
test('ordinary owner bid pause and reopen follow the changed target and preserve stock and cash', () => {
  const { w, p, b } = setup();
  b.stock.flour = 4;
  Object.assign(w.settings, { npcInputReserveBatches: 2 });
  const state = { plan: [], index: 0 } as unknown as ResidentState;
  const before = p.cash + b.investment;
  const run = () => {
    for (const s of ownerBidRoutine(w, p, state))
      if (s.kind === 'operation') act(w, p.id, operationAction(s));
      else if (s.kind === 'act') act(w, p.id, s.action);
  };
  run();
  assert.equal(b.buy.flour, undefined);
  assert.equal(b.pausedPrices?.buy?.flour, 100);
  assert.equal(b.stock.flour, 4);
  Object.assign(w.settings, { npcInputReserveBatches: 6 });
  run();
  assert.ok(b.buy.flour > 0);
  assert.equal(p.cash + b.investment, before);
  assert.equal(b.stock.flour, 4);
});
test('business input rules validate atomic pairs and persist through editor summaries designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcInputReserveBatches: 25 },
    { npcInputMaximumBatches: 5 },
    { npcInputReserveBatches: 1.5 },
    { npcInputMaximumBatches: 1001 },
    { npcInputSalesHours: -1 },
    { npcInputSalesHours: 169 },
    { npcOutputCapacityShare: 1.1 },
    { npcOutputMinimumBatches: 0.5 },
    { npcOutputBufferMultiplier: 11 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({
    npcInputReserveBatches: 2,
    npcInputMaximumBatches: 7,
    npcInputSalesHours: 3.5,
    npcOutputCapacityShare: 0.5,
    npcOutputMinimumBatches: 19,
    npcOutputBufferMultiplier: 1.5,
  });
  for (const v of ['3.5', '19', '1.5']) assert.ok(rulesSummary(w).includes(v));
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const k of Object.keys(defaults)) {
      assert.equal((dest.settings as any)[k], (w.settings as any)[k]);
      assert.equal((loaded.settings as any)[k], (w.settings as any)[k]);
    }
  } finally {
    store.close();
  }
});

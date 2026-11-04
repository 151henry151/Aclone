// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import {
  productionBudget,
  retainedCapital,
  ownerBidRoutine,
  ownerStaffingRoutine,
} from '../src/server/npc/business-policy';
import { businessEstimate } from '../src/server/npc/enterprise';
import { economyChoices } from '../src/server/npc/economy-choices';
import { constructionBudget } from '../src/server/npc/construction-projects';
import { hayMerchantChoices } from '../src/server/npc/hay-merchant';
import { checkOwnerCapitalAction } from '../src/server/npc/execution';
import { propertyQuote } from '../src/shared/property';
import { buildings } from '../src/shared/catalog';
import type { ResidentState } from '../src/server/npc/memory';
import type { Step } from '../src/server/npc/decision';
import { Store } from '../src/server/store';
const defaults = {
  npcPayrollReserveBatches: 6,
  npcMinimumPayrolls: 3,
  npcBusinessCashFloor: 2000,
  npcStartupBatches: 3,
  npcStartupMaterialMultiplier: 1.1,
  npcHayReserveItems: 40,
  npcHayCustomerStockLimit: 40,
  npcHayCustomerFundedItems: 10,
};
function setup() {
  const w = createWorld('capital', 'Capital', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('bakery', 'bakery', 0, 0),
    supplier = makeBuilding('mill', 'mill', 20, 0);
  b.owner = p.id;
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
  w.towns = [];
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    ownerOperation: false,
    activeWork: false,
  });
  Object.assign(p, { x: 0, z: 0, cash: 100000, inventory: {}, hunger: 0, thirst: 0, fuel: 100 });
  return {
    w,
    p,
    b,
    supplier,
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
function hay() {
  const { w, p } = setup(),
    b = makeBuilding('barn', 'haybarn', 0, 0),
    farm = makeBuilding('farm', 'farm', 20, 0),
    dairy = makeBuilding('dairy', 'dairy', 40, 0);
  b.owner = p.id;
  b.stock = { hay: 0 };
  b.buy = { hay: 100 };
  b.sell = { hay: 200 };
  b.investment = 0;
  farm.stock = { hay: 100 };
  farm.sell = { hay: 100 };
  dairy.stock = { cows: 2, hay: 0 };
  dairy.buy = { hay: 300 };
  dairy.investment = 3000;
  w.buildings = [b, farm, dairy];
  return { w, p, b, farm, dairy };
}
const acts = (plan: Step[]) => plan.flatMap((s) => (s.kind === 'act' ? [s.action] : []));
test('working-capital defaults and absent keys preserve exact payroll cash and hay reserves', () => {
  const { w, b } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  const budget = productionBudget(w, b)!,
    quote = businessEstimate(w, b)!;
  assert.equal(budget.reserve, 1200 + budget.idealWorkers * 100 * 6);
  assert.equal(quote.reserve, (quote.inputs + quote.wages) * 6);
  const market = makeBuilding('market', 'market', 0, 0);
  market.wage = 1000;
  assert.equal(retainedCapital(w, market), 3000);
  market.wage = 100;
  assert.equal(retainedCapital(w, market), 2000);
  const barn = makeBuilding('barn', 'haybarn', 0, 0);
  barn.buy.hay = 100;
  assert.equal(retainedCapital(w, barn), 4000);
});
test('payroll reserve and cash floor changes affect real budgets and preserve investor claims at zero', () => {
  const { w, p, b } = setup();
  Object.assign(w.settings, {
    npcPayrollReserveBatches: 2,
    npcMinimumPayrolls: 4,
    npcBusinessCashFloor: 123,
  });
  const budget = productionBudget(w, b)!,
    quote = businessEstimate(w, b)!;
  assert.equal(budget.reserve, 1200 + budget.idealWorkers * 200);
  assert.equal(quote.reserve, quote.inputs * 6 + quote.wages * 2);
  const market = makeBuilding('market', 'market', 0, 0);
  market.owner = p.id;
  market.wage = 1000;
  market.investment = 5000;
  market.buy = {};
  w.buildings = [market];
  assert.equal(retainedCapital(w, market), 4000);
  market.wage = 1;
  assert.equal(retainedCapital(w, market), 123);
  Object.assign(w.settings, { npcMinimumPayrolls: 0, npcBusinessCashFloor: 0 });
  assert.equal(retainedCapital(w, market), 0);
  market.stakes = [
    { investor: 'other', principal: 1000, claim: 1080, paid: 0, opened: w.time, termsVersion: 1 },
  ];
  const draw = {
    type: 'investment' as const,
    building: market.id,
    direction: 'withdraw' as const,
    amount: 3920,
  };
  assert.doesNotThrow(() => checkOwnerCapitalAction(w, p, draw));
  assert.throws(() => checkOwnerCapitalAction(w, p, { ...draw, amount: 3921 }), /reserves changed/);
  const total = p.cash + market.investment;
  act(w, p.id, draw);
  assert.equal(market.investment, 1080);
  assert.equal(p.cash + market.investment, total);
});
test('minimum payroll funding governs new bids and the funded peer-wage reference', () => {
  const { w, p, b, supplier } = setup();
  p.cash = 0;
  b.buy = {};
  const state = { plan: [], index: 0 } as unknown as ResidentState;
  assert.ok(
    ownerBidRoutine(w, p, state).some(
      (s) => s.kind === 'operation' && s.operation === 'buildingAdmin',
    ),
  );
  Object.assign(w.settings, { npcMinimumPayrolls: 1000 });
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  b.buy = { flour: 100 };
  b.investment = 1000000;
  supplier.kind = 'bakery';
  supplier.production = b.production;
  supplier.wage = 10000;
  supplier.investment = 20000;
  const wage = () =>
    ownerStaffingRoutine(w, p).flatMap((s) =>
      s.kind === 'operation' && s.operation === 'buildingAdmin'
        ? s.parameters.filter((v) => v.name === 'wage').map((v) => Number(v.value))
        : [],
    )[0];
  Object.assign(w.settings, { npcMinimumPayrolls: 3 });
  const withoutPeer = wage();
  assert.ok(withoutPeer > 0);
  Object.assign(w.settings, { npcMinimumPayrolls: 2 });
  assert.ok(wage() > withoutPeer);
});
test('production reserve changes affordable purchase choices while ordinary markets remain excluded', () => {
  const { w, p } = setup(),
    shop = makeBuilding('shop', 'market', 0, 0);
  shop.price = 100;
  w.buildings = [shop];
  p.cash = propertyQuote(w, shop).total + 1000;
  const choices = () => {
    const steps: Step[] = [];
    economyChoices(
      w,
      p,
      w.buildings,
      (_d, plan) => steps.push(...plan),
      (_b, plan) => plan,
    );
    return acts(steps).filter((a) => a.type === 'buyBuilding');
  };
  assert.equal(choices().length, 0);
  shop.production = {
    skill: 'baker',
    seconds: 600,
    tier: 1,
    inputs: { flour: 1 },
    outputs: { bread: 1 },
  };
  shop.buy = { flour: 100 };
  shop.sell = { bread: 800 };
  shop.wage = 100;
  shop.stock = {};
  assert.equal(choices().length, 0);
  Object.assign(w.settings, { npcPayrollReserveBatches: 0 });
  assert.equal(choices().length, 1);
  assert.equal(shop.owner, undefined);
  delete shop.production;
  assert.equal(choices().length, 0);
});
test('startup operating batches and material contingency change estimates without changing construction prices', () => {
  const w = createWorld('build', 'Build', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    shop = w.buildings.find((b) => b.kind === 'market')!;
  Object.assign(p, { x: 80, z: -130, cash: 5000000, inventory: {}, fuel: 100 });
  for (const item of Object.keys(buildings.dairy.materials)) {
    shop.stock[item] = 100;
    shop.sell[item] = 100;
  }
  shop.stock.cows = 2;
  shop.sell.cows = 20000;
  const before = constructionBudget(w, p, 'dairy', p)!;
  assert.ok(before && before.operating > 0 && before.materialCost > 0);
  Object.assign(w.settings, { npcStartupBatches: 1, npcStartupMaterialMultiplier: 1.5 });
  const after = constructionBudget(w, p, 'dairy', p)!;
  assert.equal(after.operating, before.operating / 3);
  assert.equal(after.materialCost, before.materialCost);
  assert.equal(after.livestockCost, before.livestockCost);
  assert.equal(after.tax, before.tax);
  assert.equal(
    after.total - before.total,
    after.operating -
      before.operating +
      Math.ceil(before.materialCost * 1.5) -
      Math.ceil(before.materialCost * 1.1),
  );
  Object.assign(w.settings, { npcStartupBatches: 0, npcStartupMaterialMultiplier: 1 });
  const zero = constructionBudget(w, p, 'dairy', p)!;
  assert.equal(zero.operating, 0);
  assert.ok(zero.materialCost > 0 && zero.livestockCost > 0);
  assert.equal(p.cash, 5000000);
});
test('hay reserves customer thresholds and funding requirements affect real restocking choices', () => {
  const { w, p, b, dairy } = hay();
  const plans = () => hayMerchantChoices(w, p),
    quantity = () =>
      plans()
        .flatMap((c) => acts(c.plan))
        .filter((a) => a.type === 'trade')
        .find((a) => a.direction === 'buy');
  assert.equal(quantity()?.quantity, 40);
  Object.assign(w.settings, { npcHayReserveItems: 5, npcBusinessCashFloor: 0 });
  assert.equal(quantity()?.quantity, 5);
  assert.equal(retainedCapital(w, b), 500);
  const deposit = plans()
    .flatMap((c) => acts(c.plan))
    .find((a) => a.type === 'investment');
  assert.equal(deposit?.amount, 500);
  Object.assign(w.settings, { npcHayCustomerFundedItems: 11 });
  assert.equal(quantity(), undefined);
  Object.assign(w.settings, { npcHayCustomerFundedItems: 10, npcHayCustomerStockLimit: 3 });
  dairy.stock.hay = 3;
  assert.equal(quantity(), undefined);
  dairy.stock.hay = 2;
  assert.equal(quantity()?.quantity, 5);
  Object.assign(w.settings, { npcHayReserveItems: 0 });
  assert.equal(quantity(), undefined);
  assert.equal(retainedCapital(w, b), 0);
  assert.equal(b.stock.hay, 0);
});
test('hay restocking respects a reduced existing transaction limit and executes ordinary paid actions', () => {
  const { w, p, b, farm } = hay();
  act(w, p.id, { type: 'settings', patch: { transactionItemLimit: 3 } });
  const choice = hayMerchantChoices(w, p).find((c) =>
    acts(c.plan).some((a) => a.type === 'trade' && a.direction === 'buy'),
  )!;
  assert.ok(choice);
  const buy = acts(choice.plan).find((a) => a.type === 'trade')!;
  assert.equal(buy.quantity, 3);
  const cash = p.cash;
  for (const s of choice.plan) {
    if (s.kind === 'travel') {
      const dest = w.buildings.find((v) => v.id === s.destination)!;
      p.x = dest.x;
      p.z = dest.z;
    } else if (s.kind === 'act') act(w, p.id, s.action);
  }
  assert.equal(p.cash, cash - 300);
  assert.equal(farm.stock.hay, 97);
  assert.equal(b.stock.hay, 3);
  assert.equal(p.inventory.hay ?? 0, 0);
});
test('working-capital fields validate and persist through editor summaries designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcPayrollReserveBatches: -1 },
    { npcMinimumPayrolls: 1.5 },
    { npcBusinessCashFloor: 100000001 },
    { npcStartupBatches: 1001 },
    { npcStartupMaterialMultiplier: 0.99 },
    { npcStartupMaterialMultiplier: 10.1 },
    { npcHayReserveItems: 10001 },
    { npcHayCustomerStockLimit: -1 },
    { npcHayCustomerFundedItems: 0.5 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    npcPayrollReserveBatches: 2,
    npcMinimumPayrolls: 4,
    npcBusinessCashFloor: 123,
    npcStartupBatches: 1,
    npcStartupMaterialMultiplier: 1.5,
    npcHayReserveItems: 5,
    npcHayCustomerStockLimit: 3,
    npcHayCustomerFundedItems: 11,
  };
  edit(patch);
  for (const v of ['123', '1.5', '11']) assert.ok(rulesSummary(w).includes(v));
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const [k, v] of Object.entries(patch)) {
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
    }
  } finally {
    store.close();
  }
});

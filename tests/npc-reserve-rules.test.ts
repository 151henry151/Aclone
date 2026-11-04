// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, carry } from '../src/shared/simulation';
import { carePlan } from '../src/server/npc/care';
import { economyChoices } from '../src/server/npc/economy-choices';
import { portableReserve, canKeepFishing, strandedCargo } from '../src/server/npc/cargo';
import { cargoRelief } from '../src/server/npc/business-policy';
import { spareSupplies } from '../src/server/npc/strategy';
import type { Step } from '../src/server/npc/decision';
import { Store } from '../src/server/store';
const defaults = {
  npcCareCashFloor: 12000,
  npcBankCashFloor: 40000,
  npcBankDepositShare: 0.5,
  npcBankMinimumDeposit: 1000,
  npcPortableWater: 6,
  npcPortableBread: 3,
  npcPortableMinimum: 3,
  npcPortableMaximum: 12,
  npcPortableNutrition: 24000,
  npcPortableEquipment: 1,
  npcFishingSurplus: 3,
  npcTradeFoodReserve: 1,
  npcTradeDrinkReserve: 2,
};
function setup() {
  const w = createWorld('reserves', 'Reserves', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    bank = makeBuilding('bank', 'bank', 0, 0);
  w.buildings = [bank];
  w.resources = {};
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    npcBudgetNeedAllowance: 1000000,
    npcBudgetFuelThreshold: 0,
  });
  Object.assign(p, {
    x: 0,
    z: 0,
    fuel: 0,
    inventory: {},
    hunger: 30000,
    thirst: 0,
    cash: 100000,
    bank: 50000,
  });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, bank, edit };
}
const actions = (steps: Step[]) => steps.flatMap((s) => (s.kind === 'act' ? [s.action] : []));
function bankPlans(s: ReturnType<typeof setup>) {
  const steps: Step[] = [];
  economyChoices(
    s.w,
    s.p,
    s.w.buildings,
    (_d, plan) => steps.push(...plan),
    (_b, plan) => plan,
  );
  return actions(steps).filter((a) => a.type === 'bank');
}
test('resident cash and portable defaults including absent keys retain distinct trade reserves', () => {
  const s = setup(),
    { w, p } = s;
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(bankPlans(s).find((a) => a.direction === 'deposit')?.amount, 30000);
  p.cash = 1000;
  assert.equal(actions(carePlan(w, p)).find((a) => a.type === 'bank')?.amount, 11000);
  for (const [item, n] of Object.entries({
    water: 6,
    bread: 3,
    fish: 3,
    meals: 3,
    tools: 1,
    tackle: 1,
    fuel: 1,
    gravel: 0,
    missing: 0,
  }))
    assert.equal(portableReserve(item, w), n, item);
  p.inventory = { fish: 10, water: 10 };
  assert.equal(spareSupplies(p, 'fish', w), 9);
  assert.equal(spareSupplies(p, 'water', w), 8);
});
test('local cash floors and deposit share plan ordinary conserved transfers and respect caps', () => {
  const s = setup(),
    { w, p, edit } = s;
  edit({
    npcCareCashFloor: 1234,
    npcBankCashFloor: 20000,
    npcBankDepositShare: 0.25,
    npcBankMinimumDeposit: 1,
  });
  const total = p.cash + p.bank;
  const deposit = bankPlans(s).find((a) => a.direction === 'deposit')!;
  assert.equal(deposit.amount, 20000);
  act(w, p.id, deposit);
  assert.equal(p.cash, 80000);
  assert.equal(p.cash + p.bank, total);
  p.cash = 1000;
  const withdrawal = actions(carePlan(w, p)).find((a) => a.type === 'bank')!;
  assert.equal(withdrawal.amount, 234);
  const before = p.cash + p.bank;
  act(w, p.id, withdrawal);
  assert.equal(p.cash, 1234);
  assert.equal(p.cash + p.bank, before);
  edit({ cashTransferLimit: 10 });
  p.cash = 0;
  assert.equal(actions(carePlan(w, p)).find((a) => a.type === 'bank')?.amount, 10);
  assert.equal(bankPlans(s).find((a) => a.direction === 'withdraw')?.amount, 10);
  p.bank = 3;
  assert.equal(bankPlans(s).find((a) => a.direction === 'withdraw')?.amount, 3);
});
test('zero saving share minimum and floors never offer empty transfers or discard household protection', () => {
  const s = setup(),
    { w, p, edit } = s;
  edit({ npcBankDepositShare: 0, npcBankMinimumDeposit: 0 });
  assert.equal(bankPlans(s).filter((a) => a.direction === 'deposit').length, 0);
  edit({ npcBankDepositShare: 1, npcBankCashFloor: 0, npcCareCashFloor: 0 });
  p.cash = 0;
  assert.deepEqual(bankPlans(s), []);
  assert.ok(!actions(carePlan(w, p)).some((a) => a.type === 'bank'));
  p.cash = 1;
  assert.equal(bankPlans(s).find((a) => a.direction === 'deposit')?.amount, 1);
  edit({ npcBankMinimumDeposit: 2 });
  assert.ok(!bankPlans(s).some((a) => a.direction === 'deposit'));
  edit({ npcBudgetNeedAllowance: 0 });
  p.cash = 0;
  assert.ok(
    actions(carePlan(w, p)).some((a) => a.type === 'bank' && Number(a.amount) > 0),
    'computed meals override a zero floor',
  );
});
test('portable nutrient equipment and fishing reserves honor local values without changing trade defaults', () => {
  const { w, p, edit } = setup();
  edit({
    npcPortableWater: 2,
    npcPortableBread: 4,
    npcPortableMinimum: 1,
    npcPortableMaximum: 5,
    npcPortableNutrition: 20000,
    npcPortableEquipment: 2,
    npcFishingSurplus: 1,
    npcTradeFoodReserve: 4,
    npcTradeDrinkReserve: 3,
  });
  for (const [item, n] of Object.entries({
    water: 2,
    bread: 4,
    fish: 3,
    meals: 1,
    tools: 2,
    tackle: 2,
    fuel: 2,
    gravel: 0,
  }))
    assert.equal(portableReserve(item, w), n, item);
  p.inventory = { fish: 3 };
  assert.equal(canKeepFishing(w, p), true);
  p.inventory.fish = 4;
  assert.equal(canKeepFishing(w, p), false);
  p.inventory = { fish: 10, water: 10 };
  assert.equal(spareSupplies(p, 'fish', w), 6);
  assert.equal(spareSupplies(p, 'water', w), 7);
  edit({
    npcPortableMinimum: 0,
    npcPortableMaximum: 0,
    npcPortableNutrition: 0,
    npcFishingSurplus: 0,
    npcTradeFoodReserve: 0,
    npcTradeDrinkReserve: 0,
  });
  p.inventory = { fish: 0 };
  assert.equal(portableReserve('fish', w), 0);
  assert.equal(canKeepFishing(w, p), false);
  assert.equal(portableReserve('water', w), 2);
  p.inventory.fish = 1;
  assert.equal(spareSupplies(p, 'fish', w), 1);
});
test('small transaction rules bound recovery actions while keeping portable supplies and allowing walking', () => {
  const { w, p, edit } = setup();
  edit({ transactionItemLimit: 5 });
  w.buildings = [];
  p.inventory = { fish: 100, water: 2, tackle: 1 };
  p.fuel = 0;
  p.vehicle = 0;
  let rounds = 0;
  while (carry(p, w) > 60 && rounds++ < 30) {
    const plan = actions(strandedCargo(p, w));
    assert.ok(plan.length);
    for (const a of plan) {
      assert.ok('quantity' in a);
      assert.ok(Number(a.quantity) <= 5, 'recovery must obey the world transaction limit');
      act(w, p.id, a);
    }
  }
  assert.ok(carry(p, w) <= 60);
  assert.equal(p.inventory.water, 2);
  assert.equal(p.inventory.tackle, 1);
  assert.ok(p.inventory.fish >= portableReserve('fish', w));
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.vehicle, 5);
});
test('surplus unloading uses portable reserves and a bounded ordinary sale', () => {
  const { w, p, edit } = setup();
  edit({ npcPortableMinimum: 8, npcPortableMaximum: 8, transactionItemLimit: 5 });
  const buyer = makeBuilding('buyer', 'market', 0, 0);
  buyer.buy = { fish: 100 };
  buyer.stock = {};
  buyer.investment = 100000;
  w.buildings = [buyer];
  p.inventory = { fish: 20 };
  p.fuel = 20;
  const sale = actions(cargoRelief(w, p)).find((a) => a.type === 'trade')!;
  assert.equal(sale.quantity, 5);
  const cash = p.cash;
  act(w, p.id, sale);
  assert.equal(p.inventory.fish, 15);
  assert.ok(p.cash > cash);
  p.inventory.fish = 8;
  assert.deepEqual(cargoRelief(w, p), []);
});
test('cash and portable rules validate jointly and persist in editor summaries designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcCareCashFloor: -1 },
    { npcBankCashFloor: 100000001 },
    { npcBankMinimumDeposit: 1.5 },
    { npcBankDepositShare: 1.1 },
    { npcPortableMinimum: 13 },
    { npcPortableMaximum: 2 },
    { npcPortableBread: 101 },
    { npcFishingSurplus: -1 },
    { npcPortableNutrition: 1.5 },
    { npcTradeFoodReserve: 101 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({
    npcCareCashFloor: 1234,
    npcBankCashFloor: 5678,
    npcBankDepositShare: 0.25,
    npcBankMinimumDeposit: 9,
    npcPortableWater: 2,
    npcPortableBread: 4,
    npcPortableMinimum: 1,
    npcPortableMaximum: 5,
    npcPortableNutrition: 34567,
    npcPortableEquipment: 2,
    npcFishingSurplus: 1,
    npcTradeFoodReserve: 4,
    npcTradeDrinkReserve: 3,
  });
  for (const v of ['1234', '5678', '25', '34567']) assert.ok(rulesSummary(w).includes(v));
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
test('surplus sales obey a lowered existing transaction limit before new reserve settings', () => {
  const { w, p, edit } = setup();
  edit({ transactionItemLimit: 5 });
  const b = makeBuilding('buyer', 'market', 0, 0);
  b.buy = { fish: 100 };
  b.stock = {};
  b.investment = 100000;
  w.buildings = [b];
  p.inventory = { fish: 30 };
  const sale = actions(cargoRelief(w, p)).find((a) => a.type === 'trade')!;
  assert.equal(sale.quantity, 5);
});

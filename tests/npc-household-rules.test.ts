// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { householdBudget, dailyLivingCost } from '../src/server/npc/household';
import { offlineReadiness, homecomingPlan } from '../src/server/npc/homecoming';
import { livingReserve, affordableLoad } from '../src/server/npc/travel';
import { Store } from '../src/server/store';
const defaults = {
  npcHouseholdSeconds: 21600,
  npcBudgetNeedAllowance: 15000,
  npcBudgetCarriedShare: 0.5,
  npcBudgetFuelThreshold: 8,
};
function setup() {
  const w = createWorld('household-rules', 'Household', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    shop = makeBuilding('supplies', 'market', 0, 0);
  w.buildings = [shop];
  shop.sell = { bread: 100, water: 200, fuel: 300 };
  shop.stock = { bread: 100, water: 100, fuel: 100 };
  w.settings.hungerRate = 1;
  w.settings.thirstRate = 2;
  Object.assign(p, {
    hunger: 15000,
    thirst: 15000,
    fuel: 0,
    inventory: { bread: 1, water: 1 },
    cash: 1000,
  });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, shop, edit };
}
test('household forecast defaults and missing fields preserve exact food water and fuel reserve', () => {
  const { w, p } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  const b = householdBudget(w, p);
  assert.deepEqual(
    [b.food, b.drink, b.fuel, b.rent, b.reserve, b.horizonSeconds],
    [100, 400, 300, 0, 800, 21600],
  );
});
test('local forecast horizon allowance carried credit and fuel boundary affect optional spending without grants', () => {
  const { w, p, edit } = setup();
  edit({
    npcHouseholdSeconds: 3600,
    npcBudgetNeedAllowance: 0,
    npcBudgetCarriedShare: 1,
    npcBudgetFuelThreshold: 0,
  });
  const before = JSON.stringify(w);
  let b = householdBudget(w, p);
  assert.equal(b.reserve, 300);
  assert.equal(b.fuel, 0);
  assert.equal(b.horizonSeconds, 3600);
  assert.equal(livingReserve(w, p), 300);
  assert.equal(affordableLoad(p.cash, 100, livingReserve(w, p), 20), 7);
  assert.equal(JSON.stringify(w), before);
  b = householdBudget(w, p, 21600);
  assert.equal(b.horizonSeconds, 21600);
  assert.equal(b.food + b.drink, 600);
  edit({ npcBudgetCarriedShare: 0 });
  assert.equal(householdBudget(w, p).reserve, 600);
  edit({ npcBudgetNeedAllowance: 1000000, npcBudgetFuelThreshold: 12.5 });
  p.fuel = 12.5;
  assert.equal(householdBudget(w, p).reserve, 0);
  p.fuel = 12.49;
  assert.equal(householdBudget(w, p).reserve, 300);
  p.inventory.fuel = 1;
  assert.equal(householdBudget(w, p).reserve, 0);
});
test('daily replacement costs keep a real-day horizon and never reserve fuel even above a full tank', () => {
  const { w, p, edit } = setup();
  edit({
    npcHouseholdSeconds: 60,
    npcBudgetNeedAllowance: 0,
    npcBudgetCarriedShare: 1,
    npcBudgetFuelThreshold: 1000000,
  });
  const b = dailyLivingCost(w, p);
  assert.equal(b.horizonSeconds, 86400);
  assert.equal(b.fuel, 0);
  assert.equal(b.food, 600);
  assert.equal(b.drink, 1800);
});
test('pantry eligibility room expiry and catalogue fallback still determine the forecast', () => {
  const { w, p, shop, edit } = setup();
  edit({ npcHouseholdSeconds: 3600, npcBudgetFuelThreshold: 0 });
  const home = makeBuilding('house', 'home', 0, 0);
  home.owner = p.id;
  home.stock = { bread: 100, water: 100 };
  p.home = home.id;
  w.buildings.push(home);
  assert.equal(householdBudget(w, p).reserve, 0);
  home.owner = 'other';
  assert.equal(householdBudget(w, p).housed, false);
  const inn = makeBuilding('inn', 'hotel', 0, 0);
  inn.lodging = { open: true, rate: 50, guests: { [p.id]: { until: w.time + 1800, stock: {} } } };
  p.home = inn.id;
  w.buildings = [shop, inn];
  assert.equal(householdBudget(w, p).rent, 50);
  w.time += 1801;
  assert.equal(householdBudget(w, p).housed, false);
  assert.equal(householdBudget(w, p).rent, 0);
  p.hunger = p.thirst = 40000;
  shop.stock = {};
  const b = householdBudget(w, p);
  assert.ok(b.food > 0 && b.drink > 0);
  assert.notEqual(b.food, 100);
});
test('household budget and homecoming share actual shelter multipliers including zero without NaN', () => {
  const { w, p, edit } = setup();
  const h = makeBuilding('house', 'home', 0, 0);
  h.owner = p.id;
  h.stock = {};
  w.buildings.push(h);
  p.home = h.id;
  p.atHome = true;
  p.inventory = {};
  p.fuel = 100;
  p.hunger = p.thirst = 0;
  edit({ homeNeedsMultiplier: 0 });
  assert.equal(householdBudget(w, p).reserve, 0);
  assert.equal(offlineReadiness(w, p, 86400).coveredSeconds, Infinity);
  assert.deepEqual(homecomingPlan(w, p, 86400), []);
  edit({ homeNeedsMultiplier: 1 });
  assert.equal(offlineReadiness(w, p, 86400).coveredSeconds, 15000);
  assert.equal(householdBudget(w, p).food, 100);
  assert.equal(householdBudget(w, p).drink, 400);
  // At 13,000 seconds, this deficit needs two loaves at full rate; the former 0.8 copy buys one.
  w.settings.thirstRate = 0;
  p.hunger = 24000;
  const plan = homecomingPlan(w, p, 13000, undefined, false);
  assert.ok(
    plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'trade' &&
        s.action.item === 'bread' &&
        s.action.quantity === 2,
    ),
  );
});
test('household rules validate and persist in summaries editor designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcHouseholdSeconds: 59 },
    { npcHouseholdSeconds: 604801 },
    { npcHouseholdSeconds: 60.5 },
    { npcBudgetNeedAllowance: -1 },
    { npcBudgetNeedAllowance: 1.5 },
    { npcBudgetCarriedShare: 1.01 },
    { npcBudgetCarriedShare: -0.1 },
    { npcBudgetFuelThreshold: 1000001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({
    npcHouseholdSeconds: 12345,
    npcBudgetNeedAllowance: 6789,
    npcBudgetCarriedShare: 0.25,
    npcBudgetFuelThreshold: 12.5,
  });
  for (const v of ['12345', '6789', '25', '12.5']) assert.ok(rulesSummary(w).includes(v));
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { householdBudget, dailyLivingCost } from '../src/server/npc/household';
import {
  ownerLivingDraw,
  retainedCapital,
  procurementDraw,
} from '../src/server/npc/business-policy';
import { checkOwnerCapitalAction, planQuotes } from '../src/server/npc/execution';
import { prosperityBriefing } from '../src/server/npc/prosperity';
import { offlineReadiness, homecomingPlan } from '../src/server/npc/homecoming';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { housingChoices } from '../src/server/npc/housing';
import { constructionBudget } from '../src/server/npc/construction-projects';
import { startCareer, continueCareer } from '../src/server/npc/projects';
import type { ResidentState } from '../src/server/npc/memory';
import type { Step } from '../src/server/npc/decision';
import { Store } from '../src/server/store';
const defaults = { npcStrategicSeconds: 86400, npcPantryBufferSeconds: 900 };
function setup() {
  const w = createWorld('planning', 'Planning', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    shop = makeBuilding('supplies', 'market', 0, 0),
    home = makeBuilding('home', 'home', 30, 0),
    business = makeBuilding('business', 'market', 60, 0);
  shop.sell = { bread: 100, water: 200, flour: 100 };
  shop.stock = { bread: 100, water: 100, flour: 100 };
  home.owner = business.owner = p.id;
  home.stock = business.stock = {};
  business.investment = 100000;
  w.buildings = [shop, home, business];
  Object.assign(w.settings, {
    hungerRate: 1,
    thirstRate: 2,
    homeNeedsMultiplier: 1,
    npcBudgetFuelThreshold: 0,
  });
  Object.assign(p, {
    home: home.id,
    hunger: 15000,
    thirst: 15000,
    fuel: 100,
    inventory: {},
    cash: 0,
    bank: 0,
  });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, shop, home, business, edit };
}
test('strategic and pantry defaults and absent keys preserve the one-day reserve and extra coverage', () => {
  const { w, p, business } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(ownerLivingDraw(w, p, business), 2400);
  assert.equal(prosperityBriefing(w, p).householdReserve, 2400);
  assert.equal(offlineReadiness(w, p, 7500).stocked, false);
  assert.equal(offlineReadiness(w, p, 6600).stocked, true);
});
test('strategic horizon changes owner draws and briefing but preserves ordinary and daily budgets', () => {
  const { w, p, business } = setup();
  Object.assign(w.settings, { npcStrategicSeconds: 3600 });
  const before = JSON.stringify(w);
  assert.equal(ownerLivingDraw(w, p, business), 300);
  assert.equal(prosperityBriefing(w, p).householdReserve, 300);
  assert.equal(prosperityBriefing(w, p).dailyReplacementCost, 2400);
  assert.equal(householdBudget(w, p).horizonSeconds, 21600);
  assert.equal(dailyLivingCost(w, p).horizonSeconds, 86400);
  assert.equal(JSON.stringify(w), before);
  const total = p.cash + business.investment;
  p.x = business.x;
  p.z = business.z;
  act(w, p.id, {
    type: 'investment',
    building: business.id,
    direction: 'withdraw',
    amount: ownerLivingDraw(w, p, business),
  });
  assert.equal(p.cash, 300);
  assert.equal(p.cash + business.investment, total);
});
test('changed strategic reserves agree between procurement planning and queued execution', () => {
  const { w, p, business, shop } = setup();
  business.production = {
    skill: 'baker',
    seconds: 600,
    tier: 1,
    inputs: { flour: 1 },
    outputs: { bread: 3 },
  };
  business.buy = { flour: 100 };
  business.wage = 0;
  business.investment = retainedCapital(w, business);
  p.cash = 500;
  const remaining: Step[] = [
    {
      kind: 'act',
      action: { type: 'trade', building: shop.id, item: 'flour', direction: 'buy', quantity: 1 },
    },
    {
      kind: 'act',
      action: {
        type: 'stock',
        building: business.id,
        item: 'flour',
        direction: 'deposit',
        quantity: 1,
      },
    },
  ];
  const withdrawal = {
    type: 'investment' as const,
    building: business.id,
    direction: 'withdraw' as const,
    amount: 100,
  };
  assert.equal(procurementDraw(w, p, business, 'flour', 1, 100), 100);
  assert.doesNotThrow(() =>
    checkOwnerCapitalAction(w, p, withdrawal, remaining, planQuotes(w, remaining)),
  );
  Object.assign(w.settings, { npcStrategicSeconds: 3600 });
  assert.equal(procurementDraw(w, p, business, 'flour', 1, 100), 0);
  assert.throws(
    () => checkOwnerCapitalAction(w, p, withdrawal, remaining, planQuotes(w, remaining)),
    /reserves changed/,
  );
});
test('zero pantry buffer permits exact home coverage but not a missing home or a longer absence', () => {
  const { w, p, home } = setup();
  Object.assign(w.settings, { npcPantryBufferSeconds: 0 });
  assert.equal(offlineReadiness(w, p, 7500).stocked, true);
  assert.equal(offlineReadiness(w, p, 7501).stocked, false);
  p.hunger = 24000;
  p.thirst = 0;
  w.settings.thirstRate = 0;
  p.cash = 100000;
  const quantity = () =>
    homecomingPlan(w, p, 8000, undefined, false).flatMap((s) =>
      s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'bread'
        ? [s.action.quantity]
        : [],
    )[0];
  assert.equal(quantity(), 1);
  Object.assign(w.settings, { npcPantryBufferSeconds: 9000 });
  assert.equal(quantity(), 2);
  Object.assign(w.settings, { npcPantryBufferSeconds: 0 });
  w.buildings = w.buildings.filter((b) => b.id !== home.id);
  assert.equal(offlineReadiness(w, p, 0).stocked, false);
});
test('home provision choices and housing career completion share the strategic horizon', () => {
  const { w, p, home } = setup();
  p.cash = 100000;
  Object.assign(w.settings, { npcStrategicSeconds: 3600, npcPantryBufferSeconds: 0 });
  assert.ok(!enterpriseChoices(w, p).some((c) => c.id === `household_${home.id}`));
  const state = { plan: [], index: 0 } as unknown as ResidentState;
  startCareer(w, p, state, { kind: 'housing', target: home.id });
  continueCareer(w, p, state, []);
  assert.equal(state.career, undefined);
  Object.assign(w.settings, { npcStrategicSeconds: 18000 });
  const choice = enterpriseChoices(w, p).find((c) => c.id === `household_${home.id}`);
  assert.ok(choice);
  assert.match(choice.description, /18000/);
  assert.doesNotMatch(choice.description, /stock a day/);
});
test('planning rules validate and persist through editor summary designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcStrategicSeconds: 59 },
    { npcStrategicSeconds: 604801 },
    { npcStrategicSeconds: 60.5 },
    { npcPantryBufferSeconds: -1 },
    { npcPantryBufferSeconds: 86401 },
    { npcPantryBufferSeconds: 0.5 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({ npcStrategicSeconds: 12345, npcPantryBufferSeconds: 678 });
  assert.ok(rulesSummary(w).includes('12345'));
  assert.ok(rulesSummary(w).includes('678'));
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
test('housing protects the longer explicit absence while construction uses the strategic reserve', () => {
  const { w, p, home } = setup();
  home.owner = undefined;
  home.price = 100;
  p.home = undefined;
  p.cash = 10000000;
  Object.assign(w.settings, { npcStrategicSeconds: 3600, npcPantryBufferSeconds: 0 });
  const short = housingChoices(w, p).find((c) => c.id === `housing_buy_${home.id}`);
  assert.ok(short);
  assert.match(short.description, /retaining 300 for supplies/);
  Object.assign(w.settings, { npcPantryBufferSeconds: 900 });
  const long = housingChoices(w, p, 72000).find((c) => c.id === `housing_buy_${home.id}`);
  assert.ok(long);
  assert.ok(
    long.description.includes(`retaining ${householdBudget(w, p, 72900).reserve} for supplies`),
  );
  const buildWorld = createWorld('build', 'Build', 'owner'),
    builder = addPlayer(buildWorld, 'owner', 'Owner');
  Object.assign(builder, {
    x: -90,
    z: -130,
    cash: 1000000,
    inventory: {},
    hunger: 15000,
    thirst: 15000,
    fuel: 100,
  });
  const before = constructionBudget(buildWorld, builder, 'home', builder)!;
  assert.ok(before);
  Object.assign(buildWorld.settings, { npcStrategicSeconds: 3600 });
  const after = constructionBudget(buildWorld, builder, 'home', builder)!;
  assert.ok(after);
  assert.equal(after.living, householdBudget(buildWorld, builder, 3600).reserve);
  assert.ok(after.living < before.living);
  assert.equal(before.total - after.total, before.living - after.living);
});

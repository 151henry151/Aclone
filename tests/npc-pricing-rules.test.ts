// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import {
  inputBidQuote,
  ownerBidRoutine,
  ownerStaffingRoutine,
} from '../src/server/npc/business-policy';
import { pricingChoices, sustainableAsk } from '../src/server/npc/pricing';
import { operationAction } from '../src/server/npc/player-operations';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = {
  npcHaulageMargin: 0.08,
  npcTravelTimeValue: 5,
  npcInputMinimumAllowance: 100,
  npcMaximumInputBid: 10000000,
  npcBidReopenFraction: 0.5,
  npcWageMarginShare: 0.8,
  npcProductionPriceMultiplier: 1.05,
  npcMinimumOutputAsk: 1,
  npcSurplusMinimumStock: 12,
  npcSurplusCapacityShare: 0.25,
  npcPricingMinimumLoad: 6,
  npcPricingMaximumLoad: 1000,
};
function setup() {
  const w = createWorld('pricing', 'Pricing', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('bakery', 'bakery', 0, 0),
    supplier = makeBuilding('mill', 'mill', 20, 0),
    buyer = makeBuilding('buyer', 'market', 30, 0);
  b.owner = p.id;
  b.capacity = 100;
  b.stock = { flour: 0, bread: 0 };
  b.buy = { flour: 100 };
  b.sell = { bread: 4000 };
  b.wage = 100;
  b.investment = 1000000;
  b.production = {
    skill: 'baker',
    seconds: 600,
    tier: 1,
    inputs: { flour: 2 },
    outputs: { bread: 3 },
  };
  supplier.stock = { flour: 500 };
  supplier.sell = { flour: 100 };
  buyer.buy = { bread: 1000 };
  buyer.stock = { bread: 0 };
  buyer.investment = 100000;
  buyer.capacity = 100;
  w.buildings = [b, supplier, buyer];
  w.towns = [];
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    salesTax: 0,
    ownerOperation: false,
    activeWork: false,
  });
  Object.assign(p, { x: 0, z: 0, cash: 100000, inventory: {}, hunger: 0, thirst: 0, fuel: 100 });
  return {
    w,
    p,
    b,
    supplier,
    buyer,
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
test('pricing defaults and absent keys retain input allowance and sustainable ask', () => {
  const { w, p, b } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(inputBidQuote(w, p, b, 'flour')?.price, 200);
  assert.equal(sustainableAsk(w, b, 'bread'), 141);
});
test('haulage margin time and input minimum allowance change delivered quotes without granting funds', () => {
  const { w, p, b } = setup();
  Object.assign(w.settings, {
    npcHaulageMargin: 0.5,
    npcTravelTimeValue: 0,
    npcInputMinimumAllowance: 0,
  });
  const before = JSON.stringify(w);
  assert.equal(inputBidQuote(w, p, b, 'flour')?.price, 150);
  assert.equal(JSON.stringify(w), before);
  Object.assign(w.settings, { npcHaulageMargin: 0, npcInputMinimumAllowance: 37 });
  assert.equal(inputBidQuote(w, p, b, 'flour')?.price, 137);
  Object.assign(w.settings, { npcInputMinimumAllowance: 0, npcTravelTimeValue: 120 });
  assert.ok(inputBidQuote(w, p, b, 'flour')!.allowance > 0);
  Object.assign(w.settings, { npcTravelTimeValue: 0 });
  assert.equal(
    inputBidQuote(w, p, b, 'flour')?.price,
    104,
    'round-trip fuel remains priced when time and spread allowances are zero',
  );
});
test('input quote ceiling including zero applies to known and remembered suppliers', () => {
  const { w, p, b, supplier } = setup();
  Object.assign(w.settings, {
    npcHaulageMargin: 0.5,
    npcTravelTimeValue: 0,
    npcInputMinimumAllowance: 0,
    npcMaximumInputBid: 149,
  });
  assert.equal(inputBidQuote(w, p, b, 'flour'), undefined);
  supplier.stock.flour = 0;
  assert.equal(inputBidQuote(w, p, b, 'flour', 150), undefined);
  Object.assign(w.settings, { npcMaximumInputBid: 150 });
  assert.equal(inputBidQuote(w, p, b, 'flour', 150)?.price, 150);
  Object.assign(w.settings, { npcMaximumInputBid: 0 });
  assert.equal(inputBidQuote(w, p, b, 'flour', 150), undefined);
  assert.equal(b.buy.flour, 100);
});
test('existing bid floor and transaction limit also govern computed and remembered input quotes', () => {
  const { w, p, b, supplier, edit } = setup();
  edit({ minimumBuyPrice: 500, transactionItemLimit: 3 });
  const quote = inputBidQuote(w, p, b, 'flour')!;
  assert.equal(quote.price, 500);
  assert.equal(quote.load, 3);
  supplier.stock.flour = 0;
  assert.equal(inputBidQuote(w, p, b, 'flour', 400), undefined);
  assert.equal(inputBidQuote(w, p, b, 'flour', 500)?.price, 500);
});
test('bid reopening fraction and zero wage share govern maintenance without cutting existing wages', () => {
  const { w, p, b } = setup(),
    state = { plan: [], index: 0 } as unknown as ResidentState;
  b.stock.flour = 6;
  b.buy = {};
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  Object.assign(w.settings, { npcBidReopenFraction: 1 });
  assert.ok(
    ownerBidRoutine(w, p, state).some(
      (s) => s.kind === 'operation' && s.operation === 'buildingAdmin',
    ),
  );
  Object.assign(w.settings, { npcBidReopenFraction: 0 });
  b.stock.flour = 0;
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  b.buy = { flour: 100 };
  const raises = () =>
    ownerStaffingRoutine(w, p).filter(
      (s) =>
        s.kind === 'operation' &&
        s.operation === 'buildingAdmin' &&
        s.parameters.some((v) => v.name === 'wage'),
    );
  assert.ok(raises().length);
  Object.assign(w.settings, { npcWageMarginShare: 0 });
  assert.equal(raises().length, 0);
  assert.equal(b.wage, 100);
});
test('production margin and surplus stock and load thresholds govern ordinary price changes', () => {
  const { w, p, b, buyer, edit } = setup();
  Object.assign(w.settings, { npcProductionPriceMultiplier: 1.5, npcTravelTimeValue: 0 });
  assert.equal(sustainableAsk(w, b, 'bread'), 200);
  Object.assign(w.settings, { npcMinimumOutputAsk: 250 });
  assert.equal(sustainableAsk(w, b, 'bread'), 250);
  Object.assign(w.settings, { npcMinimumOutputAsk: 0 });
  b.stock.bread = 24;
  assert.equal(pricingChoices(w, p).length, 0);
  Object.assign(w.settings, {
    npcSurplusCapacityShare: 0,
    npcSurplusMinimumStock: 10,
    npcPricingMinimumLoad: 1,
    npcPricingMaximumLoad: 12,
  });
  let choice = pricingChoices(w, p)[0];
  assert.ok(choice);
  assert.match(choice.description, /fund 12/);
  Object.assign(w.settings, { npcSurplusMinimumStock: 25 });
  assert.equal(pricingChoices(w, p).length, 0);
  Object.assign(w.settings, {
    npcSurplusMinimumStock: 10,
    npcPricingMinimumLoad: 25,
    npcPricingMaximumLoad: 30,
  });
  assert.equal(pricingChoices(w, p).length, 0);
  Object.assign(w.settings, {
    npcPricingMinimumLoad: 1,
    npcPricingMaximumLoad: 12,
    npcHaulageMargin: 0.5,
  });
  edit({ transactionItemLimit: 5 });
  choice = pricingChoices(w, p)[0];
  assert.ok(choice);
  assert.match(choice.description, /fund 5/);
  const step = choice.plan.at(-1)!;
  assert.equal(step.kind, 'operation');
  if (step.kind !== 'operation') throw Error('Expected ordinary price action');
  act(w, p.id, operationAction(step));
  assert.equal(b.sell.bread, 500);
  assert.equal(pricingChoices(w, p).length, 0);
  b.sell.bread = 4000;
  buyer.investment = 0;
  assert.equal(pricingChoices(w, p).length, 0);
  buyer.investment = 100000;
  w.settings.salesTax = 1;
  assert.equal(sustainableAsk(w, b, 'bread'), Infinity);
  assert.equal(pricingChoices(w, p).length, 0);
});
test('pricing rules validate joint load bounds and persist in editor summaries designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { npcHaulageMargin: 1.01 },
    { npcTravelTimeValue: -1 },
    { npcInputMinimumAllowance: 0.5 },
    { npcMaximumInputBid: 10000001 },
    { npcBidReopenFraction: -0.1 },
    { npcWageMarginShare: 1.01 },
    { npcProductionPriceMultiplier: 0.99 },
    { npcMinimumOutputAsk: 0.5 },
    { npcSurplusMinimumStock: 0.5 },
    { npcSurplusCapacityShare: 1.1 },
    { npcPricingMinimumLoad: 0 },
    { npcPricingMaximumLoad: 5 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    npcHaulageMargin: 0.5,
    npcTravelTimeValue: 12.5,
    npcInputMinimumAllowance: 37,
    npcMaximumInputBid: 12345,
    npcBidReopenFraction: 1,
    npcWageMarginShare: 0.1,
    npcProductionPriceMultiplier: 1.5,
    npcMinimumOutputAsk: 25,
    npcSurplusMinimumStock: 10,
    npcSurplusCapacityShare: 0,
    npcPricingMinimumLoad: 1,
    npcPricingMaximumLoad: 12,
  };
  edit(patch);
  for (const v of ['12.5', '37', '12345', '1.5']) assert.ok(rulesSummary(w).includes(v));
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

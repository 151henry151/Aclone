// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { lifeBriefing } from '../src/server/npc/strategy';
import { adaptiveChoices } from '../src/server/npc/adaptive';
import { operationAction } from '../src/server/npc/player-operations';
import { Store } from '../src/server/store';
import type { ResidentState } from '../src/server/npc/memory';
function memoryState(
  w: ReturnType<typeof createWorld>,
  p: ReturnType<typeof addPlayer>,
): ResidentState {
  return {
    world: w.id,
    playerId: p.id,
    name: p.name,
    personality: 'Helpful',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    cursor: 0,
    nextAt: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: 'Ready',
    errors: 0,
  };
}

const defaults = {
  npcAdviceCashFloor: 12000,
  npcAdviceMealItems: 3,
  npcAdviceDrinkItems: 6,
  npcLodgingOfferRate: 600,
};
const invalidValues = {
  npcAdviceCashFloor: [-1, 0.5, 100000001],
  npcAdviceMealItems: [-1, 0.5, 10001],
  npcAdviceDrinkItems: [-1, 0.5, 10001],
  npcLodgingOfferRate: [-1, 0.5, 1000001],
};
function setup() {
  const w = createWorld('test', 'Test', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(w.settings, { seaLevel: -10, hungerRate: 0, thirstRate: 0 });
  Object.assign(p, {
    cash: 1000000,
    inventory: {},
    fuel: 64,
    hunger: 0,
    thirst: 0,
    x: 0,
    z: 0,
    skills: ['innkeeper'],
  });
  const shop = makeBuilding('shop', 'market', 20, 0),
    hotel = makeBuilding('hotel', 'hotel', 0, 0);
  Object.assign(shop, {
    owner: 'seller',
    stock: { bread: 100, water: 100 },
    sell: { bread: 2000, water: 3000 },
    buy: {},
  });
  Object.assign(hotel, {
    owner: p.id,
    stock: {},
    buy: {},
    sell: {},
    lodging: {
      open: true,
      rate: 200,
      guests: { guest: { until: w.time + 3600, stock: { bread: 3 } } },
    },
  });
  w.buildings = [shop, hotel];
  const state = memoryState(w, p);
  return { w, p, shop, hotel, state };
}
const offer = ({ w, p, state }: ReturnType<typeof setup>) =>
  adaptiveChoices(w, p, state).find((c) => /for guests at/.test(c.description));
test('living advice and lodging suggestions retain defaults and missing fields', () => {
  for (const missing of [false, true]) {
    const f = setup();
    const { w, p, shop } = f;
    for (const [k, v] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[k];
      else assert.equal((w.settings as any)[k], v, k);
    }
    assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 24000);
    shop.sell.bread = 100;
    shop.sell.water = 100;
    assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 12000);
    assert.match(offer(f)!.description, /at 600 per real hour/);
  }
});
test('living advice uses configured components and observed nutrition-value quotes without granting resources', () => {
  const { w, p, shop } = setup();
  Object.assign(w.settings, {
    npcAdviceCashFloor: 1234,
    npcAdviceMealItems: 2,
    npcAdviceDrinkItems: 1,
  });
  const before = JSON.stringify(w);
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 7000);
  assert.equal(JSON.stringify(w), before);
  shop.sell.fish = 100;
  shop.stock.fish = 100;
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 3200);
  shop.stock.water = 0;
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 1234);
  assert.equal(lifeBriefing(w, p).survival.reserveAvailable, false);
  shop.stock = {};
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 1234);
  Object.assign(w.settings, {
    npcAdviceCashFloor: 0,
    npcAdviceMealItems: 0,
    npcAdviceDrinkItems: 0,
  });
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 0);
  shop.stock = { bread: 100, water: 100 };
  assert.equal(lifeBriefing(w, p).survival.suggestedLivingCash, 0);
});
test('lodging advice changes only through an owner innkeeper action and preserves paid stays and balances', () => {
  const f = setup();
  const { w, p, hotel } = f;
  const guest = JSON.stringify(hotel.lodging!.guests),
    cash = p.cash,
    till = hotel.investment;
  for (const rate of [800, 0]) {
    act(w, p.id, { type: 'settings', patch: { npcLodgingOfferRate: rate } });
    assert.equal(hotel.lodging!.rate, rate === 800 ? 200 : 800);
    const choice = offer(f);
    assert.ok(choice);
    assert.match(choice.description, new RegExp(`at ${rate} per real hour`));
    const step = choice.plan.find((s) => s.kind === 'operation' && s.operation === 'lodging');
    assert.ok(step?.kind === 'operation');
    const action = operationAction(step);
    assert.equal(action.rate, rate);
    act(w, p.id, action);
    assert.equal(hotel.lodging!.rate, rate);
    assert.equal(JSON.stringify(hotel.lodging!.guests), guest);
    assert.equal(p.cash, cash);
    assert.equal(hotel.investment, till);
  }
  p.skills = [];
  assert.equal(offer(f), undefined);
  p.skills = ['innkeeper'];
  hotel.owner = 'someone';
  assert.equal(offer(f), undefined);
});
test('advice budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state } = setup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const [k, invalid] of Object.entries(invalidValues))
    for (const v of invalid) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    npcAdviceCashFloor: 1234,
    npcAdviceMealItems: 2,
    npcAdviceDrinkItems: 1,
    npcLodgingOfferRate: 800,
  };
  edit(patch);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const html = settingsFields(),
    summary = rulesSummary(w),
    dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      observation = observe(w, p, state, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(html.includes(`name="${k}"`), k);
      assert.ok(summary.includes(String(v)), k);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((observation.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

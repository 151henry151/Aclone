// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { sustainableAsk } from '../src/server/npc/pricing';
import { farmEnterprises } from '../src/server/npc/farm-enterprise';
import { farmExpansionBlocker } from '../src/shared/farm-land';
import { accounts } from '../src/shared/reports';
import { Store } from '../src/server/store';
const defaults = {
  npcFarmYieldShare: 0.5,
  npcFarmWaterBudget: 6,
  npcFarmCompostBudget: 1,
  npcFarmCustomerFundedItems: 20,
  npcFarmCustomerStockLimit: 20,
};
function setup() {
  const w = createWorld('farm-budget', 'Farm budget', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('farm', 'farm', 200, 200),
    shop = makeBuilding('shop', 'market', -100, -100);
  w.buildings = [b, shop];
  w.roads = [];
  w.towns = [];
  w.resources = {};
  w.zones = [];
  Object.assign(w.settings, {
    seaLevel: -10,
    mapSize: 1000,
    hungerRate: 0,
    thirstRate: 0,
    salesTax: 0,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(p, {
    cash: 1000000,
    bank: 0,
    inventory: {},
    hunger: 0,
    thirst: 0,
    fuel: 100,
    skills: ['farmer'],
    x: b.x,
    z: b.z,
  });
  Object.assign(b, {
    owner: p.id,
    wage: 1000,
    investment: 100000,
    stock: {},
    buy: { water: 100, compost: 200 },
    sell: { wheat: 1000 },
    capacity: 1000,
  });
  shop.stock = { water: 100, compost: 100, wheat: 0 };
  shop.sell = { water: 100, compost: 200 };
  shop.buy = { wheat: 1000 };
  shop.investment = 20000;
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, b, shop, edit, choices: () => farmEnterprises(w, p) };
}
test('farm forecast defaults and missing keys preserve the exact sustainable wheat ask', () => {
  const { w, b } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  assert.equal(sustainableAsk(w, b, 'wheat'), 90);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(sustainableAsk(w, b, 'wheat'), 90);
});
test('farm yield and input budgets change price estimates while zero harvest rejects speculative acquisition', () => {
  const { w, p, b, edit, choices } = setup();
  const before = { cash: p.cash, stock: structuredClone(b.stock) };
  edit({ npcFarmYieldShare: 1, npcFarmWaterBudget: 0, npcFarmCompostBudget: 0 });
  assert.equal(sustainableAsk(w, b, 'wheat'), 31);
  edit({ npcFarmWaterBudget: 3, npcFarmCompostBudget: 2 });
  assert.equal(sustainableAsk(w, b, 'wheat'), 43);
  b.owner = undefined;
  assert.ok(choices().some((c) => c.description.startsWith('Acquire and fund')));
  edit({ npcFarmYieldShare: 0 });
  assert.equal(sustainableAsk(w, b, 'wheat'), Infinity);
  assert.ok(!choices().some((c) => c.description.startsWith('Acquire and fund')));
  edit({ npcFarmYieldShare: 0.001 });
  assert.equal(sustainableAsk(w, b, 'wheat'), Infinity);
  assert.ok(!choices().some((c) => c.description.startsWith('Acquire and fund')));
  assert.equal(p.cash, before.cash);
  assert.deepEqual(b.stock, before.stock);
});
test('farm acquisition uses the same configured conservative yield share', () => {
  const { b, edit, choices } = setup();
  b.owner = undefined;
  b.sell = { wheat: 100 };
  assert.ok(choices().some((c) => c.description.startsWith('Acquire and fund')));
  edit({ npcFarmYieldShare: 0.25 });
  assert.ok(!choices().some((c) => c.description.startsWith('Acquire and fund')));
  edit({ npcFarmYieldShare: 0.5 });
  assert.ok(choices().some((c) => c.description.startsWith('Acquire and fund')));
});
test('farm expansion demand respects configured funded load and buyer stock boundaries', () => {
  const { w, b, shop, edit, choices } = setup();
  b.plots = Array.from({ length: 4 }, () => ({
    crop: 'wheat',
    planted: w.time,
    ready: w.time + 10000,
    water: 2,
    fertilized: true,
  }));
  accounts(w, b).receipts = 1000;
  assert.equal(farmExpansionBlocker(w, b), undefined);
  const expands = () => choices().some((c) => c.description.startsWith('Expand my'));
  assert.equal(expands(), true);
  shop.investment = 19999;
  assert.equal(expands(), false);
  edit({ npcFarmCustomerFundedItems: 10 });
  assert.equal(expands(), true);
  shop.stock.wheat = 20;
  assert.equal(expands(), false);
  edit({ npcFarmCustomerStockLimit: 21 });
  assert.equal(expands(), true);
  edit({ npcFarmCustomerStockLimit: 0 });
  assert.equal(expands(), false);
});
test('expanded farm funding describes the real plot count and no grant', () => {
  const { p, b, choices } = setup();
  b.farmPlots = 8;
  b.investment = 0;
  const cash = p.cash,
    choice = choices().find((c) => c.description.startsWith('Fund my'));
  assert.ok(choice);
  assert.match(choice.description, /8 seasonal plots/);
  assert.equal(p.cash, cash);
  assert.equal(b.investment, 0);
});
test('farm budget fields validate and persist through editor summaries observations designs and saves', async () => {
  const { w, p, edit } = setup();
  for (const patch of [
    { npcFarmYieldShare: 1.01 },
    { npcFarmWaterBudget: -1 },
    { npcFarmCompostBudget: 0.5 },
    { npcFarmCustomerFundedItems: 0 },
    { npcFarmCustomerStockLimit: 10001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    npcFarmYieldShare: 0.75,
    npcFarmWaterBudget: 12,
    npcFarmCompostBudget: 3,
    npcFarmCustomerFundedItems: 35,
    npcFarmCustomerStockLimit: 45,
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
      state = {
        playerId: p.id,
        world: w.id,
        name: p.name,
        personality: 'Helpful',
        notebook: '',
        intent: '',
        cursor: 0,
        nextAt: 0,
        plan: [],
        index: 0,
        repeats: 0,
        until: 0,
        waitUntil: 0,
        status: 'Ready',
        errors: 0,
      },
      o = observe(w, p, state, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(html.includes(`name="${k}"`), k);
      assert.ok(summary.includes(String(v)), k);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((o.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

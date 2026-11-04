// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { inventHypotheses, type Idea } from '../src/server/npc/hypotheses';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = {
  npcExperimentCashFloor: 2000,
  npcExperimentOwnerFundingUnits: 4,
  npcExperimentRestockBatches: 2,
  npcExperimentLoadLimit: 8,
};
function setup() {
  const w = createWorld('experiment', 'Experiment', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('bakery', 'bakery', 0, 0),
    seller = makeBuilding('mill', 'mill', 30, 0),
    buyer = makeBuilding('buyer', 'market', 60, 0);
  w.buildings = [b, seller, buyer];
  w.resources = {};
  w.towns = [];
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, salesTax: 0, ownerOperation: false });
  Object.assign(p, {
    cash: 1000000,
    bank: 0,
    inventory: {},
    hunger: 0,
    thirst: 0,
    fuel: 100,
    x: 0,
    z: 0,
  });
  Object.assign(b, {
    owner: p.id,
    wage: 100,
    investment: 10000,
    stock: { bread: 20, flour: 0 },
    buy: { flour: 100 },
    sell: { bread: 1000 },
    production: {
      skill: 'baker',
      seconds: 600,
      tier: 1,
      inputs: { flour: 2 },
      outputs: { bread: 3 },
    },
  });
  Object.assign(seller, {
    owner: 'seller',
    stock: { flour: 100 },
    sell: { flour: 100 },
    buy: {},
    investment: 0,
  });
  Object.assign(buyer, {
    owner: 'buyer',
    stock: { flour: 0, bread: 0, fish: 0 },
    buy: { flour: 200, bread: 1200, fish: 200 },
    sell: {},
    investment: 100000,
    capacity: 100,
  });
  const state: ResidentState = {
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
  };
  return {
    w,
    p,
    b,
    seller,
    buyer,
    state,
    ideas: () => inventHypotheses(w, p, state),
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
const actions = (idea?: Idea) =>
  idea?.plan.flatMap((s) => (s.kind === 'act' ? [s.action] : [])) ?? [];
const transfers = (idea?: Idea) =>
  actions(idea).filter((a) => a.type === 'trade' || a.type === 'stock');
const deposits = (idea?: Idea) =>
  actions(idea)
    .filter((a) => a.type === 'investment')
    .filter((a) => a.direction === 'deposit');
test('experiment defaults and missing fields retain eight item trades and two batch restocking', () => {
  const { w, ideas } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  const trade = () => transfers(ideas().find((c) => c.idea === 'flour'))[0]?.quantity,
    restock = () => transfers(ideas().find((c) => c.idea === 'restock flour'))[0]?.quantity;
  assert.equal(trade(), 8);
  assert.equal(restock(), 4);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(trade(), 8);
  assert.equal(restock(), 4);
});
test('experiment transfers obey a reduced existing world transaction limit', () => {
  const { p, edit, ideas } = setup();
  p.inventory.fish = 20;
  edit({ transactionItemLimit: 1 });
  for (const id of ['flour', 'restock flour', 'sell bread', 'sell fish']) {
    const choice = ideas().find((c) => c.idea === id);
    assert.ok(choice, id);
    for (const a of transfers(choice)) assert.equal(a.quantity, 1, id);
  }
});
test('output and fish experiments fit actual buyer room and a sale conserves goods and cash', () => {
  const { w, p, b, buyer, ideas } = setup();
  buyer.stock.bread = 99;
  buyer.stock.fish = 99;
  p.inventory.fish = 20;
  const sale = ideas().find((c) => c.idea === 'sell bread');
  assert.ok(sale);
  assert.equal(transfers(sale)[0].quantity, 1);
  assert.equal(transfers(ideas().find((c) => c.idea === 'sell fish'))[0].quantity, 1);
  const goods = b.stock.bread + buyer.stock.bread,
    cash = p.cash + buyer.investment;
  for (const a of transfers(sale)) {
    p.x = a.building === b.id ? b.x : buyer.x;
    p.z = 0;
    act(w, p.id, a);
  }
  assert.equal(b.stock.bread + buyer.stock.bread, goods);
  assert.equal(p.inventory.bread ?? 0, 0);
  assert.equal(p.cash + buyer.investment, cash);
});
test('experiment load and restock budgets change independently and zero suppresses the corresponding routes', () => {
  const { edit, ideas } = setup();
  edit({ npcExperimentLoadLimit: 3, npcExperimentRestockBatches: 1 });
  assert.equal(transfers(ideas().find((c) => c.idea === 'flour'))[0]?.quantity, 3);
  assert.equal(transfers(ideas().find((c) => c.idea === 'restock flour'))[0]?.quantity, 2);
  edit({ npcExperimentRestockBatches: 0 });
  assert.ok(!ideas().some((c) => c.idea === 'restock flour'));
  edit({ npcExperimentLoadLimit: 0 });
  assert.ok(!ideas().some((c) => ['flour', 'restock flour', 'sell bread'].includes(c.idea ?? '')));
});
test('experiment funding budgets govern owner outside and acquisition deposits without transfers', () => {
  const { w, p, b, edit, ideas } = setup();
  b.investment = 0;
  assert.equal(deposits(ideas().find((c) => c.idea === 'fund shop'))[0]?.amount, 2000);
  edit({ npcExperimentCashFloor: 250, npcExperimentOwnerFundingUnits: 6 });
  assert.equal(deposits(ideas().find((c) => c.idea === 'fund shop'))[0]?.amount, 600);
  b.owner = 'other';
  assert.equal(deposits(ideas().find((c) => c.idea === 'invest bakery'))[0]?.amount, 250);
  b.owner = undefined;
  const acquire = ideas().find((c) => c.idea === 'buy bakery');
  assert.ok(acquire);
  assert.equal(deposits(acquire)[0]?.amount, 1500);
  edit({ npcExperimentCashFloor: 0 });
  assert.equal(deposits(ideas().find((c) => c.idea === 'buy bakery'))[0]?.amount, 600);
  assert.equal(p.cash, 1000000);
  assert.equal(b.investment, 0);
});
test('experiment rules validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const patch of [
    { npcExperimentCashFloor: -1 },
    { npcExperimentOwnerFundingUnits: 0 },
    { npcExperimentRestockBatches: 0.5 },
    { npcExperimentLoadLimit: 10001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    npcExperimentCashFloor: 12345,
    npcExperimentOwnerFundingUnits: 7,
    npcExperimentRestockBatches: 3,
    npcExperimentLoadLimit: 15,
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

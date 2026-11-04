// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { homecomingPlan } from '../src/server/npc/homecoming';
import { operationAction } from '../src/server/npc/player-operations';
import { Store } from '../src/server/store';
const defaults = {
  npcPantryNeedAllowance: 20000,
  npcUnhousedProvisionItems: 2,
  npcProvisionDrinkCashReserve: 1500,
  npcProvisionBatchLimit: 20,
  npcLodgingBufferSeconds: 1200,
  npcLodgingCashReserve: 2000,
};
function setup() {
  const w = createWorld('pantry', 'Pantry', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    home = makeBuilding('home', 'home', 0, 0),
    shop = makeBuilding('shop', 'market', 0, 0);
  home.owner = p.id;
  home.stock = { water: 100 };
  home.capacity = 1000;
  shop.stock = { bread: 100, water: 100 };
  shop.sell = { bread: 100, water: 100 };
  shop.buy = {};
  w.buildings = [home, shop];
  w.resources = {};
  w.towns = [];
  w.settings.hungerRate = 4;
  w.settings.thirstRate = 0;
  Object.assign(p, {
    cash: 100000,
    bank: 0,
    fuel: 100,
    hunger: 10000,
    thirst: 0,
    inventory: {},
    x: 0,
    z: 0,
    home: home.id,
    atHome: false,
  });
  const plan = (away = 10000) => homecomingPlan(w, p, away, undefined, false);
  const transfers = (away = 10000) =>
    plan(away)
      .flatMap((s) => (s.kind === 'act' ? [s.action] : []))
      .filter((a) => a.type === 'trade' || a.type === 'stock');
  return {
    w,
    p,
    home,
    shop,
    plan,
    transfers,
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
test('pantry budget defaults and absent keys preserve shopping and need allowance', () => {
  const { w, transfers } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  assert.equal(transfers()[0]?.quantity, 2);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(transfers()[0]?.quantity, 2);
});
test('pantry allowance and shopping batches alter real plans without grants', () => {
  const { w, p, home, shop, edit, transfers } = setup();
  const before = { cash: p.cash, stock: structuredClone(shop.stock) };
  edit({ npcPantryNeedAllowance: 0 });
  assert.equal(transfers()[0]?.quantity, 3);
  edit({ npcProvisionBatchLimit: 1 });
  assert.equal(transfers()[0]?.quantity, 1);
  edit({ npcProvisionBatchLimit: 0 });
  assert.deepEqual(transfers(), []);
  assert.equal(p.cash, before.cash);
  assert.deepEqual(shop.stock, before.stock);
  edit({ npcProvisionBatchLimit: 20, transactionItemLimit: 1 });
  assert.equal(transfers()[0]?.quantity, 1);
  shop.owner = p.id;
  const owned = transfers()[0];
  assert.equal(owned.type, 'stock');
  assert.equal(owned.quantity, 1);
  assert.equal(owned.direction, 'withdraw');
  act(w, p.id, owned);
  assert.equal(p.inventory.bread, 1);
  assert.equal(shop.stock.bread, 99);
  assert.equal(p.cash, before.cash);
  p.inventory.bread = 10;
  edit({ npcPantryNeedAllowance: 0 });
  const deposit = transfers()[0];
  assert.equal(deposit.type, 'stock');
  assert.equal(deposit.direction, 'deposit');
  assert.equal(deposit.quantity, 1);
  const total = p.inventory.bread + (home.stock.bread ?? 0);
  act(w, p.id, deposit);
  assert.equal(p.inventory.bread + home.stock.bread, total);
});
test('unhoused provision count and protected drink cash retain separate zero semantics', () => {
  const { w, p, home, edit, transfers } = setup();
  w.buildings = w.buildings.filter((b) => b !== home);
  w.settings.hungerRate = 0;
  p.hunger = 15000;
  p.thirst = 15000;
  p.cash = 1600;
  assert.equal(transfers()[0]?.quantity, 1, 'food protects 1500 for drinks');
  edit({ npcProvisionDrinkCashReserve: 0 });
  assert.equal(transfers()[0]?.quantity, 2);
  edit({ npcUnhousedProvisionItems: 5 });
  assert.equal(transfers()[0]?.quantity, 5);
  edit({ npcUnhousedProvisionItems: 0 });
  assert.deepEqual(transfers(), []);
});
test('lodging padding and cash reserve govern exact booking boundaries and ordinary payment', () => {
  const { w, p, edit, plan } = setup();
  w.settings.hungerRate = 0;
  p.hunger = p.thirst = 0;
  p.cash = 2200;
  const inn = makeBuilding('inn', 'bnb', 0, 0);
  inn.owner = 'host';
  inn.lodging = { open: true, rate: 100, guests: {} };
  w.buildings = [inn];
  const booking = () => plan(3000).find((s) => s.kind === 'operation' && s.operation === 'lodging');
  const initial = booking();
  assert.ok(initial && initial.kind === 'operation');
  assert.equal(operationAction(initial).hours, 2);
  p.cash = 2199;
  assert.equal(booking(), undefined);
  edit({ npcLodgingBufferSeconds: 0 });
  const one = booking();
  assert.ok(one && one.kind === 'operation');
  assert.equal(operationAction(one).hours, 1);
  edit({ npcLodgingCashReserve: 0 });
  p.cash = 100;
  const paid = booking();
  assert.ok(paid && paid.kind === 'operation');
  const capital = inn.investment;
  act(w, p.id, operationAction(paid));
  assert.equal(p.cash, 0);
  assert.equal(inn.investment, capital + 100);
  assert.equal(inn.lodging.guests[p.id].until, w.time + 3600);
});
test('pantry budget fields validate and persist in editor summaries observations designs and saves', async () => {
  const { w, p, edit } = setup();
  for (const patch of [
    { npcPantryNeedAllowance: -1 },
    { npcUnhousedProvisionItems: 101 },
    { npcProvisionDrinkCashReserve: 1.5 },
    { npcProvisionBatchLimit: 10001 },
    { npcLodgingBufferSeconds: 86401 },
    { npcLodgingCashReserve: 100000001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    npcPantryNeedAllowance: 12345,
    npcUnhousedProvisionItems: 7,
    npcProvisionDrinkCashReserve: 2345678,
    npcProvisionBatchLimit: 11,
    npcLodgingBufferSeconds: 3456,
    npcLodgingCashReserve: 45678,
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { gameplayChoices } from '../src/server/npc/farmer';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = { npcShoppingFuelTarget: 2, npcShoppingDrinkTarget: 6, npcShoppingFoodTarget: 3 };
function setup() {
  const w = createWorld('owner-reserve', 'Owner reserve', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('shop', 'market', 0, 0);
  w.buildings = [b];
  w.resources = {};
  w.towns = [];
  w.settings.salesTax = 0;
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(p, { cash: 100000, fuel: 64, inventory: {}, x: 0, z: 0, hunger: 0, thirst: 0 });
  Object.assign(b, {
    owner: 'seller',
    investment: 20000,
    wage: 0,
    buy: {},
    sell: { fuel: 100, water: 100, bread: 100 },
    stock: { fuel: 100, water: 100, bread: 100 },
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
    state,
    choices: () => gameplayChoices(w, p, state, 'farmer'),
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
const restocks = (choices: ReturnType<typeof gameplayChoices>) =>
  choices
    .filter((c) => c.description.startsWith('Restock '))
    .flatMap((c) => c.plan)
    .flatMap((s) => (s.kind === 'act' && s.action.type === 'trade' ? [s.action] : []));
const quantity = (choices: ReturnType<typeof gameplayChoices>, item: string) =>
  restocks(choices).find((a) => a.item === item)?.quantity;
test('provision-shopping defaults and absent fields preserve separate aggregate targets', () => {
  const { w, choices } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  for (const [item, n] of [
    ['fuel', 2],
    ['water', 6],
    ['bread', 3],
  ] as const)
    assert.equal(quantity(choices(), item), n);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  for (const [item, n] of [
    ['fuel', 2],
    ['water', 6],
    ['bread', 3],
  ] as const)
    assert.equal(quantity(choices(), item), n);
});
test('local shopping targets count all carried nutrients independently and zero suppresses only that restock', () => {
  const { p, choices, edit } = setup();
  edit({ npcShoppingFuelTarget: 4, npcShoppingDrinkTarget: 9, npcShoppingFoodTarget: 5 });
  p.inventory = { water: 1, coffee: 2, bread: 2, fuel: 1 };
  assert.equal(quantity(choices(), 'fuel'), 3);
  assert.equal(quantity(choices(), 'water'), 6);
  assert.equal(quantity(choices(), 'bread'), 3);
  edit({ npcShoppingDrinkTarget: 0 });
  assert.equal(quantity(choices(), 'water'), undefined);
  assert.equal(quantity(choices(), 'bread'), 3);
  edit({ npcShoppingFuelTarget: 0, npcShoppingFoodTarget: 0 });
  assert.deepEqual(restocks(choices()), []);
});
test('optional shopping obeys the existing transaction limit', () => {
  const { choices, edit } = setup();
  edit({ transactionItemLimit: 1 });
  for (const item of ['fuel', 'water', 'bread']) assert.equal(quantity(choices(), item), 1);
});
test('shopping is bounded by stock money and cargo and executes an ordinary conserved purchase', () => {
  const { w, p, b, choices } = setup();
  b.stock.water = 2;
  assert.equal(quantity(choices(), 'water'), 2);
  b.stock.water = 100;
  p.cash = 100;
  assert.equal(quantity(choices(), 'water'), 1);
  p.cash = 100000;
  p.inventory = { logs: 50 };
  assert.equal(quantity(choices(), 'water'), undefined);
  p.inventory = {};
  const a = restocks(choices()).find((a) => a.item === 'water')!;
  const money = p.cash + b.investment,
    goods = b.stock.water;
  act(w, p.id, a);
  assert.equal(p.cash + b.investment, money);
  assert.equal(b.stock.water + p.inventory.water, goods);
  assert.equal(p.inventory.water, 6);
});
test('carried owner inputs protect local Water and Bread reserves and bound ordinary stock deposits', () => {
  const { w, p, b, edit } = setup();
  b.owner = p.id;
  b.production = {
    skill: 'baker',
    tier: 1,
    seconds: 600,
    inputs: { water: 2, bread: 2 },
    outputs: { meals: 1 },
  };
  b.stock = {};
  b.sell = { meals: 1000 };
  b.buy = { water: 100, bread: 100 };
  p.inventory = { water: 10, bread: 10 };
  const supply = () =>
    enterpriseChoices(w, p)
      .filter((c) => c.description.includes('already aboard'))
      .flatMap((c) => c.plan)
      .flatMap((s) => (s.kind === 'act' && s.action.type === 'stock' ? [s.action] : []));
  assert.equal(supply().find((a) => a.item === 'water')?.quantity, 4);
  assert.equal(supply().find((a) => a.item === 'bread')?.quantity, 7);
  edit({ npcPortableWater: 8, npcPortableBread: 9 });
  assert.equal(supply().find((a) => a.item === 'water')?.quantity, 2);
  assert.equal(supply().find((a) => a.item === 'bread')?.quantity, 1);
  edit({ transactionItemLimit: 1 });
  assert.equal(supply().find((a) => a.item === 'water')?.quantity, 1);
  const water = p.inventory.water + (b.stock.water ?? 0);
  act(
    w,
    p.id,
    supply().find((a) => a.item === 'water')!,
  );
  assert.equal(p.inventory.water + (b.stock.water ?? 0), water);
  assert.equal(p.inventory.water, 9);
  edit({ npcPortableWater: 10, npcPortableBread: 10 });
  assert.deepEqual(supply(), []);
});
test('shopping budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const k of Object.keys(defaults))
    for (const v of [-1, 0.5, 10001]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = { npcShoppingFuelTarget: 7, npcShoppingDrinkTarget: 11, npcShoppingFoodTarget: 13 };
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { propertyQuote } from '../src/shared/property';
import { appearance } from '../src/shared/appearance';
import { adaptiveChoices } from '../src/server/npc/adaptive';
import { gameplayChoices } from '../src/server/npc/farmer';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = {
  npcPropertyCashReserve: 20000,
  npcPaintCashThreshold: 20000,
  npcFarmFundingTillThreshold: 10000,
  npcFarmFundingCashThreshold: 15000,
  npcFarmFundingAmount: 5000,
};
function setup() {
  const w = createWorld('owner-reserve', 'Owner reserve', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('farm', 'farm', 0, 0);
  w.buildings = [b];
  w.resources = {};
  w.towns = [];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(p, { cash: 1000, fuel: 64, inventory: {}, x: 0, z: 0, hunger: 0, thirst: 0 });
  Object.assign(b, { owner: p.id, investment: 20000, wage: 0, buy: {}, sell: {}, stock: {} });
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
    adaptive: () => adaptiveChoices(w, p, state),
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
const deposits = (choices: ReturnType<typeof gameplayChoices>) =>
  choices
    .filter((c) => c.description.startsWith('Fund seeds'))
    .flatMap((c) => c.plan)
    .flatMap((s) => (s.kind === 'act' && s.action.type === 'investment' ? [s.action] : []));
test('discretionary defaults and absent fields preserve farm funding', () => {
  const { w, p, b, choices } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  p.cash = 20000;
  b.investment = 0;
  assert.equal(deposits(choices())[0]?.amount, 5000);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(deposits(choices())[0]?.amount, 5000);
});
test('farmer and general property choices share the local reserve and exact boundary', () => {
  const { w, p, b, choices, adaptive, edit } = setup();
  b.owner = undefined;
  b.government = false;
  b.investment = 0;
  const quote = propertyQuote(w, b).total;
  const farmBuy = () => choices().find((c) => c.description.startsWith(`Buy ${b.name} for`));
  const generalBuy = () => adaptive().find((c) => c.description.startsWith(`Buy ${b.name} (farm)`));
  p.cash = quote + 19999;
  assert.ok(!farmBuy());
  assert.ok(!generalBuy());
  p.cash++;
  assert.ok(farmBuy());
  assert.ok(generalBuy());
  edit({ npcPropertyCashReserve: 321 });
  p.cash = quote + 320;
  assert.ok(!farmBuy());
  assert.ok(!generalBuy());
  p.cash++;
  assert.match(farmBuy()!.description, /retain at least 321/);
  assert.ok(generalBuy());
  edit({ npcPropertyCashReserve: 0 });
  p.cash = quote;
  assert.ok(farmBuy());
  assert.ok(generalBuy());
  assert.equal(b.owner, undefined);
  assert.equal(p.cash, quote);
});
test('paint threshold is strict and never overrides actual affordability', () => {
  const { w, p, adaptive, edit } = setup();
  const garage = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [garage];
  const paint = () => adaptive().filter((c) => c.description.startsWith('Paint my tractor'));
  p.cash = 20000;
  assert.equal(paint().length, 0);
  p.cash++;
  assert.ok(paint().length > 0);
  edit({ npcPaintCashThreshold: 30000 });
  assert.equal(paint().length, 0);
  p.cash = 30001;
  assert.ok(paint().length > 0);
  edit({ npcPaintCashThreshold: 0 });
  p.cash = appearance.paintPrice - 1;
  assert.equal(paint().length, 0);
  p.cash = appearance.paintPrice;
  assert.ok(paint().length > 0);
});
test('farm funding uses independent thresholds, zero and actual cash and transfer caps', () => {
  const { w, p, b, choices, edit } = setup();
  b.investment = 0;
  p.cash = 15000;
  assert.equal(deposits(choices()).length, 0);
  p.cash++;
  assert.equal(deposits(choices())[0]?.amount, 5000);
  b.investment = 10000;
  assert.equal(deposits(choices()).length, 0);
  edit({
    npcFarmFundingTillThreshold: 12000,
    npcFarmFundingCashThreshold: 100,
    npcFarmFundingAmount: 200,
  });
  p.cash = 101;
  assert.equal(deposits(choices())[0]?.amount, 101);
  p.cash = 500;
  edit({ cashTransferLimit: 50 });
  const a = deposits(choices())[0];
  assert.equal(a?.amount, 50);
  assert.match(
    choices().find((c) => c.description.startsWith('Fund seeds'))!.description,
    /deposit 50 cash/,
  );
  const total = p.cash + b.investment;
  act(w, p.id, a);
  assert.equal(p.cash + b.investment, total);
  assert.equal(b.investment, 10050);
  edit({ npcFarmFundingAmount: 0 });
  assert.equal(deposits(choices()).length, 0);
  edit({ npcFarmFundingAmount: 200, npcFarmFundingTillThreshold: 0 });
  assert.equal(deposits(choices()).length, 0);
  edit({ npcFarmFundingTillThreshold: 12000, npcFarmFundingCashThreshold: 0 });
  p.cash = 0;
  assert.equal(deposits(choices()).length, 0);
});
test('discretionary budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const k of Object.keys(defaults))
    for (const v of [-1, 0.5, 100000001]) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    npcPropertyCashReserve: 12345,
    npcPaintCashThreshold: 23456,
    npcFarmFundingTillThreshold: 34567,
    npcFarmFundingCashThreshold: 45678,
    npcFarmFundingAmount: 56789,
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

test('farm funding respects an existing reduced transfer cap', () => {
  const { p, b, choices, edit } = setup();
  p.cash = 20000;
  b.investment = 0;
  edit({ cashTransferLimit: 50 });
  assert.equal(deposits(choices())[0]?.amount, 50);
});

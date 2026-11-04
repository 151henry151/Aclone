// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { townCharter } from '../src/shared/town-charter';
import { skillLesson } from '../src/shared/world-catalogue';
import { groupInterest } from '../src/server/npc/group-chat';
import { npcConfigSchema } from '../src/server/npc/config';
import { settlementChoices } from '../src/server/npc/civic-ambition';
import { strategicHouseholdBudget } from '../src/server/npc/household';
import { accounts } from '../src/shared/reports';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = { npcGroupTrainingCashReserve: 5000, npcTownFoundingCostMultiplier: 4 };
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
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
const offer = 'Everyone, I am hiring farmers; would you train as a farmer?';
function interestFixture() {
  const f = setup();
  f.p.online = true;
  f.p.skills = [];
  const c = {
    state: f.state,
    config: npcConfigSchema.parse({ id: 'owner', preference: 'farmer' }),
  };
  return {
    ...f,
    interest: () => groupInterest(f.w, f.p, c, offer),
    tuition: skillLesson(f.w, f.p, 'farmer').price,
  };
}
test('training interest preserves default and missing-field budget boundaries', () => {
  const { w, p, interest, tuition } = interestFixture();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  p.cash = tuition + 4999;
  assert.equal(interest(), undefined);
  p.cash++;
  assert.ok(interest());
  delete (w.settings as any).npcGroupTrainingCashReserve;
  assert.ok(interest());
  p.cash--;
  assert.equal(interest(), undefined);
});
test('local training cushion and zero never waive tuition or accept a job', () => {
  const { w, p, interest, tuition, edit } = interestFixture();
  edit({ npcGroupTrainingCashReserve: 200 });
  p.cash = tuition + 199;
  assert.equal(interest(), undefined);
  p.cash++;
  assert.ok(interest());
  edit({ npcGroupTrainingCashReserve: 0 });
  p.cash = tuition - 1;
  assert.equal(interest(), undefined);
  p.cash++;
  assert.ok(interest());
  assert.equal(p.cash, tuition);
  assert.deepEqual(p.skills, []);
  assert.equal(p.job, undefined);
  assert.equal(p.learning, undefined);
  p.learning = { skill: 'baker', end: w.time + 10 } as any;
  assert.equal(interest(), undefined);
});
function townFixture() {
  const w = createWorld('puddlewick', 'Town', 'owner'),
    p = addPlayer(w, 'owner', 'Ada Brook');
  w.settings.seaLevel = -100;
  p.inventory = { bread: 10, water: 20 };
  p.cash = 5000000;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  home.stock = { bread: 100, water: 100 };
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.investment = 100000;
  accounts(w, mill).receipts = 20000;
  Object.assign(p, { x: 0, z: 0 });
  return {
    w,
    p,
    mill,
    choices: () => settlementChoices(w, p),
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
  };
}
test('town ambition uses local charter multiple while retaining actual costs and funded holdings', () => {
  const { w, p, mill, choices, edit } = townFixture();
  const cost = townCharter(w).foundingCost,
    living = strategicHouseholdBudget(w, p).reserve;
  p.cash = living + 4 * cost - 1;
  assert.deepEqual(choices(), []);
  p.cash++;
  assert.ok(choices().length);
  delete (w.settings as any).npcTownFoundingCostMultiplier;
  assert.ok(choices().length);
  edit({ npcTownFoundingCostMultiplier: 5.25 });
  p.cash = living + 5.25 * cost - 1;
  assert.deepEqual(choices(), []);
  p.cash++;
  assert.ok(choices().length);
  const money = p.cash,
    towns = w.towns.length;
  assert.ok(choices().length);
  assert.equal(p.cash, money);
  assert.equal(w.towns.length, towns);
  edit({ npcTownFoundingCostMultiplier: 0 });
  p.cash = living + cost - 1;
  assert.deepEqual(choices(), []);
  p.cash = 5000000;
  assert.ok(choices().length);
  mill.investment = 0;
  assert.deepEqual(choices(), []);
});
test('ambition budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const patch of [
    { npcGroupTrainingCashReserve: -1 },
    { npcGroupTrainingCashReserve: 0.5 },
    { npcGroupTrainingCashReserve: 100000001 },
    { npcTownFoundingCostMultiplier: -1 },
    { npcTownFoundingCostMultiplier: 101 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = { npcGroupTrainingCashReserve: 12345, npcTownFoundingCostMultiplier: 7.25 };
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

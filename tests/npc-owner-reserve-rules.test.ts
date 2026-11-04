// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { ownerDrawNeed, addOutsideStake, remainingClaim } from '../src/shared/stakes';
import { inventHypotheses } from '../src/server/npc/hypotheses';
import { retainedCapital } from '../src/server/npc/business-policy';
import type { ResidentState } from '../src/server/npc/memory';
import { Store } from '../src/server/store';
const defaults = { npcOwnerCashFloor: 4000, npcOwnerFuelThreshold: 10, npcOwnerFuelFallback: 800 };
function setup() {
  const w = createWorld('owner-reserve', 'Owner reserve', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('shop', 'market', 0, 0);
  w.buildings = [b];
  w.resources = {};
  w.towns = [];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(p, { cash: 1000, fuel: 0, inventory: {}, x: 0, z: 0, hunger: 0, thirst: 0 });
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
test('owner reserve defaults and missing fields preserve the distinct discretionary draw', () => {
  const { w, p } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  assert.equal(ownerDrawNeed(w, p), 3800);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.equal(ownerDrawNeed(w, p), 3800);
});
test('owner draw rules use stocked observed fuel prices before fallback and respect zero and carried fuel', () => {
  const { w, p, edit } = setup();
  edit({ npcOwnerCashFloor: 2000, npcOwnerFuelThreshold: 5, npcOwnerFuelFallback: 300 });
  assert.equal(ownerDrawNeed(w, p), 1300);
  const fuel = makeBuilding('fuel', 'refinery', 20, 0);
  fuel.sell = { fuel: 700 };
  fuel.stock = { fuel: 1 };
  w.buildings.push(fuel);
  assert.equal(ownerDrawNeed(w, p), 1700);
  fuel.stock.fuel = 0;
  assert.equal(ownerDrawNeed(w, p), 1300);
  p.inventory.fuel = 1;
  assert.equal(ownerDrawNeed(w, p), 1000);
  p.inventory = {};
  p.fuel = 5;
  assert.equal(ownerDrawNeed(w, p), 1000);
  p.fuel = 0;
  edit({ npcOwnerCashFloor: 0, npcOwnerFuelThreshold: 0 });
  assert.equal(ownerDrawNeed(w, p), 0);
  edit({ npcOwnerFuelThreshold: 5, npcOwnerFuelFallback: 0 });
  assert.equal(ownerDrawNeed(w, p), 0);
});
test('changed draw plans execute ordinary conserved withdrawals while protecting claims reserves and transfer caps', () => {
  const { w, p, b, state, edit } = setup();
  edit({ npcOwnerCashFloor: 10000, npcOwnerFuelThreshold: 0, cashTransferLimit: 500 });
  addOutsideStake(w, b, 'investor', 10000);
  const draw = () =>
    inventHypotheses(w, p, state)
      .filter((c) => c.idea === 'withdraw till')
      .flatMap((c) => c.plan)
      .flatMap((s) => (s.kind === 'act' ? [s.action] : []))
      .filter((a) => a.type === 'investment')
      .filter((a) => a.direction === 'withdraw');
  const a = draw()[0];
  assert.ok(a);
  assert.equal(a.amount, 500);
  const total = p.cash + b.investment,
    claim = remainingClaim(b);
  act(w, p.id, a);
  assert.equal(p.cash + b.investment, total);
  assert.equal(remainingClaim(b), claim);
  assert.ok(b.investment >= claim + retainedCapital(w, b));
  b.investment = claim + retainedCapital(w, b);
  assert.deepEqual(draw(), []);
});
test('owner reserve settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state, edit } = setup();
  for (const patch of [
    { npcOwnerCashFloor: -1 },
    { npcOwnerCashFloor: 100000001 },
    { npcOwnerFuelFallback: 1.5 },
    { npcOwnerFuelThreshold: 1000001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = { npcOwnerCashFloor: 12345, npcOwnerFuelThreshold: 7.5, npcOwnerFuelFallback: 678 };
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { journeyEstimate, careerChoices } from '../src/server/npc/projects';
import { drivePlan } from '../src/server/npc/travel';
import { Store } from '../src/server/store';
import type { ResidentState } from '../src/server/npc/memory';
import type { Step } from '../src/server/npc/decision';
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
  npcJourneyDistanceMultiplier: 1.5,
  npcJourneySpeedFraction: 0.6,
  npcJourneyFuelFallbackPrice: 4500,
  npcEquipmentPaybackLoads: 8,
  npcDriveFuelThreshold: 10,
};
const invalidValues = {
  npcJourneyDistanceMultiplier: [0.9, 10.1],
  npcJourneySpeedFraction: [0, 1.01],
  npcJourneyFuelFallbackPrice: [-1, 0.5, 100000001],
  npcEquipmentPaybackLoads: [-1, 1001],
  npcDriveFuelThreshold: [-1, 1000001],
};
function setup() {
  const w = createWorld('test', 'Test', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, seaLevel: -10 });
  Object.assign(p, {
    cash: 1000000,
    inventory: {},
    fuel: 15,
    vehicle: 0,
    engine: true,
    hunger: 0,
    thirst: 0,
    x: 0,
    z: 0,
  });
  const state = memoryState(w, p);
  return { w, p, state };
}
const buysFuel = (plan: Step[]) =>
  plan.some(
    (s) =>
      s.kind === 'act' &&
      s.action.type === 'trade' &&
      s.action.item === 'fuel' &&
      s.action.direction === 'buy',
  );
test('journey estimates preserve defaults and missing fields across quoted unquoted walking and multi-leg routes', () => {
  for (const missing of [false, true]) {
    const { w, p } = setup();
    for (const [k, v] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[k];
      else assert.equal((w.settings as any)[k], v, k);
    }
    w.buildings = [];
    w.vehicleTuning = { 0: { speed: 10, fuel: 0.2 }, 5: { speed: 5 } };
    assert.deepEqual(
      journeyEstimate(w, p, [
        { x: 60, z: 0 },
        { x: 100, z: 0 },
      ]),
      { seconds: 25, cost: 2813 },
    );
    assert.deepEqual(journeyEstimate(w, p, []), { seconds: 0, cost: 0 });
    const shop = makeBuilding('shop', 'market', 0, 0);
    shop.stock = { fuel: 10 };
    shop.sell = { fuel: 1000 };
    const empty = makeBuilding('empty', 'market', 0, 0);
    empty.stock = { fuel: 0 };
    empty.sell = { fuel: 1 };
    w.buildings = [shop, empty];
    assert.deepEqual(journeyEstimate(w, p, [{ x: 100, z: 0 }]), { seconds: 25, cost: 625 });
    p.fuel = 0;
    assert.deepEqual(journeyEstimate(w, p, [{ x: 100, z: 0 }]), { seconds: 50, cost: 0 });
  }
});
test('journey distance speed and fallback price budgets change estimates without actual transfers', () => {
  const { w, p } = setup();
  w.buildings = [];
  w.vehicleTuning = { 0: { speed: 10, fuel: 0.2 } };
  Object.assign(w.settings, {
    npcJourneyDistanceMultiplier: 2,
    npcJourneySpeedFraction: 0.5,
    npcJourneyFuelFallbackPrice: 1000,
  });
  assert.deepEqual(journeyEstimate(w, p, [{ x: 100, z: 0 }]), { seconds: 40, cost: 1000 });
  Object.assign(w.settings, { npcJourneyFuelFallbackPrice: 0 });
  assert.deepEqual(journeyEstimate(w, p, [{ x: 100, z: 0 }]), { seconds: 40, cost: 0 });
  assert.equal(p.cash, 1000000);
  assert.equal(p.fuel, 15);
});
test('equipment payback budget is inclusive at its boundary and zero preserves owned implements', () => {
  const { w, p, state } = setup();
  p.fuel = 0;
  p.vehicle = 5;
  p.inventory = { bread: 6, water: 10 };
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  for (const b of w.buildings) delete b.sell.chainsaw;
  shop.sell.chainsaw = 1000;
  shop.stock.chainsaw = 4;
  shop.buy.logs = 1500;
  shop.investment = 100000;
  const choice = () =>
    careerChoices(w, p, state).find(
      (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
    );
  const initial = choice();
  assert.ok(initial);
  const earned = initial.expectedCash! + 1000;
  shop.sell.chainsaw = earned * 8;
  assert.ok(choice());
  delete (w.settings as any).npcEquipmentPaybackLoads;
  assert.ok(choice());
  shop.sell.chainsaw++;
  assert.equal(choice(), undefined);
  Object.assign(w.settings, { npcEquipmentPaybackLoads: 1 });
  shop.sell.chainsaw = earned;
  assert.ok(choice());
  shop.sell.chainsaw++;
  assert.equal(choice(), undefined);
  Object.assign(w.settings, { npcEquipmentPaybackLoads: 0 });
  shop.sell.chainsaw = 1;
  assert.equal(choice(), undefined);
  p.inventory.chainsaw = 1;
  assert.ok(choice());
});
test('drive fuel threshold controls optional shopping without stranding an empty tank', () => {
  const { w, p } = setup();
  p.fuel = 9.9;
  assert.ok(buysFuel(drivePlan(w, p)));
  delete (w.settings as any).npcDriveFuelThreshold;
  assert.ok(buysFuel(drivePlan(w, p)));
  p.fuel = 10;
  assert.equal(buysFuel(drivePlan(w, p)), false);
  Object.assign(w.settings, { npcDriveFuelThreshold: 20 });
  p.fuel = 15;
  assert.ok(buysFuel(drivePlan(w, p)));
  p.cash = 0;
  assert.equal(buysFuel(drivePlan(w, p)), false);
  p.cash = 1000000;
  Object.assign(w.settings, { npcDriveFuelThreshold: 0 });
  p.fuel = 0;
  assert.equal(buysFuel(drivePlan(w, p)), false);
  assert.ok(
    drivePlan(w, p).some(
      (s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 5,
    ),
  );
  p.inventory.fuel = 1;
  const plan = drivePlan(w, p);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'use' && s.action.item === 'fuel'),
  );
  assert.equal(buysFuel(plan), false);
  assert.equal(p.fuel, 0);
  assert.equal(p.inventory.fuel, 1);
});
test('journey budget settings validate and survive editor summary observations designs and reload', async () => {
  const { w, p, state } = setup();
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  for (const [k, invalid] of Object.entries(invalidValues))
    for (const v of invalid) {
      const before = JSON.stringify(w);
      assert.throws(() => edit({ [k]: v }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    npcJourneyDistanceMultiplier: 2,
    npcJourneySpeedFraction: 0.5,
    npcJourneyFuelFallbackPrice: 1234,
    npcEquipmentPaybackLoads: 3,
    npcDriveFuelThreshold: 25,
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

test('refuelling experiments follow the drive threshold and retain carried emergency fuel', async () => {
  const { inventHypotheses } = await import('../src/server/npc/hypotheses');
  const { w, p, state } = setup();
  const shop = makeBuilding('fuel-shop', 'market', 20, 0);
  Object.assign(shop, { owner: 'seller', sell: { fuel: 100 }, stock: { fuel: 10 }, buy: {} });
  w.buildings = [shop];
  const idea = (id: string) => inventHypotheses(w, p, state).find((c) => c.idea === id);
  p.fuel = 9.9;
  assert.ok(idea('buy fuel'));
  delete w.settings.npcDriveFuelThreshold;
  assert.ok(idea('buy fuel'));
  p.fuel = 10;
  assert.equal(idea('buy fuel'), undefined);
  w.settings.npcDriveFuelThreshold = 20;
  p.fuel = 15;
  assert.ok(idea('buy fuel'));
  p.fuel = 20;
  assert.equal(idea('buy fuel'), undefined);
  w.settings.npcDriveFuelThreshold = 0;
  p.fuel = 0;
  assert.equal(idea('buy fuel'), undefined);
  p.inventory.fuel = 1;
  const recovery = idea('refuel');
  assert.ok(recovery);
  const use = recovery.plan.find((s) => s.kind === 'act' && s.action.type === 'use');
  assert.ok(use?.kind === 'act' && use.action.type === 'use');
  act(w, p.id, use.action);
  assert.ok(p.fuel > 0);
  assert.equal(p.inventory.fuel ?? 0, 0);
  assert.equal(idea('refuel'), undefined);
});

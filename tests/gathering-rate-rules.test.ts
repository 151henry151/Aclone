// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  terrainHeight,
} from '../src/shared/simulation';
import {
  worldResources,
  gatheringStatus,
  resourceAmount,
  cancelGather,
} from '../src/shared/resources';
import { careerChoices, journeyEstimate } from '../src/server/npc/projects';
import { economyChoices } from '../src/server/npc/economy-choices';
import { Store } from '../src/server/store';
const defaults = {
  gatheringBaseYield: 3,
  gatheringSkilledYield: 6,
  gatheringBaseSeconds: 20,
  gatheringSkilledSeconds: 12,
};
function setup() {
  const w = createWorld('gather-rates', 'Gather', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.resources = {};
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const n = worldResources(w).find((n) => n.item === 'dirt')!;
  Object.assign(p, {
    x: n.x,
    z: n.z,
    y: terrainHeight(w, n.x, n.z),
    cash: 1000000,
    vehicle: 0,
    fuel: 64,
    inventory: { shovel: 1 },
  });
  return { w, p, n };
}
test('gathering defaults and missing fields preserve basic and skilled rates', () => {
  for (const missing of [false, true]) {
    const { w, p, n } = setup();
    for (const [k, v] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[k];
      else assert.equal((w.settings as any)[k], v);
    }
    assert.equal(gatheringStatus(w, p, n).amount, 3);
    assert.equal(gatheringStatus(w, p, n).seconds, 20);
    p.skills = ['excavator'];
    assert.equal(gatheringStatus(w, p, n).amount, 6);
    assert.equal(gatheringStatus(w, p, n).seconds, 12);
  }
});
test('custom swapped yields use skill-selected durations and preserve in-flight work and cancellation', () => {
  const { w, p, n } = setup();
  Object.assign(w.settings, {
    gatheringBaseYield: 6,
    gatheringSkilledYield: 3,
    gatheringBaseSeconds: 7,
    gatheringSkilledSeconds: 9,
  });
  assert.equal(gatheringStatus(w, p, n).seconds, 7);
  const available = resourceAmount(w, n);
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(p.task!.amount, 6);
  assert.equal(p.task!.end, w.time + 7);
  assert.equal(resourceAmount(w, n), available - 6);
  act(w, p.id, { type: 'settings', patch: { gatheringBaseYield: 2, gatheringBaseSeconds: 4 } });
  advance(w, 6);
  assert.equal(p.inventory.dirt, undefined);
  advance(w, 1);
  assert.equal(p.inventory.dirt, 6);
  p.skills = ['excavator'];
  assert.equal(gatheringStatus(w, p, n).seconds, 9);
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(p.task!.amount, 3);
  cancelGather(w, p);
  assert.equal(resourceAmount(w, n), available - 6);
  cancelGather(w, p);
  assert.equal(resourceAmount(w, n), available - 6);
  p.skills = [];
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(p.task!.amount, 2);
  advance(w, 4);
  assert.equal(p.inventory.dirt, 8);
});
test('configured load governs resource and cargo refusal without reserving on failure', () => {
  const { w, p, n } = setup();
  Object.assign(w.settings, { gatheringBaseYield: 2 });
  w.resources![n.id] = { amount: 1, updated: w.time };
  assert.match(gatheringStatus(w, p, n).reason!, /replenish/);
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'gather', node: n.id }), /replenish/);
  assert.equal(JSON.stringify(w), before);
  w.resources![n.id].amount = 2;
  assert.equal(gatheringStatus(w, p, n).reason, undefined);
  Object.assign(w.settings, { gatheringBaseYield: 1000 });
  w.resources![n.id].amount = 1000;
  assert.match(gatheringStatus(w, p, n).reason!, /replenish/);
  Object.assign(w.settings, { gatheringBaseYield: 2 });
  p.inventory.stone = 10000;
  assert.match(gatheringStatus(w, p, n).reason!, /cargo/);
});
test('resident career batches duration and ordinary choices follow configured gathering rates', () => {
  const { w, p, n } = setup();
  Object.assign(w.settings, { gatheringBaseYield: 2, gatheringBaseSeconds: 7 });
  const buyer = makeBuilding('buyer', 'market', n.x + 20, n.z);
  Object.assign(buyer, {
    owner: 'buyer',
    buy: { dirt: 1000 },
    sell: {},
    stock: {},
    investment: 1000000,
  });
  w.buildings = [buyer];
  w.resources![n.id] = { amount: 2, updated: w.time };
  const state = { plan: [], index: 0 } as any;
  const choice = careerChoices(w, p, state).find((c) => c.careerGoal?.target === n.id);
  assert.ok(choice);
  assert.match(choice.description, /gather 2 dirt/);
  assert.equal(choice.durationSeconds, journeyEstimate(w, p, [n, buyer]).seconds + 7);
  const plans: any[] = [];
  economyChoices(
    w,
    p,
    [],
    (description, plan) => plans.push({ description, plan }),
    (_b, steps) => steps,
  );
  assert.ok(
    plans.some((c) =>
      c.plan.some(
        (s: any) => s.kind === 'act' && s.action.type === 'gather' && s.action.node === n.id,
      ),
    ),
  );
  Object.assign(w.settings, { gatheringBaseYield: 3 });
  const refused: any[] = [];
  economyChoices(
    w,
    p,
    [],
    (description, plan) => refused.push({ description, plan }),
    (_b, steps) => steps,
  );
  assert.ok(
    !refused.some((c) =>
      c.plan.some(
        (s: any) => s.kind === 'act' && s.action.type === 'gather' && s.action.node === n.id,
      ),
    ),
  );
});
test('gathering rates validate and persist in controls summaries observations designs and saves', async () => {
  const { w, p } = setup();
  for (const key of Object.keys(defaults))
    for (const value of [0, 1.5, key.endsWith('Yield') ? 1001 : 601, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: value } }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = {
    gatheringBaseYield: 2,
    gatheringSkilledYield: 4,
    gatheringBaseSeconds: 7,
    gatheringSkilledSeconds: 5,
  };
  act(w, p.id, { type: 'settings', patch });
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      observation = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((observation.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

test('larger skilled loads do not hide carried sales within a smaller transaction limit', () => {
  const { w, p, n } = setup();
  p.skills = ['excavator'];
  p.inventory.dirt = 3;
  Object.assign(w.settings, { transactionItemLimit: 2 });
  w.resources![n.id] = { amount: 0, updated: w.time };
  const buyer = makeBuilding('buyer', 'market', n.x + 20, n.z);
  Object.assign(buyer, {
    owner: 'buyer',
    buy: { dirt: 1000 },
    sell: {},
    stock: {},
    investment: 1000000,
  });
  w.buildings = [buyer];
  const choice = careerChoices(w, p, { plan: [], index: 0 } as any).find(
    (c) => c.careerGoal?.target === n.id,
  );
  assert.ok(choice);
  assert.ok(!choice.plan.some((s) => s.kind === 'act' && s.action.type === 'gather'));
  const sale = choice.plan.find((s) => s.kind === 'act' && s.action.type === 'trade');
  assert.ok(sale?.kind === 'act' && sale.action.type === 'trade');
  assert.equal(sale.action.quantity, 2);
});

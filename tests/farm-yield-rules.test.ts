// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { cropStatus } from '../src/shared/farming';
import { creatorSchema } from '../src/shared/creator';
import { gameplayChoices, farmDuty } from '../src/server/npc/farmer';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('farm-yields', 'Farm yields', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = w.buildings.find((b) => b.kind === 'farm')!;
  w.creator = creatorSchema.parse({ weather: 'clear' });
  w.settings.hungerRate = w.settings.thirstRate = 0;
  b.owner = p.id;
  b.investment = 100000;
  b.stock = { compost: 1 };
  b.plots = Array.from({ length: 4 }, () => ({
    crop: 'wheat',
    planted: w.time,
    ready: w.time + 10800,
    water: 3,
    fertilized: false,
    drainage: true,
  }));
  Object.assign(p, { x: b.x, z: b.z, skills: ['farmer'], inventory: {}, cash: 1000000 });
  return { w, p, b };
}
test('crop modifiers preserve default and missing-rule yields with weather and soil intact', () => {
  for (const missing of [false, true]) {
    const { w, b } = setup();
    if (missing) {
      delete (w.settings as any).farmCompostYieldBonus;
      delete (w.settings as any).farmRotationYieldPenalty;
    } else {
      assert.equal((w.settings as any).farmCompostYieldBonus, 0.33);
      assert.equal((w.settings as any).farmRotationYieldPenalty, 0.2);
    }
    assert.equal(cropStatus(w, b, 0).yield, 60);
    b.plots![0].fertilized = true;
    assert.equal(cropStatus(w, b, 0).yield, 79);
    b.plots![0].previous = 'wheat';
    assert.equal(cropStatus(w, b, 0).yield, 63);
    b.plots![0].fertilized = false;
    assert.equal(cropStatus(w, b, 0).yield, 48);
  }
});
test('custom and zero bonuses and penalties apply before flooring with minimum one unit', () => {
  const { w, p, b } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { farmCompostYieldBonus: 0.5, farmRotationYieldPenalty: 0.25 },
  });
  b.plots![0].fertilized = true;
  b.plots![0].previous = 'wheat';
  assert.equal(cropStatus(w, b, 0).yield, 67);
  b.plots![0].previous = 'potatoes';
  assert.equal(cropStatus(w, b, 0).yield, 90);
  b.plots![0].crop = 'grapes';
  b.plots![0].previous = 'hops';
  assert.equal(cropStatus(w, b, 0).yield, 90, 'family comparison includes different crops');
  act(w, p.id, {
    type: 'settings',
    patch: { farmCompostYieldBonus: 0, farmRotationYieldPenalty: 0 },
  });
  assert.equal(cropStatus(w, b, 0).yield, 80);
  act(w, p.id, { type: 'settings', patch: { farmRotationYieldPenalty: 1 } });
  assert.equal(cropStatus(w, b, 0).yield, 1);
});
test('compost and soil restoration consume real goods and harvest reservations retain their quoted amount', () => {
  const { w, p, b } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { farmCompostYieldBonus: 0.5, farmRotationYieldPenalty: 0.25 },
  });
  act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 });
  assert.equal(b.stock.compost, 0);
  assert.equal(cropStatus(w, b, 0).yield, 90);
  const before = JSON.stringify(b);
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'fertilize', plot: 0 }),
    /once/,
  );
  assert.equal(JSON.stringify(b), before);
  b.plots![1] = { planted: 0, ready: 0, water: 0, fertilized: false, previous: 'wheat' };
  p.inventory = { dirt: 6, compost: 1 };
  act(w, p.id, { type: 'farm', building: b.id, operation: 'improve', plot: 1 });
  assert.equal(b.plots![1].previous, undefined);
  assert.equal(p.inventory.dirt, 0);
  assert.equal(p.inventory.compost, 0);
  w.time = b.plots![0].ready;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  assert.equal(b.plots![0].harvest!.amount, 90);
  act(w, p.id, {
    type: 'settings',
    patch: { farmCompostYieldBonus: 0, farmRotationYieldPenalty: 0.5 },
  });
  advance(w, 15);
  assert.equal(b.stock.wheat, 90);
  advance(w, 15);
  assert.equal(b.stock.wheat, 90);
});
test('resident compost choices and fallback value follow the configured bonus', () => {
  const { w, p, b } = setup(),
    state = { plan: [], index: 0 } as any;
  w.buildings = [b];
  const fertilizes = (plan: any[]) =>
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'fertilize',
    );
  const choices = () => gameplayChoices(w, p, state, 'farmer');
  assert.ok(choices().some((c) => fertilizes(c.plan)));
  assert.ok(fertilizes(farmDuty(w, p, b, state)));
  act(w, p.id, { type: 'settings', patch: { farmCompostYieldBonus: 0 } });
  assert.ok(!choices().some((c) => fertilizes(c.plan)));
  assert.ok(!fertilizes(farmDuty(w, p, b, state)));
  b.stock.compost = 0;
  b.sell.wheat = 100;
  act(w, p.id, { type: 'settings', patch: { farmCompostYieldBonus: 0.33 } });
  assert.ok(!fertilizes(farmDuty(w, p, b, state)));
  act(w, p.id, { type: 'settings', patch: { farmCompostYieldBonus: 1 } });
  assert.ok(fertilizes(farmDuty(w, p, b, state)));
  b.plots = Array.from({ length: 4 }, () => ({
    planted: 0,
    ready: 0,
    water: 0,
    fertilized: false,
    previous: 'hay',
  }));
  const planting = () =>
    farmDuty(w, p, b, state).flatMap((s) =>
      s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'plant'
        ? [s.action.crop]
        : [],
    )[0];
  assert.equal(planting(), 'wheat');
  act(w, p.id, { type: 'settings', patch: { farmRotationYieldPenalty: 0 } });
  assert.equal(planting(), 'hay', 'zero penalty removes the rotation tie-break');
});
test('crop yield rules validate and persist through editor summaries observations designs and saves', async () => {
  const { w, p } = setup();
  for (const [key, max] of [
    ['farmCompostYieldBonus', 5],
    ['farmRotationYieldPenalty', 1],
  ] as const)
    for (const value of [-0.01, max + 0.01, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() => act(w, p.id, { type: 'settings', patch: { [key]: value } }));
      assert.equal(JSON.stringify(w), before);
    }
  const patch = { farmCompostYieldBonus: 0.5, farmRotationYieldPenalty: 0.25 };
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
      obs = observe(w, p, { plan: [], index: 0 } as any, new NpcMemory(store), 'resident');
    for (const [k, v] of Object.entries(patch)) {
      assert.ok(settingsFields().includes(`name="${k}"`));
      assert.ok(rulesSummary(w).includes(String(v)));
      assert.equal((dest.settings as any)[k], v);
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

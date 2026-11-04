// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { cropStatus, winterDeadline } from '../src/shared/farming';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
const patch = { farmRipeQualitySeconds: 600, farmLateMaximumLoss: 0.5, farmLateLossPerDay: 0.1 };
function setup() {
  const w = createWorld('ripe-quality', 'Ripe quality', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = w.buildings.find((b) => b.kind === 'farm')!;
  w.creator = creatorSchema.parse({ weather: 'clear' });
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(b, {
    owner: p.id,
    investment: 100000,
    stock: {},
    plots: [
      {
        crop: 'wheat',
        planted: w.time,
        ready: w.time + 10800,
        water: 3,
        fertilized: false,
        drainage: true,
      },
    ],
  });
  Object.assign(p, { x: b.x, z: b.z, skills: ['farmer'], cash: 1000000, inventory: {} });
  return { w, p, b };
}
test('ripe quality defaults and legacy fallbacks preserve exact boundaries and capped loss', () => {
  for (const missing of [false, true]) {
    const { w, b } = setup();
    if (missing) for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    for (const age of [-1, 0, 21599, 21600, 21601, 22200, 42600, 63600, 80000]) {
      w.time = b.plots![0].ready + age;
      const factor = Math.max(0.65, 1 - Math.max(0, age / 600 - 36) * 0.005);
      assert.equal(cropStatus(w, b, 0).yield, Math.floor(60 * factor));
    }
  }
});
test('custom quality settings preserve harvest reservations and winter losses', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch });
  const ready = b.plots![0].ready;
  for (const [age, yieldAmount] of [
    [0, 60],
    [600, 60],
    [1200, 54],
    [1800, 48],
    [3600, 30],
    [10000, 30],
  ]) {
    w.time = ready + age;
    assert.equal(cropStatus(w, b, 0).yield, yieldAmount);
  }
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  act(w, p.id, { type: 'settings', patch: { farmLateMaximumLoss: 0 } });
  advance(w, 15);
  assert.equal(b.stock.wheat, 30);
  Object.assign(b.plots![0], { crop: 'wheat', planted: 0, ready: 10800 });
  w.time = winterDeadline(0);
  assert.equal(cropStatus(w, b, 0).state, 'withered');
  assert.throws(
    () => act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 }),
    /winter|empty/i,
  );
  assert.equal(b.stock.wheat, 30);
  assert.equal(p.task, undefined);
  delete b.plots![0].crop;
  assert.equal(cropStatus(w, b, 0).yield, 0);
});
test('zero window starts decay at ripeness and zero rate or cap disables it', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch: { ...patch, farmRipeQualitySeconds: 0 } });
  w.time = b.plots![0].ready;
  assert.equal(cropStatus(w, b, 0).yield, 60);
  w.time += 600;
  assert.equal(cropStatus(w, b, 0).yield, 54);
  act(w, p.id, { type: 'settings', patch: { farmLateLossPerDay: 0 } });
  assert.equal(cropStatus(w, b, 0).yield, 60);
  act(w, p.id, { type: 'settings', patch: { farmLateLossPerDay: 1, farmLateMaximumLoss: 1 } });
  assert.equal(cropStatus(w, b, 0).yield, 1);
  act(w, p.id, { type: 'settings', patch: { farmLateMaximumLoss: 0 } });
  assert.equal(cropStatus(w, b, 0).yield, 60);
});
test('quality rules validate atomically and persist with editor summaries observations and designs', async () => {
  const { w, p } = setup();
  for (const [key, max] of [
    ['farmRipeQualitySeconds', 604800],
    ['farmLateMaximumLoss', 1],
    ['farmLateLossPerDay', 1],
  ] as const) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [
      -1,
      max + 1,
      NaN,
      Infinity,
      ...(key === 'farmRipeQualitySeconds' ? [0.5] : []),
    ]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { farmCompostYieldBonus: 1, [key]: value } }),
      );
      assert.equal(JSON.stringify(w), before);
    }
  }
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
      assert.equal((loaded.settings as any)[k], v);
      assert.equal((dest.settings as any)[k], v);
      assert.equal((obs.worldRules as any)[k], v);
    }
  } finally {
    store.close();
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation';
import { crops, cropStatus } from '../src/shared/farming';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
const original = {
  wheat: 0.25,
  potatoes: 0.7,
  hops: 0.5,
  grapes: 1,
  tea: 0.4,
  coffee: 1.3,
  hay: 0.2,
};
const patch = {
  farmFrostMaximumLoss: 0.8,
  farmWheatFrostSensitivity: 0.5,
  farmPotatoesFrostSensitivity: 0.1,
  farmHopsFrostSensitivity: 0.2,
  farmGrapesFrostSensitivity: 0.3,
  farmTeaFrostSensitivity: 0.4,
  farmCoffeeFrostSensitivity: 0.6,
  farmHayFrostSensitivity: 0.7,
};
function setup() {
  const w = createWorld('frost', 'Frost', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = w.buildings.find((b) => b.kind === 'farm')!;
  w.creator = creatorSchema.parse({ weather: 'snow' });
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(b, {
    owner: p.id,
    stock: {},
    investment: 100000,
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
  Object.assign(p, { x: b.x, z: b.z, skills: ['farmer'], inventory: {}, cash: 1000000 });
  return { w, p, b };
}
test('default and missing frost rules preserve all crop yields in clear and freezing weather', () => {
  for (const missing of [false, true])
    for (const frozen of [false, true]) {
      const { w, b } = setup();
      if (!frozen) w.creator = creatorSchema.parse({ weather: 'clear' });
      if (missing) for (const key of Object.keys(patch)) delete (w.settings as any)[key];
      for (const [crop, sensitivity] of Object.entries(original)) {
        b.plots![0].crop = crop;
        assert.equal(
          cropStatus(w, b, 0).yield,
          Math.floor(crops[crop].yield * Math.max(0.35, 1 - (frozen ? sensitivity : 0))),
        );
      }
    }
});
test('custom sensitivities and loss caps affect the matching crop and preserve harvest reservations', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch });
  for (const crop of Object.keys(original)) {
    b.plots![0].crop = crop;
    const key =
      `farm${crop[0].toUpperCase() + crop.slice(1)}FrostSensitivity` as keyof typeof patch;
    assert.equal(cropStatus(w, b, 0).yield, Math.floor(crops[crop].yield * (1 - patch[key])));
  }
  b.plots![0].crop = 'wheat';
  act(w, p.id, { type: 'settings', patch: { farmWheatFrostSensitivity: 5 } });
  assert.equal(cropStatus(w, b, 0).yield, Math.floor(60 * (1 - 0.8)));
  act(w, p.id, { type: 'settings', patch: { farmFrostMaximumLoss: 1 } });
  assert.equal(cropStatus(w, b, 0).yield, 1);
  act(w, p.id, {
    type: 'settings',
    patch: { farmWheatFrostSensitivity: 0.5, farmFrostMaximumLoss: 0.8 },
  });
  b.plots![0].ready = w.time;
  act(w, p.id, { type: 'farm', building: b.id, operation: 'harvest', plot: 0 });
  act(w, p.id, { type: 'settings', patch: { farmWheatFrostSensitivity: 0 } });
  advance(w, 15);
  assert.equal(b.stock.wheat, 30);
});
test('zero sensitivity and cap remove frost loss without changing empty plots', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'settings', patch: { farmWheatFrostSensitivity: 0 } });
  assert.equal(cropStatus(w, b, 0).yield, 60);
  act(w, p.id, {
    type: 'settings',
    patch: { farmWheatFrostSensitivity: 5, farmFrostMaximumLoss: 0 },
  });
  assert.equal(cropStatus(w, b, 0).yield, 60);
  delete b.plots![0].crop;
  assert.equal(cropStatus(w, b, 0).yield, 0);
});
test('frost rules validate and round trip through editor summary observations saves and designs', async () => {
  const { w, p } = setup();
  for (const key of Object.keys(patch)) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [-1, key === 'farmFrostMaximumLoss' ? 1.01 : 5.01, Infinity, NaN]) {
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

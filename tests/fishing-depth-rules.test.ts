// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { deepFishingWater } from '../src/shared/fishing-water';
import { fishingCatch } from '../src/shared/boat-fishing';
import { trawlWater, trawlAction } from '../src/shared/commercial-fishing';
import { Store } from '../src/server/store';
const patch = { fishingDeepDepth: 12, fishingShoreDistance: 60 };
function setup() {
  const w = createWorld('depth-rules', 'Depth rules', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, { vehicle: 30, x: 0, z: 230, engine: true, fuel: 100, speed: 0 });
  return { w, p };
}
test('default and missing offshore rules preserve shared rod and net boundaries', () => {
  for (const missing of [false, true]) {
    const { w, p } = setup();
    if (missing) for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    assert.equal(deepFishingWater(w, p), false);
    assert.equal(trawlWater(w, p), false);
    assert.equal(fishingCatch(w, p, 0.999), 'fish');
    p.z = 1400;
    assert.equal(deepFishingWater(w, p), true);
    assert.equal(fishingCatch(w, p, 0.999), 'tuna');
  }
});
test('shore edits invalidate cached decisions and zero buffer preserves depth and bounds', () => {
  const { w, p } = setup();
  assert.equal(deepFishingWater(w, p), false);
  act(w, p.id, { type: 'settings', patch: { fishingShoreDistance: 60 } });
  assert.equal(deepFishingWater(w, p), true);
  w.settings.fishingShoreDistance = 300;
  assert.equal(deepFishingWater(w, p), false);
  act(w, p.id, { type: 'settings', patch: { fishingShoreDistance: 0 } });
  assert.equal(trawlWater(w, p), true);
  assert.equal(fishingCatch(w, p, 0.999), 'tuna');
  trawlAction(w, p, 'deploy');
  trawlAction(w, p, 'stow');
  w.settings.fishingShoreDistance = 150;
  assert.equal(deepFishingWater(w, p), false);
  w.settings.fishingShoreDistance = 0;
  assert.equal(deepFishingWater(w, p), true);
  p.x = 10000;
  assert.equal(deepFishingWater(w, p), false);
  p.x = 0;
  p.z = 0;
  assert.equal(deepFishingWater(w, p), false);
});
test('depth edits change rod and trawl eligibility without erasing earned catches', () => {
  const { w, p } = setup();
  p.z = 1400;
  act(w, p.id, { type: 'settings', patch: { fishingDeepDepth: 1000 } });
  assert.equal(fishingCatch(w, p, 0.999), 'fish');
  assert.throws(() => trawlAction(w, p, 'deploy'), /clear water/);
  act(w, p.id, { type: 'settings', patch: { fishingDeepDepth: 0.1 } });
  trawlAction(w, p, 'deploy');
  p.trawl!.catch = { cod: 2 };
  const clocks = structuredClone(p.trawl!.shoal);
  act(w, p.id, { type: 'settings', patch: { fishingDeepDepth: 1000 } });
  assert.deepEqual(p.trawl!.catch, { cod: 2 });
  assert.deepEqual(p.trawl!.shoal, clocks);
  trawlAction(w, p, 'haul');
  assert.equal(p.inventory.cod, 2);
});
test('offshore rules validate and round trip through editor summary observations saves and designs', async () => {
  const { w, p } = setup();
  for (const [key, min] of [
    ['fishingDeepDepth', 0.1],
    ['fishingShoreDistance', 0],
  ] as const) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [min - 0.1, 1001, Infinity, NaN]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { fishingMode: 0, [key]: value } }),
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

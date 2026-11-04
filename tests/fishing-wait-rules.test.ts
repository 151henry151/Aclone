// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { meanBiteWait, scheduleBite } from '../src/shared/boat-fishing';
import { Store } from '../src/server/store';
const patch = {
  fishingShoreWaitSeconds: 11,
  fishingAnywhereWaitSeconds: 7,
  fishingCoastalWaitSeconds: 13,
  fishingDeepWaitSeconds: 17,
};
function setup() {
  const w = createWorld('wait-rules', 'Wait rules', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
test('fishing wait defaults legacy fallbacks and custom contexts select the same rule', () => {
  for (const mode of ['defaults', 'legacy', 'custom']) {
    const { w, p } = setup();
    if (mode === 'legacy') for (const k of Object.keys(patch)) delete (w.settings as any)[k];
    if (mode === 'custom') act(w, p.id, { type: 'settings', patch });
    const expected = mode === 'custom' ? [11, 7, 13, 17] : [75, 20, 65, 225];
    p.vehicle = 5;
    w.settings.fishingMode = 1;
    assert.equal(meanBiteWait(w, p), expected[0]);
    w.settings.fishingMode = 5;
    assert.equal(meanBiteWait(w, p), expected[1]);
    p.vehicle = 3;
    Object.assign(p, { x: 0, z: 170 });
    assert.equal(meanBiteWait(w, p), expected[2]);
    p.z = 1400;
    assert.equal(meanBiteWait(w, p), expected[3]);
  }
});
test('editing means preserves scheduled casts and disabled fishing still refuses', () => {
  const { w, p } = setup();
  p.vehicle = 5;
  p.inventory.tackle = 1;
  w.settings.fishingMode = 5;
  scheduleBite(w, p);
  const before = [p.fishAt, p.fishUntil, p.fishCatch];
  act(w, p.id, { type: 'settings', patch });
  assert.deepEqual([p.fishAt, p.fishUntil, p.fishCatch], before);
  scheduleBite(w, p);
  assert.ok(p.fishAt! > w.time);
  assert.equal(p.fishUntil, p.fishAt! + 8);
  act(w, p.id, { type: 'settings', patch: { fishingMode: 0 } });
  assert.throws(() => act(w, p.id, { type: 'joinGame', game: 'fishing' }), /disabled/i);
  assert.equal(p.inventory.fish ?? 0, 0);
});
test('bite-wait rules validate and persist across editor summaries observations designs and saves', async () => {
  const { w, p } = setup();
  for (const key of Object.keys(patch)) {
    assert.ok(Object.hasOwn(w.settings, key));
    for (const value of [0, -1, 3601, NaN, Infinity]) {
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

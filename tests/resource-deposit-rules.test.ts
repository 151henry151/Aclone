// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, terrainHeight } from '../src/shared/simulation';
import {
  worldResources,
  resourceNode,
  resourceAmount,
  resourceRecoverySeconds,
  gatheringStatus,
  cancelGather,
} from '../src/shared/resources';
import { gatheringSceneryStyle } from '../src/shared/gathering-scenery';
import { Store } from '../src/server/store';
const defaults = {
  resourceLogsCapacity: 18,
  resourceOtherCapacity: 30,
  resourceLogsRegrowthSeconds: 1800,
  resourceOtherRegrowthSeconds: 600,
};
function setup() {
  const w = createWorld('deposit-rules', 'Deposits', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.resources = {};
  const n = worldResources(w).find((n) => n.item === 'dirt')!;
  Object.assign(p, {
    x: n.x,
    z: n.z,
    y: terrainHeight(w, n.x, n.z),
    inventory: { shovel: 1 },
    vehicle: 0,
  });
  return { w, p, n };
}
test('deposit defaults and missing fields preserve shipped stock and recovery', () => {
  for (const missing of [false, true]) {
    const { w, p } = setup();
    for (const [k, v] of Object.entries(defaults)) {
      if (missing) delete (w.settings as any)[k];
      else assert.equal((w.settings as any)[k], v);
    }
    for (const n of worldResources(w)) {
      assert.equal(resourceAmount(w, n), n.item === 'logs' ? 18 : 30);
      assert.equal(resourceRecoverySeconds(w, n), n.item === 'logs' ? 7200 : 2400);
      assert.equal((gatheringStatus(w, p, n) as any).capacity, n.capacity);
    }
  }
});
test('world limits apply to cached and saved standard surveys while authored overrides survive', () => {
  const { w, p, n } = setup(),
    nodes = worldResources(w);
  const custom = { ...resourceNode('extra-custom', 'dirt', 250, 250), capacity: 71, regrowth: 90 };
  w.additionalResources = [resourceNode('extra-standard', 'logs', 280, 280), custom];
  Object.assign(w.settings, {
    resourceLogsCapacity: 11,
    resourceOtherCapacity: 9,
    resourceLogsRegrowthSeconds: 20,
    resourceOtherRegrowthSeconds: 10,
    resourceRecoveryMultiplier: 2,
    gatheringScenery: 'worked-near-settlements',
  });
  assert.equal(resourceAmount(w, n), 9, 'old node handles resolve live limits');
  assert.equal((gatheringStatus(w, p, n) as any).capacity, 9);
  assert.equal(resourceRecoverySeconds(w, n), 20);
  assert.equal(gatheringSceneryStyle(w, n), 'natural', 'smaller full deposits are not depleted');
  const added = worldResources(w).find((n) => n.id === 'extra-standard')!;
  assert.equal(resourceAmount(w, added), 11);
  assert.equal(resourceRecoverySeconds(w, added), 40);
  assert.equal(resourceAmount(w, custom), 71);
  assert.equal(resourceRecoverySeconds(w, custom), 180);
  assert.deepEqual(
    nodes.find((x) => x.id === n.id),
    n,
    'survey values and positions are not rewritten',
  );
  w.northernIsland = {
    version: 1,
    seed: 1,
    radius: 1000,
    centreZ: -10000,
    preserveZ: -8000,
    blendZ: -9000,
    mountain: { x: 0, z: -10000, height: 100, radius: 500 },
    regions: [],
    rivers: [],
    ponds: [],
    resources: nodes.map((n) => ({ ...n })),
    previousArea: 10000,
    area: 100000,
  };
  const saved = JSON.parse(JSON.stringify(w));
  for (const node of worldResources(saved))
    assert.equal(
      resourceAmount(saved, node),
      node.id === custom.id ? 71 : node.item === 'logs' ? 11 : 9,
    );
});
test('simultaneous edits retain earned stock and fractional progress without filling new headroom', () => {
  const { w, p, n } = setup();
  w.resources![n.id] = { amount: 0, updated: w.time };
  w.time += 3600; // 3 earned + half an interval.
  act(w, p.id, {
    type: 'settings',
    patch: {
      resourceOtherCapacity: 45,
      resourceOtherRegrowthSeconds: 100,
      resourceRecoveryMultiplier: 2,
    },
  });
  assert.equal(resourceAmount(w, n), 3);
  assert.equal(resourceRecoverySeconds(w, n), 200);
  w.time += 99;
  assert.equal(resourceAmount(w, n), 3);
  w.time++;
  assert.equal(resourceAmount(w, n), 6);
  const untouched = worldResources(w).find((x) => x.item === 'stone')!;
  assert.equal(resourceAmount(w, untouched), 30, 'capacity growth does not create stock');
  w.time += 100;
  assert.equal(resourceAmount(w, untouched), 33);
  act(w, p.id, { type: 'settings', patch: { resourceOtherCapacity: 4 } });
  assert.equal(resourceAmount(w, n), 4);
  act(w, p.id, { type: 'settings', patch: { resourceOtherCapacity: 20 } });
  assert.equal(resourceAmount(w, n), 4, 'raising the cap does not recover clipped stock');
  const reload = JSON.parse(JSON.stringify(w));
  reload.time += 20000;
  assert.equal(resourceAmount(reload, n), 20, 'offline recovery caps at the current capacity');
});
test('capacity edits preserve reserved loads and cancellation returns once up to the live cap', () => {
  const { w, p, n } = setup();
  act(w, p.id, { type: 'gather', node: n.id });
  const task = { ...p.task };
  act(w, p.id, {
    type: 'settings',
    patch: { resourceOtherCapacity: 2, resourceOtherRegrowthSeconds: 10 },
  });
  assert.deepEqual(p.task, task);
  assert.equal(resourceAmount(w, n), 2);
  cancelGather(w, p);
  assert.equal(resourceAmount(w, n), 2);
  cancelGather(w, p);
  assert.equal(resourceAmount(w, n), 2);
  assert.match(gatheringStatus(w, p, n).reason!, /replenish/);
});
test('deposit controls validate atomically and survive summaries observations saves and designs', async () => {
  const { w, p, n } = setup();
  for (const key of Object.keys(defaults))
    for (const value of [0, 1.5, key.endsWith('Seconds') ? 86401 : 10001, Infinity]) {
      const before = JSON.stringify(w);
      assert.throws(() =>
        act(w, p.id, { type: 'settings', patch: { resourceRecoveryMultiplier: 1, [key]: value } }),
      );
      assert.equal(JSON.stringify(w), before);
    }
  w.additionalResources = [
    { ...resourceNode('extra-custom', 'logs', 300, 300), capacity: 71, regrowth: 90 },
  ];
  const patch = {
    resourceLogsCapacity: 12,
    resourceOtherCapacity: 9,
    resourceLogsRegrowthSeconds: 20,
    resourceOtherRegrowthSeconds: 10,
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
    assert.equal(resourceAmount(loaded, n), 9);
    assert.equal(
      resourceAmount(
        dest,
        worldResources(dest).find((x) => x.id === 'extra-custom')!,
      ),
      71,
    );
    assert.equal(
      resourceRecoverySeconds(
        dest,
        worldResources(dest).find((x) => x.id === 'extra-custom')!,
      ),
      360,
    );
  } finally {
    store.close();
  }
});

test('shrinking an untouched full ground does not mark it as recently worked', () => {
  const { w, p, n } = setup();
  w.settings.gatheringScenery = 'worked-near-settlements';
  act(w, p.id, { type: 'settings', patch: { resourceOtherCapacity: 9 } });
  assert.equal(resourceAmount(w, n), 9);
  assert.equal(gatheringSceneryStyle(w, n), 'natural');
});

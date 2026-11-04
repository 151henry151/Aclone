// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { resourceNode } from '../src/shared/resources';
import { rulesSummary } from '../src/shared/rulesets';
import { Store } from '../src/server/store';
import { configureRules, applyDesign, exportDesign } from '../src/server/world-design';

test('gathering scenery rules default to settlement wear and survive validated edits, saves and designs', async () => {
  const w = createWorld('puddlewick', 'Scenery rules', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  assert.equal(w.settings.gatheringScenery, 'worked-near-settlements');
  assert.equal(w.settings.gatheringTownDistance, 100);
  assert.equal(w.settings.gatheringRecentSeconds, 600);
  const { gatheringSceneryRules } = await import('../src/shared/gathering-scenery');
  const expected = gatheringSceneryRules(w.settings);
  delete w.settings.gatheringScenery;
  delete w.settings.gatheringTownDistance;
  delete w.settings.gatheringRecentSeconds;
  assert.deepEqual(gatheringSceneryRules(w.settings), expected);
  act(w, p.id, {
    type: 'settings',
    patch: { gatheringScenery: 'natural', gatheringTownDistance: 0, gatheringRecentSeconds: 0 },
  });
  assert.match(rulesSummary(w), /gathering scenery: natural.*0 m.*0 s/i);
  configureRules(w, {
    gatheringScenery: 'always-worked',
    gatheringTownDistance: 200,
    gatheringRecentSeconds: 45,
  });
  for (const patch of [
    { gatheringScenery: 'unknown' },
    { gatheringScenery: 1 },
    { gatheringTownDistance: -1 },
    { gatheringTownDistance: 5001 },
    { gatheringRecentSeconds: -1 },
    { gatheringRecentSeconds: 86401 },
    { gatheringRecentSeconds: NaN },
  ])
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
  const target = createWorld('target', 'Target', 'builder');
  applyDesign(target, exportDesign(w));
  assert.deepEqual(gatheringSceneryRules(target.settings), gatheringSceneryRules(w.settings));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(
      gatheringSceneryRules(store.loadWorlds()[0].world.settings),
      gatheringSceneryRules(w.settings),
    );
  } finally {
    store.close();
  }
});

test('wear appears only for configured settlement proximity, depletion, recent use or active gathering', async () => {
  const w = createWorld('wear', 'Wear', 'owner');
  assert.equal(w.settings.gatheringScenery, 'worked-near-settlements');
  const { gatheringSceneryStyle } = await import('../src/shared/gathering-scenery');
  const node = resourceNode('test-gravel-0', 'gravel', 0, 0);
  const town = { ...w.towns[0], x: 0, z: 0, radius: 200 };
  w.towns = [];
  w.time = 10000;
  assert.equal(gatheringSceneryStyle(w, node), 'natural', 'empty town and use state');
  w.towns = [town];
  node.x = 300;
  assert.equal(gatheringSceneryStyle(w, node), 'worn');
  node.x = 300.01;
  assert.equal(gatheringSceneryStyle(w, node), 'natural');
  w.settings.gatheringTownDistance = 0;
  node.x = 200;
  assert.equal(gatheringSceneryStyle(w, node), 'worn');
  node.x = 201;
  assert.equal(gatheringSceneryStyle(w, node), 'natural');
  w.towns = [];
  w.resources = { [node.id]: { amount: node.capacity, updated: w.time - 600 } };
  assert.equal(gatheringSceneryStyle(w, node), 'worn');
  w.time++;
  assert.equal(gatheringSceneryStyle(w, node), 'natural', 'regrown and expired');
  w.resources[node.id] = { amount: 0, updated: w.time - 1000 };
  assert.equal(gatheringSceneryStyle(w, node), 'worn', 'still depleted beyond recent window');
  w.resources = {};
  w.settings.gatheringRecentSeconds = 0;
  const p = addPlayer(w, 'owner', 'Gatherer');
  p.task = { kind: 'gather', resource: node.id, item: node.item, amount: 3, end: w.time + 20 };
  assert.equal(gatheringSceneryStyle(w, node), 'worn');
  p.task.end = w.time;
  assert.equal(
    gatheringSceneryStyle(w, node),
    'natural',
    'expired task does not imply active work',
  );
  w.resources[node.id] = { amount: node.capacity, updated: w.time };
  assert.equal(gatheringSceneryStyle(w, node), 'natural', 'zero disables recent window');
  w.settings.gatheringScenery = 'natural';
  w.resources[node.id].amount = 0;
  w.towns = [town];
  assert.equal(gatheringSceneryStyle(w, node), 'natural');
  w.settings.gatheringScenery = 'always-worked';
  w.resources = {};
  w.towns = [];
  assert.equal(gatheringSceneryStyle(w, node), 'legacy');
});

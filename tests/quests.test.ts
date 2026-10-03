// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { questSchema, currentProgress, guardSchema } from '../src/shared/quests.ts';
import { defaultCreator } from '../src/shared/creator.ts';
import { prepareFrame } from '../src/server/snapshots.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('quest', 'Quest', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  p.online = true;
  p.cash = 100000;
  w.creator = defaultCreator();
  const market = w.buildings.find((b) => b.kind === 'market')!;
  p.x = market.x;
  p.z = market.z;
  market.stock.water = 30;
  const q = questSchema.parse({
    id: 'learner',
    title: 'Learn and trade',
    steps: [
      { event: 'study', target: 'miller' },
      { event: 'buy', item: 'water', quantity: 2 },
    ],
    rewards: { bread: 2 },
    kudos: 3,
  });
  w.creator.quests = [q];
  return { w, p, q, market };
}
test('quests count authoritative ordered events, persist, and claim a whole reward only once', () => {
  const { w, p, q, market } = setup();
  act(w, p.id, { type: 'quest', quest: q.id, operation: 'accept' });
  act(w, p.id, {
    type: 'trade',
    building: market.id,
    direction: 'buy',
    item: 'water',
    quantity: 2,
  });
  assert.equal(currentProgress(p, q)?.step, 0, 'out-of-order actions do not count');
  p.learning = { skill: 'miller', end: w.time + 1 };
  advance(w, 1);
  assert.equal(currentProgress(p, q)?.step, 1);
  act(w, p.id, {
    type: 'trade',
    building: market.id,
    direction: 'buy',
    item: 'water',
    quantity: 2,
  });
  assert.equal(currentProgress(p, q)?.step, 2);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.players[p.id].quests, p.quests);
  } finally {
    store.close();
  }
  const bread = p.inventory.bread ?? 0,
    kudos = p.kudos;
  p.inventory.stone = 1000;
  assert.throws(() => act(w, p.id, { type: 'quest', quest: q.id, operation: 'claim' }), /room/);
  assert.equal(p.inventory.bread ?? 0, bread);
  assert.equal(currentProgress(p, q)?.claimed, false);
  delete p.inventory.stone;
  act(w, p.id, { type: 'quest', quest: q.id, operation: 'claim' });
  assert.equal(p.inventory.bread, bread + 2);
  assert.equal(p.kudos, kudos + 3);
  assert.throws(() => act(w, p.id, { type: 'quest', quest: q.id, operation: 'claim' }), /Complete/);
  const frame = prepareFrame(w);
  assert.ok(!frame.players[p.id].includes('quests'));
  q.title = 'Revised quest';
  assert.equal(currentProgress(p, q), undefined);
});
test('action requirements reject before economic mutation and observe Lua progress', () => {
  const { w, p, market } = setup();
  w.creator!.guards = [
    guardSchema.parse({
      id: 'intro',
      action: 'trade',
      target: market.id,
      skill: 'miller',
      variable: 'introduced',
      message: 'Meet the miller first.',
    }),
  ];
  const request = {
    type: 'trade',
    building: market.id,
    direction: 'buy',
    item: 'water',
    quantity: 1,
  };
  const before = structuredClone(w);
  assert.throws(() => act(w, p.id, request), /Meet the miller/);
  assert.deepEqual(w, before);
  p.skills = ['miller'];
  p.scriptState = { introduced: 1 };
  act(w, p.id, request);
  assert.equal(p.cash, before.players[p.id].cash - market.sell.water);
});
test('quest death policies reset only configured progress', () => {
  const { w, p, q } = setup();
  const retained = questSchema.parse({ ...q, id: 'retained', resetOnDeath: false });
  w.creator!.quests.push(retained);
  for (const quest of [q, retained])
    act(w, p.id, { type: 'quest', quest: quest.id, operation: 'accept' });
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(currentProgress(p, q), undefined);
  assert.ok(currentProgress(p, retained));
});

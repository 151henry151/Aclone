// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { creatorSchema, validateCreator } from '../src/shared/creator.ts';
import { tickTownEvents, activeTownEvents } from '../src/shared/world-stories.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';
import { Store } from '../src/server/store.ts';
test('carried books advance ordered tutorial quests without being consumed', () => {
  const w = createWorld('books', 'Books', 'owner'),
    p = addPlayer(w, 'reader', 'Reader');
  p.inventory = { bread: 1 };
  w.creator = creatorSchema.parse({
    books: [{ id: 'guide', title: 'Guide', item: 'bread', pages: ['Read me.'] }],
    quests: [{ id: 'learn', title: 'Tutorial', steps: [{ event: 'interact', target: 'guide' }] }],
  });
  act(w, p.id, { type: 'quest', quest: 'learn', operation: 'accept' });
  act(w, p.id, { type: 'readBook', book: 'guide' });
  assert.equal(p.quests?.learn.step, 1);
  assert.equal(p.inventory.bread, 1);
  p.inventory = {};
  assert.throws(() => act(w, p.id, { type: 'readBook', book: 'guide' }), /Carry/);
  assert.throws(
    () =>
      validateCreator(w, {
        ...w.creator,
        books: [{ id: 'bad', title: 'Bad', item: 'custom:missing', pages: ['Bad'] }],
      }),
    /Unknown/,
  );
  const copy = createWorld('copy', 'Copy', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.deepEqual(copy.creator?.books, w.creator.books);
});
test('events announce once per occurrence, survive reload and skip missed notices', () => {
  const w = createWorld('events', 'Events', 'owner');
  w.creator = creatorSchema.parse({
    townEvents: [
      {
        id: 'market',
        title: 'Market',
        description: 'Bring produce',
        startsDay: 1,
        repeatDays: 3,
        durationDays: 1,
      },
    ],
  });
  w.time = 600;
  tickTownEvents(w);
  tickTownEvents(w);
  assert.equal(w.messages.filter((m) => m.name === 'Town event').length, 1);
  assert.equal(activeTownEvents(w).length, 1);
  w.time = 1200;
  assert.equal(activeTownEvents(w).length, 0);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    restored.time = 600;
    tickTownEvents(restored);
    assert.equal(restored.messages.filter((m) => m.name === 'Town event').length, 1);
    advance(restored, 600 * 30);
    assert.equal(restored.messages.filter((m) => m.name === 'Town event').length, 2);
  } finally {
    store.close();
  }
});

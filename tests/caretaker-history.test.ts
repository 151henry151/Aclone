// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from '../src/server/store.ts';
import { createWorld, say } from '../src/shared/simulation.ts';
import { caretakerBody } from '../src/client/caretaker.ts';
import { caretakerView } from '../src/shared/caretaker.ts';

test('public archive retains bursts, paginates without duplicates and survives reload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-history-'));
  let store = new Store(join(dir, 'test.sqlite'));
  try {
    const world = createWorld('history', 'History', 'owner');
    store.saveWorld(world);
    for (let i = 0; i < 260; i++) {
      say(world, 'Pilot', `public ${i}`, i % 2 ? 'chat' : 'system');
      say(world, 'Pilot', `private ${i}`, 'chat', 'recipient');
    }
    world.messages.at(-2)!.npc = true;
    assert.equal(world.messages.length, 100);
    store.saveWorld(world);
    store.saveWorld(world);
    const first = store.publicMessages(world.id);
    assert.equal(first.entries.length, 100);
    assert.equal(first.entries[0].text, 'public 259');
    assert.equal(first.entries[0].npc, true);
    say(world, 'Pilot', 'new while paging', 'chat');
    store.saveWorld(world);
    const second = store.publicMessages(world.id, false, first.before);
    const third = store.publicMessages(world.id, false, second.before);
    const all = [...first.entries, ...second.entries, ...third.entries];
    assert.equal(all.length, 261); // 260 messages + world welcome
    assert.equal(new Set(all.map((m) => m.id)).size, all.length);
    assert.equal(third.before, undefined);
    assert.ok(all.every((m) => !m.text.startsWith('private')));
    const notices = store.publicMessages(world.id, true);
    assert.equal(notices.entries.length, 100);
    assert.ok(notices.entries.every((m) => m.kind === 'system'));
    assert.equal(store.publicMessages('another-world').entries.length, 0);
    store.close();
    store = new Store(join(dir, 'test.sqlite'));
    const restored = store.loadWorlds()[0].world;
    say(restored, 'Pilot', 'after restart', 'chat');
    store.saveWorld(restored);
    assert.equal(store.publicMessages(world.id).entries[0].text, 'after restart');
    assert.equal(
      store.publicMessages(world.id, false, second.before).entries.length,
      third.entries.length,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('legacy retained messages get stable ids and failed saves retain queued history', () => {
  const store = new Store(':memory:');
  try {
    const world = createWorld('old', 'Old', 'owner');
    world.messages = [{ name: 'Old pilot', text: 'retained legacy', kind: 'chat', time: 1 }];
    delete world.messageSeq;
    store.saveWorld(world);
    for (let i = 0; i < 150; i++) say(world, 'Pilot', `queued ${i}`);
    assert.throws(() =>
      store.saveWorld(world, 1, () => {
        throw Error('failed');
      }),
    );
    assert.throws(() =>
      store.transaction(() => {
        store.saveWorld(world);
        throw Error('outer rollback');
      }),
    );
    store.saveWorld(world);
    const rows = store.db.prepare('SELECT text FROM public_messages').all();
    assert.equal(rows.length, 151);
    assert.equal(rows[0].text, 'retained legacy');
  } finally {
    store.close();
  }
});

test('caretaker history escapes message HTML and distinguishes complete history', () => {
  const world = createWorld('view', 'View', 'owner');
  const html = caretakerBody(
    caretakerView(world),
    {
      tab: 'Chat logs',
      query: '',
      selected: '',
      logs: {
        chat: {
          entries: [
            {
              id: 1,
              time: 10,
              name: '<script>',
              text: '<img onerror=alert(1)>',
              kind: 'chat',
              npc: true,
            },
          ],
        },
      },
    },
    100,
  );
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Beginning of available history'));
  assert.ok(html.includes('data-preserve-scroll'));
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { Playtime } from '../src/server/playtime';
import { createApp } from '../src/server/app';
import { createWorld, say } from '../src/shared/simulation';
import { pendingPublicMessages } from '../src/shared/messages';

function ledger(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    time: i,
    kind: 'transfer' as const,
    amount: 1,
    from: 'a',
    to: 'b',
    reason: 'check',
  }));
}

test('nested checkpoints release only committed history and retain all ledger entries on rollback', () => {
  const store = new Store(':memory:');
  try {
    const w = createWorld('batch', 'Batch', 'owner');
    store.saveWorld(w);
    for (let i = 0; i < 150; i++) say(w, 'Pilot', `queued ${i}`);
    w.ledger = ledger(150);
    const playtime = new Playtime(store);
    playtime.advance(['pilot'], 12);
    assert.throws(
      () =>
        store.transaction(() => {
          store.saveWorld(w);
          playtime.save();
          throw Error('later checkpoint failed');
        }),
      /later checkpoint failed/,
    );
    assert.equal(w.ledger.length, 150, 'rollback must retain unsaved ledger entries for retry');
    assert.equal(pendingPublicMessages(w).length, 150);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM ledger').get()!.n, 0);
    assert.equal(
      store.db.prepare('SELECT COUNT(*) n FROM player_playtime WHERE account=?').get('pilot')!.n,
      0,
    );
    store.transaction(() => {
      store.saveWorld(w);
      playtime.save();
    });
    assert.equal(
      pendingPublicMessages(w).length,
      0,
      'committed batch must release its archive buffer',
    );
    assert.equal(w.ledger.length, 100);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM ledger').get()!.n, 150);
    assert.equal(
      store.db.prepare('SELECT recorded FROM player_playtime WHERE account=?').get('pilot')!
        .recorded,
      12,
    );
    assert.equal(
      store.db.prepare('PRAGMA synchronous').get()!.synchronous,
      2,
      'retain FULL durability',
    );
  } finally {
    store.close();
  }
});

test('commit cleanup preserves messages and ledger events produced after the last nested save', () => {
  const store = new Store(':memory:');
  try {
    const w = createWorld('late', 'Late', 'owner');
    store.saveWorld(w);
    w.ledger = ledger(150);
    store.transaction(() => {
      say(w, 'Pilot', 'saved');
      store.saveWorld(w);
      say(w, 'Pilot', 'not yet saved');
      w.ledger.push({ ...ledger(1)[0], id: 151 });
    });
    assert.deepEqual(
      pendingPublicMessages(w).map((m) => m.text),
      ['not yet saved'],
    );
    assert.ok(w.ledger.some((l) => l.id === 151));
    store.saveWorld(w);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM ledger').get()!.n, 151);
  } finally {
    store.close();
  }
});

test('server batches periodic worlds and resident checkpoints without redundant durable commits', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-batch-'));
  let tick: (() => void) | undefined;
  const originalInterval = globalThis.setInterval;
  t.mock.method(globalThis, 'setInterval', ((
    callback: (...args: unknown[]) => void,
    delay?: number,
  ) => {
    if (delay === 50) {
      tick = callback;
      return originalInterval(() => {}, 2147483647);
    }
    return originalInterval(callback, delay);
  }) as typeof setInterval);
  const app = await createApp({ dataDir: dir, port: 0, npc: { residents: [] } });
  try {
    assert.ok(tick);
    app.worlds.clear();
    for (let i = 0; i < 5; i++) {
      const w = createWorld(`batch-${i}`, 'Batch', 'owner');
      app.worlds.set(w.id, w);
    }
    const exec = app.store.db.exec.bind(app.store.db);
    let commits = 0;
    const changes = () => Number(app.store.db.prepare('SELECT total_changes() n').get()!.n);
    let committedChanges = changes();
    t.mock.method(app.store.db, 'exec', (sql: string) => {
      if (sql === 'COMMIT') {
        const count = changes();
        if (count > committedChanges) commits++;
        committedChanges = count;
      }
      return exec(sql);
    });
    for (let i = 0; i < 100; i++) tick();
    assert.ok(app.store.checkpointBusy, 'periodic persistence must yield to the event loop');
    await app.store.ready();
    assert.equal(commits, 0, 'periodic disk commit must not run on the movement thread');
    assert.equal(
      app.store.loadWorlds().filter(({ world }) => world.id.startsWith('batch-')).length,
      5,
    );
    const w = app.worlds.values().next().value!;
    t.mock.method(app.residents!, 'tick', () => {
      app.store.saveWorld(w);
      app.store.saveWorld(w);
    });
    commits = 0;
    tick();
    assert.equal(commits, 1, 'resident checkpoints in one tick share one durable commit');
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed COMMIT and rolled-back inner savepoints do not release unsaved events', (t) => {
  const store = new Store(':memory:');
  try {
    const w = createWorld('commit-failure', 'Commit failure', 'owner');
    store.saveWorld(w);
    say(w, 'Pilot', 'retry me');
    w.ledger = ledger(150);
    const exec = store.db.exec.bind(store.db);
    const mock = t.mock.method(store.db, 'exec', (sql: string) => {
      if (sql === 'COMMIT') throw Error('disk commit failed');
      return exec(sql);
    });
    assert.throws(() => store.transaction(() => store.saveWorld(w)), /disk commit failed/);
    mock.mock.restore();
    assert.equal(w.ledger.length, 150);
    assert.deepEqual(
      pendingPublicMessages(w).map((m) => m.text),
      ['retry me'],
    );
    store.transaction(() => {
      store.saveWorld(w);
      say(w, 'Pilot', 'inner rollback');
      assert.throws(
        () =>
          store.transaction(() => {
            store.saveWorld(w);
            throw Error('undo inner');
          }),
        /undo inner/,
      );
    });
    assert.deepEqual(
      pendingPublicMessages(w).map((m) => m.text),
      ['inner rollback'],
    );
    assert.equal(
      store.db.prepare('SELECT COUNT(*) n FROM public_messages WHERE text=?').get('inner rollback')!
        .n,
      0,
    );
    store.saveWorld(w);
    assert.equal(pendingPublicMessages(w).length, 0);
    assert.equal(store.db.prepare('SELECT COUNT(*) n FROM ledger').get()!.n, 150);
  } finally {
    store.close();
  }
});

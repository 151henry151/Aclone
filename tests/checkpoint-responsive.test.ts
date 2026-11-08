// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store';
import { createWorld } from '../src/shared/simulation';

test('a periodic checkpoint waiting on a real writer lock leaves the event loop responsive', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-responsive-save-'));
  const s = new Store(join(dir, 'world.sqlite'));
  const w = createWorld('responsive', 'Responsive', 'owner');
  s.saveWorld(w);
  const lock = new Worker(
    `
    const {parentPort, workerData} = require('node:worker_threads');
    const {DatabaseSync} = require('node:sqlite');
    const db = new DatabaseSync(workerData);
    db.exec('BEGIN IMMEDIATE');
    parentPort.postMessage('locked');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
    db.exec('ROLLBACK');
    db.close();
  `,
    { eval: true, workerData: s.path, execArgv: [] },
  );
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    await once(lock, 'message');
    let last = performance.now(),
      maximum = 0,
      beats = 0;
    timer = setInterval(() => {
      const now = performance.now();
      maximum = Math.max(maximum, now - last);
      last = now;
      beats++;
    }, 10);
    w.time++;
    // Exercise the released synchronous path until the asynchronous API exists.
    const checkpoint = (s as Store & { checkpoint?: (worlds: (typeof w)[]) => Promise<void> })
      .checkpoint;
    if (checkpoint) await checkpoint.call(s, [w]);
    else s.transaction(() => s.saveWorld(w));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(maximum < 100, `checkpoint blocked heartbeat for ${maximum.toFixed(1)} ms`);
    assert.ok(beats >= 10, 'heartbeat continues while SQLite waits for its writer lock');
    assert.equal(s.loadWorlds()[0].world.time, w.time);
    assert.equal(s.db.prepare('PRAGMA synchronous').get()!.synchronous, 2);
  } finally {
    if (timer) clearInterval(timer);
    await lock.terminate();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('background batches retain late events, roll back together, retry, and precede backups', async () => {
  const { say } = await import('../src/shared/simulation');
  const { pendingPublicMessages } = await import('../src/shared/messages');
  const { Playtime } = await import('../src/server/playtime');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-checkpoint-atomic-'));
  const s = new Store(join(dir, 'world.sqlite'));
  const worlds = ['one', 'two'].map((id) => createWorld(id, id, 'owner'));
  new Playtime(s);
  try {
    worlds.forEach((w) => s.saveWorld(w));
    worlds.forEach((w) => {
      w.time++;
      say(w, 'Pilot', 'saved');
    });
    s.db.exec(
      "CREATE TRIGGER reject_checkpoint BEFORE INSERT ON worlds WHEN NEW.id='two' BEGIN SELECT RAISE(ABORT, 'checkpoint refused'); END",
    );
    const before = s.loadWorlds().map(({ world }) => world.time);
    await assert.rejects(
      s.checkpoint(worlds, [['pilot', '2026-11-07', 12, 0]]),
      /checkpoint refused/,
    );
    assert.deepEqual(
      s.loadWorlds().map(({ world }) => world.time),
      before,
    );
    assert.equal(s.db.prepare('SELECT count(*) n FROM player_playtime').get()!.n, 0);
    assert.ok(worlds.every((w) => pendingPublicMessages(w).some((m) => m.text === 'saved')));
    s.db.exec('DROP TRIGGER reject_checkpoint');
    const saved = s.checkpoint(worlds, [['pilot', '2026-11-07', 12, 0]]);
    await assert.rejects(s.checkpoint(worlds), /busy/);
    assert.throws(() => s.saveWorld(worlds[0]), /Await the periodic checkpoint/);
    say(worlds[0], 'Pilot', 'late');
    const backup = s.backup(join(dir, 'backup.sqlite'));
    await saved;
    assert.deepEqual(
      pendingPublicMessages(worlds[0]).map((m) => m.text),
      ['late'],
    );
    await backup;
    const copy = new Store(join(dir, 'backup.sqlite'));
    assert.deepEqual(
      copy.loadWorlds().map(({ world }) => world.time),
      worlds.map((w) => w.time),
    );
    assert.equal(
      copy.db.prepare('SELECT recorded FROM player_playtime WHERE account=?').get('pilot')!
        .recorded,
      12,
    );
    copy.close();
    s.saveWorld(worlds[0]);
    assert.equal(pendingPublicMessages(worlds[0]).length, 0);
    assert.equal(s.publicMessages('one').entries.filter((m) => m.text === 'late').length, 1);
  } finally {
    await s.ready();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an idle writer exit is replaced before the next checkpoint', { timeout: 5000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-checkpoint-exit-'));
  const s = new Store(join(dir, 'world.sqlite'));
  try {
    const w = createWorld('exit', 'Exit', 'owner');
    await s.checkpoint([w]);
    await (s as unknown as { writer: Worker }).writer.terminate();
    w.time++;
    await s.checkpoint([w]);
    assert.equal(s.loadWorlds()[0].world.time, w.time);
  } finally {
    // A timed-out regression must not strand its fixture worker/process.
    await (s as unknown as { writer?: Worker }).writer?.terminate();
    await s.ready();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  'movement, ping and reconnect stay responsive while a checkpoint is blocked',
  { timeout: 30000 },
  async () => {
    const { createApp } = await import('../src/server/app');
    const { WebSocket } = await import('ws');
    const { creatorSchema } = await import('../src/shared/creator');
    const { landscapeSchema } = await import('../src/shared/landscape');
    const dir = mkdtempSync(join(tmpdir(), 'aclone-checkpoint-network-'));
    const app = await createApp({ dataDir: dir, port: 0 });
    const pilot = app.universe.register('Checkpoint walker');
    const w = app.worlds.get('puddlewick')!;
    w.script = '';
    w.buildings = [];
    w.towns = [];
    w.creator = creatorSchema.parse({ roads: false, scenery: false });
    w.landscape = landscapeSchema.parse({ heightmap: Array(33 * 33).fill(10) });
    delete w.airfield;
    delete w.spaceportSite;
    const port = await app.listen();
    const old = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    let replacement: InstanceType<typeof WebSocket> | undefined;
    let lock: Worker | undefined;
    const received: { type: string; at?: number }[] = [];
    const waitFor = async (condition: () => boolean, timeout = 3000) => {
      const end = performance.now() + timeout;
      while (!condition() && performance.now() < end) await new Promise((r) => setTimeout(r, 5));
      assert.ok(condition(), 'expected network event');
    };
    try {
      old.on('message', (raw) => received.push(JSON.parse(raw.toString())));
      await once(old, 'open');
      old.send(JSON.stringify({ type: 'hello', token: pilot.token, world: w.id }));
      await waitFor(() => received.some((m) => m.type === 'welcome'));
      const player = w.players[pilot.account.id];
      player.vehicle = 5;
      player.x = 0;
      player.z = 0;
      player.heading = 0;
      player.speed = 0;
      lock = new Worker(
        `
      const {parentPort,workerData}=require('node:worker_threads');
      const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData);
      db.exec('BEGIN IMMEDIATE');parentPort.postMessage('locked');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,600);
      db.exec('ROLLBACK');db.close();
    `,
        { eval: true, workerData: app.store.path, execArgv: [] },
      );
      await once(lock, 'message');
      const saved = app.store.checkpoint(app.worlds.values());
      const began = performance.now();
      old.send(
        JSON.stringify({
          type: 'input',
          sequence: 1,
          input: { throttle: 1, steer: 0, boost: false },
        }),
      );
      old.send(JSON.stringify({ type: 'ping', at: 12345 }));
      const health = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(health.status, 200);
      await waitFor(() => received.some((m) => m.type === 'pong' && m.at === 12345));
      assert.ok(performance.now() - began < 100, 'health and ping do not wait for disk');
      await waitFor(() => Math.hypot(player.x, player.z) > 0.05);
      assert.ok(app.store.checkpointBusy, 'actual player moves before disk lock is released');
      replacement = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      let welcomed = false;
      replacement.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'welcome') welcomed = true;
      });
      await once(replacement, 'open');
      replacement.send(JSON.stringify({ type: 'hello', token: pilot.token, world: w.id }));
      await new Promise((r) => setTimeout(r, 30));
      assert.equal(welcomed, false, 'database-backed entry waits for durable checkpoint');
      old.terminate();
      await new Promise((r) => setTimeout(r, 30));
      await saved;
      await waitFor(() => welcomed);
      assert.equal(
        player.online,
        true,
        'old deferred sign-off must not sign out the new connection',
      );
      assert.equal(
        app.store.loadWorlds().find(({ world }) => world.id === w.id)!.world.players[player.id]
          .online,
        true,
      );
    } finally {
      old.terminate();
      replacement?.terminate();
      await lock?.terminate();
      await app.store.ready();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test('an NPC reply arriving during a checkpoint waits before charging and saving its plan', async () => {
  const { Universe } = await import('../src/server/universe');
  const { Residents } = await import('../src/server/npc/residents');
  const { npcConfigSchema } = await import('../src/server/npc/config');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-checkpoint-npc-'));
  const s = new Store(join(dir, 'world.sqlite'));
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  let answer!: (value: import('../src/server/npc/decision').BrainResult) => void;
  const brain = {
    decide: () =>
      new Promise<import('../src/server/npc/decision').BrainResult>((resolve) => {
        answer = resolve;
      }),
  };
  const residents = new Residents(
    s,
    new Universe(s),
    new Map([[w.id, w]]),
    [
      {
        config: npcConfigSchema.parse({
          id: 'reply',
          name: 'Reply',
          intervalMs: 5000,
          activeAlone: true,
        }),
        brain,
      },
    ],
    { dailyUsd: 20 },
  );
  let lock: Worker | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    residents.tick(0.05);
    await residents.dispatched();
    assert.ok(answer, 'provider request has been dispatched');
    lock = new Worker(
      `
      const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');
      const db=new DatabaseSync(workerData);db.exec('BEGIN IMMEDIATE');parentPort.postMessage('locked');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,400);db.exec('ROLLBACK');db.close();
    `,
      { eval: true, workerData: s.path, execArgv: [] },
    );
    await once(lock, 'message');
    const saved = s.checkpoint([w]);
    let last = performance.now(),
      maximum = 0;
    timer = setInterval(() => {
      const now = performance.now();
      maximum = Math.max(maximum, now - last);
      last = now;
    }, 10);
    answer({
      decision: {
        intent: 'Wait',
        notebook: 'Durable reply',
        speech: null,
        plan: [{ kind: 'wait', seconds: 600 }],
        repeat: 1,
        reconsiderSeconds: 600,
      },
      inputTokens: 500,
      outputTokens: 200,
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(s.checkpointBusy);
    assert.notEqual(residents.memory.load('reply')!.notebook, 'Durable reply');
    await saved;
    await residents.settled();
    assert.equal(residents.memory.load('reply')!.notebook, 'Durable reply');
    assert.equal(
      s.db.prepare("SELECT count(*) n FROM npc_calls WHERE status='complete'").get()!.n,
      1,
    );
    assert.ok(maximum < 100, `provider completion blocked heartbeat for ${maximum.toFixed(1)} ms`);
  } finally {
    if (timer) clearInterval(timer);
    await lock?.terminate();
    await s.ready();
    residents.close();
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('shutdown drains the in-flight checkpoint and closes its writer before returning', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-checkpoint-shutdown-'));
  const s = new Store(join(dir, 'world.sqlite'));
  try {
    const w = createWorld('closing', 'Closing', 'owner');
    const saved = s.checkpoint([w]);
    const worker = (s as unknown as { writer: Worker }).writer;
    const shutdown = (s as Store & { shutdown?: () => Promise<void> }).shutdown;
    if (shutdown) await shutdown.call(s);
    else s.close();
    await saved;
    assert.equal(worker.threadId, -1, 'writer is fully stopped');
    const restored = new Store(s.path);
    assert.equal(restored.loadWorlds()[0].world.id, w.id);
    restored.close();
  } finally {
    await s.ready();
    if ((s as unknown as { db: { isOpen: boolean } }).db.isOpen) s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

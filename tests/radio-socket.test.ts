// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { radioView, tickRadio } from '../src/shared/radio';
function next(ws: WebSocket, predicate: (m: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', read);
      reject(Error('Radio socket timeout'));
    }, 5000);
    const read = (raw: any) => {
      const m = JSON.parse(String(raw));
      if (predicate(m)) {
        clearTimeout(timeout);
        ws.off('message', read);
        resolve(m);
      }
    };
    ws.on('message', read);
  });
}
test(
  'failed socket actions preserve earlier transmissions and roll back a newly keyed transmission on save failure',
  { timeout: 30000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-radio-socket-')),
      app = await createApp({ dataDir: dir, port: 0, tick: false });
    let ws: WebSocket | undefined;
    try {
      const { account, token } = app.universe.register('Radio socket'),
        w = createWorld('radio-socket', 'Radio', account.id);
      w.script = '';
      const p = addPlayer(w, account.id, account.name);
      p.vehicle = 0;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      await new Promise<void>((resolve) => ws!.once('open', resolve));
      const welcome = next(ws, (m) => m.type === 'welcome');
      ws.send(JSON.stringify({ type: 'hello', token, world: w.id }));
      await welcome;
      let request = 0;
      const send = async (action: Record<string, unknown>) => {
        const n = ++request,
          result = next(ws!, (m) => m.type === 'result' && m.request === n);
        ws!.send(JSON.stringify({ type: 'action', request: n, action }));
        return result;
      };
      assert.equal(
        (await send({ type: 'radio', operation: 'key', text: 'keep my carrier' })).ok,
        true,
      );
      assert.equal((await send({ type: 'radio', operation: 'channel', value: 999 })).ok, false);
      let current = app.worlds.get(w.id)!;
      assert.equal(
        radioView(current, current.players[p.id]).keyed.length,
        1,
        'failed action retains keyed station',
      );
      assert.equal((await send({ type: 'radio', operation: 'release' })).ok, true);
      const save = app.store.saveWorld.bind(app.store);
      app.store.saveWorld = () => {
        throw Error('simulated disk failure');
      };
      try {
        assert.equal(
          (await send({ type: 'radio', operation: 'key', text: 'must roll back' })).ok,
          false,
        );
      } finally {
        app.store.saveWorld = save;
      }
      current = app.worlds.get(w.id)!;
      assert.equal(
        radioView(current, current.players[p.id]).keyed.length,
        0,
        'uncommitted key does not survive rollback',
      );
    } finally {
      ws?.terminate();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  'private radio events reach only their listener and stop repeating unchanged views',
  { timeout: 30000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-radio-events-')),
      app = await createApp({ dataDir: dir, port: 0, tick: false });
    const sockets: WebSocket[] = [];
    try {
      const alice = app.universe.register('Radio Alice'),
        bob = app.universe.register('Radio Bob');
      const w = createWorld('radio-events', 'Radio events', alice.account.id);
      w.script = '';
      const a = addPlayer(w, alice.account.id, alice.account.name),
        b = addPlayer(w, bob.account.id, bob.account.name);
      Object.assign(a, { x: 0, y: 0, z: 0, vehicle: 0 });
      Object.assign(b, { x: 1, y: 0, z: 0, vehicle: 0 });
      app.worlds.set(w.id, w);
      const port = await app.listen();
      for (const pilot of [alice, bob]) {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        sockets.push(ws);
        await new Promise<void>((r) => ws.once('open', r));
        const initial = next(ws, (m) => m.type === 'radio');
        ws.send(JSON.stringify({ type: 'hello', token: pilot.token, world: w.id }));
        const m = await initial;
        assert.equal(m.world, w.id);
        assert.equal(m.vehicle, 0);
        assert.equal(m.view.config.handle, pilot.account.name);
        assert.deepEqual(m.view.traffic, []);
      }
      const [sa, sb] = sockets;
      const events: any[] = [];
      sb.on('message', (raw) => {
        const m = JSON.parse(String(raw));
        if (m.type === 'radio') events.push(m);
      });
      let id = 0;
      const action = async (ws: WebSocket, action: unknown) => {
        const request = ++id,
          result = next(ws, (m) => m.type === 'result' && m.request === request);
        ws.send(JSON.stringify({ type: 'action', request, action }));
        assert.equal((await result).ok, true);
      };
      const changed = next(sb, (m) => m.type === 'radio' && m.view.config.channel === 9);
      await action(sb, { type: 'radio', operation: 'channel', value: 9 });
      await changed;
      await action(sa, { type: 'radio', operation: 'key', text: 'private channel nineteen' });
      const count = events.length;
      await action(sb, { type: 'radio', operation: 'channel', value: 9 });
      assert.equal(events.length, count, 'unchanged private view is not repeated');
      assert.equal(
        events.some((m) => JSON.stringify(m).includes('private channel nineteen')),
        false,
      );
      assert.equal(
        events.some((m) => m.view.keyed.some((tx: any) => tx.from === a.id)),
        false,
      );
      const carrier = next(sb, (m) => m.type === 'radio' && m.view.keyed.length === 1);
      await action(sb, { type: 'radio', operation: 'channel', value: 19 });
      assert.equal((await carrier).view.keyed[0].from, a.id);
      assert.equal(
        w.messages.some((m) => m.text === 'private channel nineteen'),
        false,
      );
      tickRadio(w, 3);
      assert.equal(radioView(w, b).traffic.length, 1);
      await action(sb, {
        type: 'radio',
        operation: 'key',
        text: 'Stop this microphone on disconnect',
      });
      const closed = new Promise<void>((r) => sb.once('close', () => r()));
      sb.close();
      await closed;
      const reconnect = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(reconnect);
      await new Promise<void>((r) => reconnect.once('open', r));
      const fresh = next(reconnect, (m) => m.type === 'radio');
      reconnect.send(JSON.stringify({ type: 'hello', token: bob.token, world: w.id }));
      const resumed = await fresh;
      assert.deepEqual(
        resumed.view.traffic,
        [],
        'reconnecting before a tick cannot replay prior received traffic',
      );
      assert.deepEqual(resumed.view.keyed, [], 'disconnect immediately drops the old microphone');
    } finally {
      sockets.forEach((ws) => ws.terminate());
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

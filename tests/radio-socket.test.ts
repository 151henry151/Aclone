// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { radioView } from '../src/shared/radio';
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { radioAction, tickRadio } from '../src/shared/radio';
import { radioRules } from '../src/shared/radio-rules';
import { creatorSchema } from '../src/shared/creator';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function next(ws: WebSocket, type: string) {
  return new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', read);
      reject(Error('Missing ' + type));
    }, 3000);
    const read = (raw: any) => {
      const m = JSON.parse(String(raw));
      if (m.type === type) {
        clearTimeout(timer);
        ws.off('message', read);
        resolve(m);
      }
    };
    ws.on('message', read);
  });
}
test(
  'relay bounded authenticated microphone frames only to eligible listeners without saving worlds',
  { timeout: 30000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-voice-')),
      app = await createApp({ dataDir: dir, port: 0, tick: false });
    const sockets: WebSocket[] = [];
    try {
      const w = createWorld('voice', 'Voice', 'a');
      w.script = '';
      w.creator = creatorSchema.parse({ scenery: false });
      w.landscape = {
        paths: [],
        surfaces: [],
        scatter: [],
        barriers: [],
        heightmap: Array(1089).fill(0),
      };
      w.settings.seaLevel = -10;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      const players = [];
      const received: any[][] = [];
      for (const name of ['Speaker', 'Listener', 'Other channel']) {
        const pilot = app.universe.register(name),
          p = addPlayer(w, pilot.account.id, name);
        Object.assign(p, { x: 0, y: 0, z: 0, vehicle: 0 });
        players.push(p);
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        sockets.push(ws);
        await new Promise<void>((r) => ws.once('open', r));
        const welcome = next(ws, 'welcome');
        ws.send(JSON.stringify({ type: 'hello', token: pilot.token, world: w.id }));
        await welcome;
        const inbox: any[] = [];
        received.push(inbox);
        ws.on('message', (raw) => {
          const m = JSON.parse(String(raw));
          if (m.type === 'radio-audio') inbox.push(m);
        });
      }
      radioAction(w, players[2], { type: 'radio', operation: 'channel', value: 9 });
      const result = next(sockets[0], 'result');
      sockets[0].send(
        JSON.stringify({
          type: 'action',
          request: 1,
          action: { type: 'radio', operation: 'voice', value: 'test-session' },
        }),
      );
      assert.equal((await result).ok, true);
      let saves = 0;
      const save = app.store.saveWorld.bind(app.store);
      app.store.saveWorld = () => {
        saves++;
      };
      const data = Buffer.alloc(3200, 42).toString('base64');
      const frame = (sequence: number, overrides = {}) =>
        sockets[0].send(
          JSON.stringify({
            type: 'radio-audio',
            token: 'test-session',
            sequence,
            data,
            ...overrides,
          }),
        );
      frame(0);
      await sleep(60);
      assert.equal(received[1].length, 1);
      assert.equal(received[1][0].data, data);
      assert.equal(received[1][0].sampleRate, 16000);
      assert.equal(received[0].length, 0);
      assert.equal(received[2].length, 0);
      frame(0);
      frame(1, { token: 'stale-session' });
      frame(1, { data: 'bad' });
      await sleep(40);
      assert.equal(received[1].length, 1, 'reject duplicate, wrong token and malformed frame');
      for (let i = 1; i < 80; i++) frame(i);
      await sleep(60);
      assert.ok(
        received[1].length <=
          Math.ceil(
            radioRules(w.settings).radioVoiceBufferMs / radioRules(w.settings).radioVoiceChunkMs,
          ) +
            1,
        'reject audio sent faster than real time',
      );
      const count = received[1].length;
      players[0].muted = true;
      frame(80);
      await sleep(40);
      assert.equal(received[1].length, count);
      players[0].muted = false;
      radioAction(w, players[0], { type: 'radio', operation: 'release' });
      frame(81);
      await sleep(40);
      assert.equal(received[1].length, count, 'no frames after release');
      assert.equal(saves, 0, 'audio frames never persist or transact a world');
      app.store.saveWorld = save;
      radioAction(w, players[0], { type: 'radio', operation: 'voice', value: 'collision-a' });
      radioAction(w, players[2], { type: 'radio', operation: 'channel', value: 19 });
      radioAction(w, players[2], { type: 'radio', operation: 'voice', value: 'collision-b' });
      frame(0, { token: 'collision-a' });
      await sleep(40);
      assert.equal(received[1].at(-1).collision, true);
      assert.equal(
        received[1].at(-1).data,
        undefined,
        'doubling must not reveal intelligible samples',
      );
      tickRadio(w, 40);
      const after = received[1].length;
      frame(1, { token: 'collision-a' });
      await sleep(40);
      assert.equal(received[1].length, after);
      assert.ok(!JSON.stringify(w).includes(data), 'raw audio is not world state or chat');
    } finally {
      sockets.forEach((ws) => ws.terminate());
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

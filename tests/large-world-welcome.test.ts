// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';

test(
  'compressed mature-world entry delivers welcome after state and before a later pong',
  { timeout: 30000 },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), 'aclone-welcome-'));
    const app = await createApp({ dataDir: dir, port: 0, tick: false });
    const pilot = app.universe.register('Returning walker');
    const world = app.worlds.get('puddlewick')!;
    world.script = '';
    world.roads = Array.from({ length: 8000 }, (_, i) => ({
      a: { x: 300 + i * 6, z: 300 },
      b: { x: 306 + i * 6, z: 300 },
      width: 5,
    }));
    const port = await app.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { perMessageDeflate: true });
    t.signal.addEventListener('abort', () => ws.terminate(), { once: true });
    try {
      const types: string[] = [];
      let stateBytes = 0;
      const pong = new Promise<void>((resolve, reject) => {
        ws.on('error', reject);
        ws.on('message', (raw) => {
          try {
            const message = JSON.parse(raw.toString());
            types.push(message.type);
            if (message.type === 'state') {
              stateBytes = Buffer.byteLength(raw.toString());
              assert.equal(message.world.id, world.id);
              assert.equal(message.me, pilot.account.id);
              ws.send(JSON.stringify({ type: 'ack', sequence: message.sequence }));
              ws.send(JSON.stringify({ type: 'ping', at: 12345 }));
            }
            if (message.type === 'welcome') assert.equal(message.account.id, pilot.account.id);
            if (message.type === 'pong') {
              assert.equal(message.at, 12345);
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
      await new Promise<void>((resolve, reject) => {
        ws.once('open', resolve);
        ws.once('error', reject);
      });
      assert.ok(ws.extensions.includes('permessage-deflate'));
      ws.send(JSON.stringify({ type: 'hello', protocol: 4, token: pilot.token, world: world.id }));
      await pong;
      assert.ok(
        stateBytes > 1024 * 1024,
        `fixture must exercise queued compression, got ${stateBytes} bytes`,
      );
      assert.equal(
        types.filter((type) => type === 'welcome').length,
        1,
        'welcome must not be silently discarded behind the initial world',
      );
      assert.ok(types.indexOf('state') < types.indexOf('welcome'));
      assert.ok(types.indexOf('welcome') < types.indexOf('pong'));
    } finally {
      ws.terminate();
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

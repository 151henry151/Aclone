// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';

test(
  'real sockets acknowledge simulated inputs and ignore stale commands',
  { timeout: 10000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aclone-input-ack-'));
    const app = await createApp({ dataDir: dir, port: 0 });
    const pilot = app.universe.register('Input driver');
    const port = await app.listen();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    try {
      const result = new Promise<void>((resolve, reject) => {
        let sent = false;
        ws.on('error', reject);
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(String(raw));
            if (msg.type !== 'state') return;
            ws.send(JSON.stringify({ type: 'ack', sequence: msg.sequence }));
            if (!sent) {
              sent = true;
              for (const sequence of [2, 1])
                ws.send(
                  JSON.stringify({
                    type: 'input',
                    sequence,
                    input: { throttle: sequence === 2 ? 1 : -1, steer: 0, boost: false },
                  }),
                );
            } else if (msg.inputAck === 2) {
              assert.ok(msg.inputElapsed > 0);
              assert.ok(msg.inputElapsed < 1);
              resolve();
            } else if (msg.inputAck === 1) reject(Error('stale control was accepted'));
          } catch (e) {
            reject(e);
          }
        });
      });
      await new Promise<void>((resolve) => ws.once('open', resolve));
      ws.send(
        JSON.stringify({ type: 'hello', token: pilot.token, world: 'puddlewick', protocol: 3 }),
      );
      await result;
    } finally {
      ws.terminate();
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

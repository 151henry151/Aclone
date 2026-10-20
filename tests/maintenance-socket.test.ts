// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
import { act } from '../src/shared/simulation.ts';
test(
  'maintenance blocks socket exchange and takeoff, including actions outside the shared dispatcher',
  { timeout: 10000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aclone-pause-')),
      app = await createApp({ dataDir: dir, port: 0 });
    const pilot = app.universe.register('Paused pilot'),
      w = app.worlds.get('puddlewick')!;
    const port = await app.listen(),
      ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    try {
      const welcomed = new Promise<void>((resolve) =>
        ws.on('message', (raw) => {
          if (JSON.parse(String(raw)).type === 'welcome') resolve();
        }),
      );
      await new Promise<void>((resolve) => ws.once('open', resolve));
      ws.send(JSON.stringify({ type: 'hello', token: pilot.token, world: w.id }));
      await welcomed;
      const p = w.players[pilot.account.id],
        portBuilding = w.buildings.find((b) => b.kind === 'starport')!;
      w.owner = p.id;
      p.x = portBuilding.x;
      p.z = portBuilding.z;
      p.cash = 1000000;
      act(w, p.id, { type: 'maintenance', paused: true });
      const time = w.time,
        cash = p.cash;
      for (const [index, action] of [
        { type: 'exchange', amount: 1 },
        { type: 'takeoff' },
      ].entries()) {
        const result = new Promise<any>((resolve) => {
          const handler = (raw: any) => {
            const m = JSON.parse(String(raw));
            if (m.type === 'result' && m.request === index) {
              ws.off('message', handler);
              resolve(m);
            }
          };
          ws.on('message', handler);
        });
        ws.send(JSON.stringify({ type: 'action', request: index, action }));
        const response = await result;
        assert.equal(response.ok, false);
        assert.match(response.message, /paused/);
      }
      assert.equal(w.time, time);
      assert.equal(p.cash, cash);
      assert.equal(p.online, true);
    } finally {
      ws.terminate();
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
import { mergeState } from '../src/client/state.ts';
import { InputStream } from '../src/client/input-stream.ts';
import { slowLink } from './fixtures/slow-link.ts';
import type { World } from '../src/shared/types.ts';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate: () => boolean, timeout = 10000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < end, 'condition timed out');
    await wait(30);
  }
}

test(
  'slow compressed TCP link drives, chats and catches up without slowing a fast peer',
  { timeout: 30000 },
  async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-slow-'));
    const app = await createApp({ dataDir: dir, port: 0 });
    const port = await app.listen();
    // 64 kbit/s down, 16 kbit/s up; at least 400 ms RTT plus up to 150 ms jitter each way.
    const proxy = await slowLink(port, {
      downBytesPerSecond: 8000,
      upBytesPerSecond: 2000,
      oneWayMs: 200,
      jitterMs: 150,
    });
    const sockets: WebSocket[] = [];
    let controls: ReturnType<typeof setInterval> | undefined;
    try {
      const w = app.worlds.get('puddlewick')!;
      w.script = '';
      const connect = async (name: string, target: number) => {
        const pilot = app.universe.register(name);
        const ws = new WebSocket(`ws://127.0.0.1:${target}/ws`);
        sockets.push(ws);
        const state = {
          world: undefined as World | undefined,
          frames: 0,
          sequence: 0,
          acknowledge: true,
          errors: [] as string[],
          lag: [] as number[],
        };
        ws.on('message', (raw) => {
          const message = JSON.parse(raw.toString());
          if (message.type === 'state') {
            state.world = mergeState(state.world, message);
            state.frames++;
            state.sequence = message.sequence;
            state.lag.push(w.time - state.world.time);
            if (state.acknowledge)
              ws.send(JSON.stringify({ type: 'ack', sequence: message.sequence }));
          }
          if (message.type === 'result' && !message.ok) state.errors.push(message.message);
        });
        await new Promise<void>((resolve, reject) => {
          ws.once('open', resolve);
          ws.once('error', reject);
        });
        ws.send(JSON.stringify({ type: 'hello', protocol: 3, token: pilot.token, world: w.id }));
        await until(() => !!state.world);
        return { ws, state, id: pilot.account.id };
      };
      const fast = await connect('Fast observer', port);
      const slow = await connect('Slow driver', proxy.port);
      const p = w.players[slow.id];
      p.x = 0;
      p.z = 17;
      p.heading = 0;
      const stream = new InputStream();
      let throttle = 1;
      controls = setInterval(() => {
        const packet = stream.encode(
          { throttle, steer: 0, boost: false },
          performance.now(),
          slow.ws.bufferedAmount,
        );
        if (packet) slow.ws.send(packet);
      }, 50);
      const firstFast = fast.state.frames;
      await until(() => p.z > 20);
      const slowInitialZ = slow.state.world!.players[slow.id].z;
      slow.ws.send(
        JSON.stringify({ type: 'action', action: { type: 'chat', text: 'Slow link hello' } }),
      );
      await until(() => !!slow.state.world!.messages.find((m) => m.text === 'Slow link hello'));
      await wait(2500);
      assert.ok(slow.state.world!.players[slow.id].z > slowInitialZ + 1);
      throttle = 0;
      await until(() => Math.abs(p.speed) < 0.1);
      assert.deepEqual(slow.state.errors, []);
      assert.deepEqual(fast.state.errors, []);
      assert.ok(fast.state.frames - firstFast >= 15, 'fast peer stopped receiving normal updates');
      assert.ok(
        slow.state.lag.slice(3).every((lag) => lag < 2),
        'stale updates accumulated on slow link',
      );
      // Explicitly stop ACKs: at most three outstanding frames, while the fast peer continues.
      slow.state.acknowledge = false;
      await wait(1600); // drain ACKs already travelling upstream
      const stopped = slow.state.frames,
        fastBefore = fast.state.frames;
      await wait(850);
      assert.equal(slow.state.frames, stopped);
      assert.ok(fast.state.frames - fastBefore >= 3);
      const currentTime = w.time;
      slow.state.acknowledge = true;
      slow.ws.send(JSON.stringify({ type: 'ack', sequence: slow.state.sequence }));
      await until(() => slow.state.world!.time >= currentTime);
      assert.equal(slow.ws.readyState, WebSocket.OPEN);
      assert.ok(w.time - slow.state.world!.time < 1.5, 'resume must deliver fresh state');
      t.diagnostic(
        JSON.stringify({
          slowFrames: slow.state.frames,
          fastFrames: fast.state.frames,
          maxStateAgeSeconds: +Math.max(...slow.state.lag.slice(3)).toFixed(2),
          ...proxy.metrics,
        }),
      );
    } finally {
      if (controls) clearInterval(controls);
      for (const socket of sockets) socket.terminate();
      await proxy.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

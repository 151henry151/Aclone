// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, createConnection } from 'node:net';
import { setImmediate as turn } from 'node:timers/promises';
import { slowLink } from './fixtures/slow-link';

test('shaped TCP keeps byte order when delayed timer callbacks become runnable together', async (t) => {
  const received: Buffer[] = [];
  const server = createServer((socket) => socket.on('data', (data) => received.push(data)));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const proxy = await slowLink((server.address() as { port: number }).port, {
    downBytesPerSecond: 8000,
    upBytesPerSecond: 2000,
    oneWayMs: 0,
    jitterMs: 0,
  });
  const socket = createConnection({ host: '127.0.0.1', port: proxy.port });
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  const pending: (() => void)[] = [];
  // Exercise delayed timer buckets in an adverse order. TCP must still deliver
  // the source byte stream in order; timer scheduling is not a framing protocol.
  t.mock.method(globalThis, 'setTimeout', (callback: () => void) => {
    pending.push(callback);
    return {} as ReturnType<typeof setTimeout>;
  });
  try {
    const sent = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37 + (i >> 8)) % 256));
    socket.write(sent);
    for (let i = 0; i < 1000 && Buffer.concat(received).length < sent.length; i++) {
      await turn();
      for (const callback of pending.splice(0).reverse()) callback();
    }
    assert.deepEqual(Buffer.concat(received), sent);
  } finally {
    t.mock.restoreAll();
    socket.destroy();
    await proxy.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

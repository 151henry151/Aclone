// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { connect } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';

test('shutdown closes speculative browser connections without waiting for an HTTP request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-shutdown-'));
  const app = await createApp({ dataDir: dir, port: 0 });
  const port = await app.listen();
  const socket = connect(port, '127.0.0.1');
  await once(socket, 'connect');
  // Browsers may preconnect and never send a request, even after a tab closes.
  // Confirm the server accepted the connection before asking it to shut down.
  assert.equal(
    await new Promise<number>((resolve, reject) => {
      app.server.getConnections((error, count) => (error ? reject(error) : resolve(count)));
    }),
    1,
  );
  const closing = app.close();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      closing,
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Shutdown waited for an unused connection')),
          2000,
        );
      }),
    ]);
    assert.equal(app.server.listening, false);
  } finally {
    clearTimeout(timeout);
    socket.destroy();
    await closing;
    rmSync(dir, { recursive: true, force: true });
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { waitForGameServer } from '../scripts/wait-ci-server';

for (const [name, payload, accepted] of [
  ['current Aclone', { ok: true, version: '1.2.3', worlds: 1 }, true],
  ['another service', { database: 'ok', version: '13.2.4' }, false],
  ['stale Aclone', { ok: true, version: '1.2.2', worlds: 1 }, false],
] as const) {
  test(`CI readiness ${accepted ? 'accepts' : 'rejects'} ${name}`, async (t) => {
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(payload));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const check = waitForGameServer(`http://127.0.0.1:${address.port}/`, process.pid, '1.2.3');
    if (accepted) await check;
    else await assert.rejects(check, /Unexpected service or version/);
  });
}
test('CI readiness refuses an exited server before visiting a port', async () => {
  await assert.rejects(
    waitForGameServer('http://127.0.0.1:1/', 2147483647, '1.2.3'),
    /CI game server exited/,
  );
});

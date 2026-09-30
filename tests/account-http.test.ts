// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
test('HTTP email verification and password reset revoke an active game connection without losing progress', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-auth-'));
  const links: string[] = [];
  const app = await createApp({
    dataDir: dir,
    port: 0,
    publicOrigin: 'https://game.example/aclone/',
    mailer: async (_to, link) => {
      links.push(link);
    },
  });
  let ws: WebSocket | undefined;
  try {
    const port = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    const post = async (path: string, body: unknown, token = '') => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: (await r.json()) as any };
    };
    const pilot = (await post('/api/register', { name: 'Email pilot' })).data;
    await post(
      '/api/auth/configure',
      { password: 'a long HTTP test password', email: 'pilot@example.com' },
      pilot.token,
    );
    assert.equal(links.length, 1);
    assert.equal(new URL(links[0]).pathname, '/aclone/');
    assert.equal(
      (await post('/api/auth/verify', { token: new URL(links[0]).hash.split('=')[1] })).status,
      200,
    );
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((r) => ws!.once('open', r));
    const entered = new Promise<void>((r) =>
      ws!.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'state') r();
      }),
    );
    ws.send(
      JSON.stringify({ type: 'hello', token: pilot.token, world: 'puddlewick', protocol: 2 }),
    );
    await entered;
    const p = app.worlds.get('puddlewick')!.players[pilot.account.id];
    p.inventory.logs = 23;
    const unknown = await post('/api/auth/forgot', { email: 'unknown@example.com' });
    const known = await post('/api/auth/forgot', { email: 'pilot@example.com' });
    assert.deepEqual(unknown, known);
    assert.equal(links.length, 2);
    await post('/api/auth/forgot', { email: 'pilot@example.com' });
    assert.equal(links.length, 2, 'repeated mail is cooled down');
    const closed = new Promise<number>((r) => ws!.once('close', r));
    assert.equal(
      (
        await post('/api/auth/reset', {
          token: new URL(links[1]).hash.split('=')[1],
          password: 'a new long HTTP password',
        })
      ).status,
      200,
    );
    assert.equal(await closed, 4004);
    assert.equal(p.online, false);
    assert.equal(p.inventory.logs, 23);
    assert.equal(app.universe.authenticate(pilot.token), undefined);
    const login = await post('/api/auth/login', {
      name: 'Email pilot',
      password: 'a new long HTTP password',
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.account.id, pilot.account.id);
    assert.equal(
      (
        await post('/api/auth/reset', {
          token: new URL(links[1]).hash.split('=')[1],
          password: 'a reused reset password',
        })
      ).status,
      400,
    );
  } finally {
    ws?.terminate();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

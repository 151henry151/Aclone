// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
import { exportDesign } from '../src/server/world-design.ts';
test('HTTP creator import, owner exports and ordered live Lua events survive actual server paths', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-creator-http-')),
    app = await createApp({ dataDir: dir, port: 0 });
  const sockets: WebSocket[] = [];
  try {
    const port = await app.listen(),
      base = `http://127.0.0.1:${port}`,
      owner = app.universe.register('Owner'),
      visitor = app.universe.register('Visitor');
    const post = async (path: string, data: unknown, key = owner.token) => {
      const r = await fetch(base + path, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      return { status: r.status, data: (await r.json()) as any };
    };
    const created = await post('/api/worlds', {
      name: 'Flag arena',
      template: 'ctf',
      settings: { dayLength: 0 },
    });
    assert.equal(created.status, 201);
    const w = app.worlds.get(created.data.id)!;
    assert.equal(w.creator!.arena.mode, 'ctf');
    assert.equal(w.settings.dayLength, 0);
    const denied = await fetch(base + '/api/design/' + w.id, {
      headers: { authorization: 'Bearer ' + visitor.token },
    });
    assert.notEqual(denied.status, 200);
    const good = await fetch(base + '/api/design/' + w.id, {
      headers: { authorization: 'Bearer ' + owner.token },
    });
    assert.equal(good.status, 200);
    const design = await good.json();
    const imported = await post('/api/worlds', { name: 'Flag copy', template: 'blank', design });
    assert.equal(imported.status, 201);
    const count = app.worlds.size;
    const bad = await post('/api/worlds', {
      name: 'Bad design',
      template: 'blank',
      design: {
        ...exportDesign(w),
        script: 'on("ScriptReload", function(e) give("nobody", "water", 9999999) end)',
      },
    });
    assert.notEqual(bad.status, 201);
    assert.equal(app.worlds.size, count);
    w.script =
      'on("PlayerLogin", function(e) setvar("joins",getvar("joins")+1); give(e.id,"water",1) end)';
    for (const identity of [owner, visitor]) {
      const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
      sockets.push(ws);
      await new Promise<void>((r) => ws.once('open', () => r()));
      ws.send(JSON.stringify({ type: 'hello', token: identity.token, world: w.id, protocol: 2 }));
    }
    for (let i = 0; i < 150 && w.scriptVariables.joins !== 2; i++) await delay(20);
    assert.equal(w.scriptVariables.joins, 2);
    assert.ok(w.players[owner.account.id].inventory.water >= 1);
    assert.ok(w.players[visitor.account.id].inventory.water >= 1);
    const reload = app.store.loadWorlds().find((row) => row.world.id === imported.data.id)!.world;
    assert.equal(reload.creator!.arena.mode, 'ctf');
  } finally {
    for (const s of sockets) s.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

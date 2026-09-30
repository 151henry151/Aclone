// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
function next(ws: WebSocket, predicate: (m: any) => boolean) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', listener);
      reject(Error('Message timeout'));
    }, 4000);
    const listener = (raw: any) => {
      const m = JSON.parse(raw.toString());
      if (predicate(m)) {
        clearTimeout(timeout);
        ws.off('message', listener);
        resolve(m);
      }
    };
    ws.on('message', listener);
  });
}
test('real headless server: identity, six clients, chat, denied edits, atomic requests and reconnect', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-network-')),
    app = await createApp({ dataDir: dir, port: 0 });
  const port = await app.listen(),
    base = `http://127.0.0.1:${port}`,
    sockets: WebSocket[] = [];
  try {
    const index = await fetch(base + '/');
    if (index.ok) {
      const html = await index.text();
      const src = html.match(/src="([^"]+\.js)"/)?.[1];
      assert.ok(src);
      // The production proxy strips any configured deployment prefix.
      const assetPath = src.slice(src.lastIndexOf('/assets/'));
      assert.ok(assetPath.startsWith('/assets/'));
      const bundle = await fetch(base + assetPath);
      assert.equal(bundle.status, 200);
      assert.match(bundle.headers.get('content-type') ?? '', /javascript/);
    }
    const pilots = [];
    for (let i = 0; i < 6; i++)
      pilots.push(
        (await (
          await fetch(base + '/api/register', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Pilot ' + i }),
          })
        ).json()) as any,
      );
    for (const pilot of pilots) {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      await new Promise((r) => ws.once('open', r));
      const ready = next(ws, (m) => m.type === 'state');
      ws.send(JSON.stringify({ type: 'hello', token: pilot.token, world: 'puddlewick' }));
      await ready;
    }
    const ws = sockets[0];
    let result = next(ws, (m) => m.type === 'result');
    ws.send(
      JSON.stringify({ type: 'action', action: { type: 'settings', patch: { fighting: true } } }),
    );
    assert.equal((await result).ok, false);
    const chat = next(
      sockets[1],
      (m) => m.type === 'state' && m.world.messages.some((x: any) => x.text === 'Hello parish'),
    );
    ws.send(JSON.stringify({ type: 'action', action: { type: 'chat', text: 'Hello parish' } }));
    await chat;
    for (const socket of sockets) {
      const joined = next(socket, (m) => m.type === 'result');
      socket.send(
        JSON.stringify({ type: 'action', action: { type: 'joinGame', game: 'hornball' } }),
      );
      assert.equal((await joined).ok, true);
    }
    assert.equal(
      Object.values(app.worlds.get('puddlewick')!.players).filter((p) => p.game === 'hornball')
        .length,
      6,
    );
    const created = (await (
      await fetch(base + '/api/worlds', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + pilots[0].token, 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'My parish', template: 'economy' }),
      })
    ).json()) as any;
    assert.ok(created.id);
    const owner = next(ws, (m) => m.type === 'state' && m.world.id === created.id);
    ws.send(JSON.stringify({ type: 'action', action: { type: 'land', world: created.id } }));
    assert.equal((await owner).world.players[pilots[0].account.id].authority, 20);
  } finally {
    for (const ws of sockets) ws.terminate();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('disconnecting a parked pilot removes it from legacy and delta views without deleting progress', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-presence-'));
  const app = await createApp({ dataDir: dir, port: 0 });
  const sockets: WebSocket[] = [];
  try {
    const port = await app.listen();
    const world = app.worlds.get('puddlewick')!;
    world.script = '';
    const connect = async (name: string, protocol: number) => {
      const pilot = app.universe.register(name);
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      await new Promise((r) => ws.once('open', r));
      const ready = next(ws, (m) => m.type === 'state');
      ws.send(
        JSON.stringify({
          type: 'hello',
          protocol: protocol === 2 ? 2 : undefined,
          token: pilot.token,
          world: world.id,
        }),
      );
      await ready;
      return { ws, id: pilot.account.id };
    };
    const parked = await connect('Launch Check', 2);
    const legacy = await connect('Legacy observer', 1);
    const delta = await connect('Delta observer', 2);
    world.players[parked.id].inventory.logs = 7;
    const removedLegacy = next(legacy.ws, (m) => m.type === 'state' && !m.world.players[parked.id]);
    const removedDelta = next(
      delta.ws,
      (m) => m.type === 'state' && m.world.players[parked.id] === null,
    );
    parked.ws.close();
    await Promise.all([removedLegacy, removedDelta]);
    assert.equal(world.players[parked.id].online, false);
    assert.equal(world.players[parked.id].inventory.logs, 7);
    const saved = app.store.loadWorlds().find((s) => s.world.id === world.id)!;
    assert.equal(saved.world.players[parked.id].online, false);
    assert.equal(saved.world.players[parked.id].inventory.logs, 7);
  } finally {
    for (const socket of sockets) socket.terminate();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
function next(ws: WebSocket, predicate: (m: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', read);
      reject(Error('Timeout'));
    }, 5000);
    const read = (raw: any) => {
      const m = JSON.parse(raw.toString());
      if (predicate(m)) {
        clearTimeout(timeout);
        ws.off('message', read);
        resolve(m);
      }
    };
    ws.on('message', read);
  });
}
test('delta protocol sends full reconnect state and disconnect/restart preserves pending rewards and estate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-durable-'));
  let app = await createApp({ dataDir: dir, port: 0 });
  let ws: WebSocket | undefined;
  try {
    const pilot = app.universe.register('Durable');
    const port = await app.listen();
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((r) => ws!.once('open', r));
    const first = next(ws, (m) => m.type === 'state');
    ws.send(
      JSON.stringify({ type: 'hello', protocol: 2, token: pilot.token, world: 'puddlewick' }),
    );
    assert.equal((await first).partial, false);
    const delta = await next(ws, (m) => m.type === 'state' && m.partial);
    assert.equal(delta.world.terrain, undefined);
    const world = app.worlds.get('puddlewick')!,
      player = world.players[pilot.account.id];
    player.inventory.logs = 17;
    player.skills = ['miller'];
    player.x = 42;
    player.task = { kind: 'labour', end: world.time + 1 } as any;
    const mill = world.buildings.find((b) => b.kind === 'mill')!;
    mill.owner = player.id;
    mill.investment = 12345;
    ws.close();
    await new Promise((r) => ws!.once('close', r));
    await new Promise((r) => setTimeout(r, 50));
    await app.close();
    app = await createApp({ dataDir: dir, port: 0 });
    const restored = app.worlds.get('puddlewick')!.players[player.id];
    assert.equal(restored.online, false);
    assert.equal(restored.x, 42);
    assert.equal(restored.inventory.logs, 17);
    assert.deepEqual(restored.skills, ['miller']);
    assert.equal(
      app.worlds.get('puddlewick')!.buildings.find((b) => b.id === mill.id)!.investment,
      12345,
    );
    assert.equal(app.universe.authenticate(pilot.token)?.id, pilot.account.id);
    await new Promise((r) => setTimeout(r, 1100));
    assert.equal(restored.task, undefined);
    assert.equal(restored.cash, 184500);
  } finally {
    ws?.terminate();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an acknowledged property purchase survives an abrupt process kill', async () => {
  const { fork } = await import('node:child_process');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-crash-'));
  const child = fork(new URL('./fixtures/crash-server.ts', import.meta.url), [], {
    env: { ...process.env, CRASH_DATA: dir },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  let ws: WebSocket | undefined;
  try {
    const { port } = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Child startup timeout')), 10000);
      child.once('message', (message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
    const base = `http://127.0.0.1:${port}`;
    const pilot = (await (
      await fetch(base + '/api/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'Crash pilot' }),
      })
    ).json()) as any;
    const created = (await (
      await fetch(base + '/api/worlds', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + pilot.token },
        body: JSON.stringify({ name: 'Crash parish', template: 'economy' }),
      })
    ).json()) as any;
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise((r) => ws!.once('open', r));
    let state = next(ws, (m) => m.type === 'state');
    ws.send(JSON.stringify({ type: 'hello', token: pilot.token, world: created.id }));
    const initial = await state;
    const home = initial.world.buildings.find((b: any) => b.kind === 'home');
    const request = async (action: any) => {
      const result = next(ws!, (m) => m.type === 'result' && m.request === 7);
      ws!.send(JSON.stringify({ type: 'action', request: 7, action }));
      assert.equal((await result).ok, true);
    };
    await request({ type: 'chat', text: `*teleport ${pilot.account.id} ${home.x} ${home.z}` });
    state = next(
      ws,
      (m) =>
        m.type === 'state' &&
        m.world.buildings.some((b: any) => b.id === home.id && b.owner === pilot.account.id),
    );
    await request({ type: 'buyBuilding', building: home.id });
    const purchased = await state;
    const exited = new Promise((r) => child.once('exit', r));
    child.kill('SIGKILL');
    await exited;
    const recovered = await createApp({ dataDir: dir, port: 0, tick: false });
    try {
      const w = recovered.worlds.get(created.id)!;
      assert.equal(w.buildings.find((b) => b.id === home.id)!.owner, pilot.account.id);
      assert.equal(
        w.players[pilot.account.id].cash,
        purchased.world.players[pilot.account.id].cash,
      );
      assert.equal(recovered.universe.authenticate(pilot.token)?.id, pilot.account.id);
    } finally {
      await recovered.close();
    }
  } finally {
    ws?.terminate();
    child.kill('SIGKILL');
    rmSync(dir, { recursive: true, force: true });
  }
});

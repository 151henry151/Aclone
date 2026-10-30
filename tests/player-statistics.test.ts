import { WebSocket } from 'ws';
import { setTimeout as delay } from 'node:timers/promises';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, addPlayer, act, advance, log } from '../src/shared/simulation.ts';
import { resourceNodes, cancelGather } from '../src/shared/resources.ts';
import { playerStatistics } from '../src/shared/player-statistics.ts';
import { statisticsHtml } from '../src/client/reports.ts';
import { Playtime, reconstructPlaytime, type PlaytimeHistory } from '../src/server/playtime.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { createApp } from '../src/server/app.ts';

const history: PlaytimeHistory = {
  coverage: [
    { world: 'one', lo: 0, hi: 100 },
    { world: 'one', lo: 80, hi: 120 },
    { world: 'one', lo: 200, hi: 400 },
    { world: 'two', lo: 0, hi: 100 },
  ],
  events: [
    ['one', 10, 'Ada arrived.'],
    ['one', 90, 'Ada has left.'],
    ['one', 10, 'Ada arrived.'],
    ['one', 90, 'Ada has left.'], // duplicate backup
    ['one', 110, 'Ada arrived.'],
    ['one', 220, 'Ada has left.'], // missing coverage
    ['one', 230, 'Ada arrived.'],
    ['one', 250, 'Ada arrived.'],
    ['one', 290, 'Ada has left.'],
    ['one', 300, 'Ada arrived.'], // missing departure: no invented playtime
    ['two', 10, 'Ada arrived.'],
    ['two', 30, 'Ada has left.'],
  ],
};
test('reconstruction unions overlapping backups, rejects gaps and incomplete sessions, sums worlds', () => {
  assert.equal(reconstructPlaytime(history).get('Ada'), 140);
});
test('historical time is imported once; connected time deduplicates accounts and survives restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-statistics-'));
  const s = new Store(join(dir, 'test.sqlite'));
  try {
    const pilot = new Universe(s).register('Ada').account;
    const file = join(dir, 'history.json');
    writeFileSync(file, JSON.stringify(history));
    let time = new Playtime(s, file);
    time.advance([pilot.id, pilot.id], 120);
    time.advance([], 10000);
    assert.equal(time.get(pilot.id).recordedSeconds, 120);
    assert.equal(time.get(pilot.id).estimatedSeconds, 140);
    time.save();
    // Extra post-upgrade archive data must not re-import already tracked playtime.
    writeFileSync(
      file,
      JSON.stringify({ ...history, events: [...history.events, ['one', 350, 'Ada has left.']] }),
    );
    time = new Playtime(s, file);
    assert.equal(time.get(pilot.id).recordedSeconds + time.get(pilot.id).estimatedSeconds, 260);
    const copy = time.get(pilot.id);
    copy.recordedSeconds = 999999;
    assert.equal(time.get(pilot.id).recordedSeconds, 120);
  } finally {
    s.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test('personal money separates earnings, transfers, financing and gifts; business receipts are not personal', () => {
  const w = createWorld('stats', 'Statistics', 'owner');
  const p = addPlayer(w, 'p', 'Pilot');
  const s = p.statistics!;
  const baseline = s.otherReceived;
  log(w, 'transfer', 100, 'mill', p.id, 'wage');
  log(w, 'transfer', 75, 'mill', p.id, 'sale');
  log(w, 'transfer', 60, p.id, 'mill', 'purchase');
  log(w, 'transfer', 100, p.id, p.id + ':bank', 'bank');
  log(w, 'transfer', 100, p.id + ':bank', p.id, 'bank');
  log(w, 'transfer', 500, 'bank', p.id, 'loan disbursement');
  log(w, 'transfer', 120, p.id, 'mill', 'investment');
  log(w, 'transfer', 25, 'friend', p.id, 'player gift');
  log(w, 'transfer', 50, p.id + ':bank', 'bank', 'loan repayment');
  log(w, 'sink', 10, p.id + ':bank', 'treasury', 'death savings loss');
  log(w, 'transfer', 999, 'friend', 'mill', 'purchase');
  assert.deepEqual(
    [s.earned, s.spent, s.capitalIn, s.capitalOut, s.otherReceived - baseline],
    [175, 70, 500, 170, 25],
  );
});
test('gathering counts completed loads only, then persists through death and storage', () => {
  const w = createWorld('stats', 'Statistics', 'owner');
  const p = addPlayer(w, 'p', 'Pilot');
  const n = resourceNodes.find((n) => n.item === 'dirt')!;
  Object.assign(p, { x: n.x, z: n.z, y: 0.15, inventory: { shovel: 1 }, online: true });
  act(w, p.id, { type: 'gather', node: n.id });
  cancelGather(w, p);
  assert.deepEqual(p.statistics!.gathered, {});
  act(w, p.id, { type: 'gather', node: n.id });
  advance(w, 21);
  assert.equal(p.statistics!.gathered.dirt, 3);
  p.age = w.settings.maxAge + 1;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(p.statistics!.gathered.dirt, 3);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.players[p.id].statistics, p.statistics);
  } finally {
    store.close();
  }
});
test('only completed construction counts, including a helper delivering the final load', () => {
  const w = createWorld('stats', 'Statistics', 'owner');
  w.buildings = [];
  w.zones = [];
  const p = addPlayer(w, 'p', 'Pilot');
  p.x = 65; // Build outside the protected arrival area.
  p.cash = 1000000;
  act(w, p.id, { type: 'construct', kind: 'home' });
  assert.equal(p.statistics!.buildingsCompleted, 0);
  act(w, p.id, { type: 'cancelConstruction', building: w.buildings[0].id });
  assert.equal(p.statistics!.buildingsCompleted, 0);
  act(w, p.id, { type: 'construct', kind: 'home' });
  const b = w.buildings[0];
  const helper = addPlayer(w, 'helper', 'Helper');
  Object.assign(helper, { x: b.x, z: b.z, inventory: { ...b.construction } });
  act(w, helper.id, { type: 'supply', building: b.id });
  assert.equal(p.statistics!.buildingsCompleted, 1);
  assert.equal(helper.statistics!.buildingsCompleted, 0);
  assert.throws(() => act(w, helper.id, { type: 'supply', building: b.id }));
  assert.equal(p.statistics!.buildingsCompleted, 1);
});
test('statistics explain partial history and include estimated time in the displayed total', () => {
  const w = createWorld('stats', '<Statistics>', 'owner');
  const p = addPlayer(w, 'p', 'Pilot');
  delete p.statistics;
  playerStatistics(w, p);
  const html = statisticsHtml(w, p, {
    since: '2026-10-22T00:00:00Z',
    recordedSeconds: 3600,
    estimatedSeconds: 7200,
  });
  assert.match(html, /3h 0m/);
  assert.match(html, /Estimated from historical logs/);
  assert.match(html, /earlier activity is unknown/);
  assert.match(html, /&lt;Statistics&gt;/);
});
test('playtime API requires authentication and ignores attempts to read a different account', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-statistics-http-'));
  const app = await createApp({ dataDir: dir, port: 0, tick: false });
  try {
    const base = `http://127.0.0.1:${await app.listen()}`;
    const ada = app.universe.register('Ada');
    const bo = app.universe.register('Bo');
    app.store.db
      .prepare('INSERT INTO player_playtime VALUES (?,?,?,?)')
      .run(bo.account.id, '2026-10-22', 123, 456);
    const noAuth = await fetch(base + '/api/statistics');
    assert.notEqual(noAuth.status, 200);
    const r = await fetch(base + '/api/statistics?account=' + bo.account.id, {
      headers: { authorization: 'Bearer ' + ada.token },
    });
    assert.equal(r.status, 200);
    const body = (await r.json()) as any;
    assert.equal(body.playtime.recordedSeconds, 0);
    assert.equal(body.playtime.estimatedSeconds, 0);
    assert.ok(!JSON.stringify(body).includes(bo.account.id));
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live playtime counts space and world connections but stops while paused or disconnected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-playtime-live-'));
  const app = await createApp({ dataDir: dir, port: 0 });
  let ws: WebSocket | undefined;
  try {
    const port = await app.listen();
    const pilot = app.universe.register('Space pilot');
    const read = async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/statistics`, {
        headers: { authorization: 'Bearer ' + pilot.token },
      });
      return ((await response.json()) as any).playtime.recordedSeconds as number;
    };
    assert.equal(await read(), 0);
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await new Promise<void>((resolve) => ws!.once('open', resolve));
    const message = (type: string) =>
      new Promise<void>((resolve) => {
        const handler = (raw: Buffer) => {
          if (JSON.parse(raw.toString()).type === type) {
            ws!.off('message', handler);
            resolve();
          }
        };
        ws!.on('message', handler);
      });
    const welcome = message('welcome');
    ws.send(JSON.stringify({ type: 'hello', token: pilot.token }));
    await welcome;
    await delay(200);
    const space = await read();
    assert.ok(space > 0);
    const landed = message('state');
    ws.send(JSON.stringify({ type: 'action', action: { type: 'land', world: 'puddlewick' } }));
    await landed;
    await delay(200);
    const world = app.worlds.get('puddlewick')!;
    world.maintenance = { paused: true, history: [] };
    const paused = await read();
    assert.ok(paused > space);
    await delay(200);
    assert.equal(await read(), paused);
    delete world.maintenance;
    await delay(200);
    const closed = new Promise<void>((resolve) => ws!.once('close', () => resolve()));
    ws.close();
    await closed;
    const offline = await read();
    assert.ok(offline > paused);
    await delay(200);
    assert.equal(await read(), offline);
  } finally {
    ws?.terminate();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

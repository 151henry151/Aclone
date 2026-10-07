// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { createApp } from '../src/server/app.ts';
import { caretakerView } from '../src/shared/caretaker.ts';
import { addPlayer, createWorld } from '../src/shared/simulation.ts';
import type { Player } from '../src/shared/types.ts';

test('caretaker view lists pilots, AI residents and buildings without sealed secrets', () => {
  const world = createWorld('parish', 'Lesser Wobbleton', 'ada');
  const ada = addPlayer(world, 'ada', 'Ada Turnip');
  ada.cash = 123400;
  ada.bank = 5000;
  ada.hunger = 31000;
  ada.skills = ['farmer'];
  ada.history = [{ time: 1200, kind: 'job', text: 'Took the mill job' }];
  ada.online = true;
  const mabel = addPlayer(world, 'mabel', 'Mabel Reed');
  mabel.npc = true;
  mabel.hunger = 42000;
  mabel.thirst = 8000;
  mabel.skills = ['miller'];
  mabel.cash = 2500;
  mabel.mail = [
    {
      id: 'm1',
      from: 'ada',
      fromName: 'Ada Turnip',
      to: 'mabel',
      toName: 'Mabel Reed',
      subject: 'Quiet',
      text: 'sealed-letter-body',
      time: 1,
    },
  ];
  mabel.ballots = { puddlewick: { candidate: 'secret-ballot-choice', proposals: { 1: true } } };
  const mill = world.buildings.find((building) => building.kind === 'mill') ?? world.buildings[0];
  mill.stock.wheat = 7;
  mill.employees = [mabel.id];
  mill.accounts = {
    since: 0,
    receipts: 900,
    materials: 100,
    wages: 50,
    tax: 0,
    imports: 0,
    capitalIn: 0,
    capitalOut: 0,
    otherIn: 0,
    otherOut: 0,
    batches: 2,
    produced: {},
    consumed: {},
    bought: {},
    sold: {},
  };
  const view = caretakerView(world);
  const encoded = JSON.stringify(view);
  assert.equal(view.name, 'Lesser Wobbleton');
  assert.equal(view.census.pilots, 1);
  assert.equal(view.census.npcs, 1);
  const owner = view.residents.find((person) => person.id === 'ada');
  const npc = view.residents.find((person) => person.id === 'mabel');
  assert.equal(owner?.cash, 123400);
  assert.equal(owner?.bank, 5000);
  assert.equal(owner?.hunger, 31000);
  assert.deepEqual(
    owner?.skills.map((skill) => skill.id),
    ['farmer'],
  );
  assert.equal(owner?.history[0]?.text, 'Took the mill job');
  assert.equal(owner?.npc, false);
  assert.equal(npc?.npc, true);
  assert.equal(npc?.hunger, 42000);
  assert.equal(npc?.letters, 1);
  const listed = view.buildings.find((building) => building.id === mill.id);
  assert.equal(listed?.employees[0]?.name, 'Mabel Reed');
  assert.equal(listed?.stock.find((row) => row.id === 'wheat')?.quantity, 7);
  assert.equal(listed?.accounts?.receipts, 900);
  assert.ok(listed?.production.length);
  assert.equal(encoded.includes('sealed-letter-body'), false);
  assert.equal(encoded.includes('secret-ballot-choice'), false);
  assert.equal((world.players.mabel as Player).mail?.[0]?.text, 'sealed-letter-body');
});

function next(
  ws: WebSocket,
  predicate: (message: { type?: string; ok?: boolean; message?: string }) => boolean,
) {
  return new Promise<{
    type?: string;
    ok?: boolean;
    message?: string;
    view?: ReturnType<typeof caretakerView>;
  }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', listener);
      reject(Error('Message timeout'));
    }, 4000);
    const listener = (raw: WebSocket.RawData) => {
      const message = JSON.parse(raw.toString());
      if (predicate(message)) {
        clearTimeout(timeout);
        ws.off('message', listener);
        resolve(message);
      }
    };
    ws.on('message', listener);
  });
}

test('only the world creator receives the caretaker dashboard', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-admin-'));
  const app = await createApp({ dataDir: dir, port: 0 });
  const port = await app.listen();
  const base = `http://127.0.0.1:${port}`;
  const sockets: WebSocket[] = [];
  try {
    const register = async (name: string) =>
      (await (
        await fetch(base + '/api/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      ).json()) as { token: string; account: { id: string; name: string } };
    const owner = await register('Ada Turnip');
    const guest = await register('Bramble Quinn');
    const created = await (
      await fetch(base + '/api/worlds', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + owner.token,
        },
        body: JSON.stringify({ name: 'Lesser Wobbleton', template: 'economy' }),
      })
    ).json();
    const connect = async (token: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(ws);
      await new Promise((resolve) => ws.once('open', resolve));
      const ready = next(ws, (message) => message.type === 'state');
      ws.send(JSON.stringify({ type: 'hello', token, world: created.id, protocol: 3 }));
      await ready;
      return ws;
    };
    const ownerSocket = await connect(owner.token);
    const guestSocket = await connect(guest.token);
    let leaked = false;
    guestSocket.on('message', (raw) => {
      if (JSON.parse(raw.toString()).type === 'caretaker') leaked = true;
    });
    const denied = next(guestSocket, (message) => message.type === 'result');
    guestSocket.send(JSON.stringify({ type: 'action', request: 1, action: { type: 'caretaker' } }));
    const refusal = await denied;
    assert.equal(refusal.ok, false);
    assert.match(refusal.message ?? '', /World owner required/);
    assert.equal(leaked, false);
    const books = next(ownerSocket, (message) => message.type === 'caretaker');
    ownerSocket.send(JSON.stringify({ type: 'action', request: 1, action: { type: 'caretaker' } }));
    const view = (await books).view!;
    assert.equal(view.name, 'Lesser Wobbleton');
    assert.ok(
      view.residents.some((person) => person.name === 'Ada Turnip' && person.npc === false),
    );
    assert.ok(
      view.residents.some(
        (person) => person.name === 'Bramble Quinn' && typeof person.hunger === 'number',
      ),
    );
    assert.ok(view.buildings.length > 3);
    assert.equal(JSON.stringify(view).includes(owner.token), false);
    assert.equal(JSON.stringify(view).includes(guest.token), false);
  } finally {
    for (const socket of sockets) socket.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

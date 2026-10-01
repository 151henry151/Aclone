// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { DeltaStream, prepareFrame } from '../src/server/snapshots.ts';
import type { Account } from '../src/server/universe.ts';
for (const compact of [false, true])
  test(`protocol ${compact ? 3 : 2} isolates private inventory, messages and scripts, including reconnects`, () => {
    const w = createWorld('delta', 'Delta', 'a');
    const a = addPlayer(w, 'a', 'Ada'),
      b = addPlayer(w, 'b', 'Bo');
    a.online = b.online = true;
    a.inventory.gold = 777;
    b.inventory.gold = 888;
    w.script = 'private source';
    w.messages.push({
      name: 'Ada',
      text: 'private message',
      kind: 'chat',
      time: 0,
      to: 'a',
    } as any);
    const account = (id: string) =>
      ({
        id,
        name: id,
        credits: 50,
        ship: 'shuttle',
        system: 'hearth',
        cargo: {},
        exchanged: {},
      }) as Account;
    const first = prepareFrame(w);
    const as = new DeltaStream(compact),
      bs = new DeltaStream(compact);
    const alice = JSON.parse(as.encode(w, account('a'), first)),
      bob = JSON.parse(bs.encode(w, account('b'), first));
    assert.equal(alice.self.inventory.gold, 777);
    assert.equal(bob.self.inventory.gold, 888);
    assert.equal(bob.world.players.a.inventory, undefined);
    assert.equal(alice.world.players.b.inventory, undefined);
    assert.equal(bob.world.script, '');
    assert.ok(!bob.world.messages.some((m: any) => m.text === 'private message'));
    b.online = false;
    const delta = JSON.parse(as.encode(w, account('a'), prepareFrame(w)));
    assert.equal(delta.partial, true);
    assert.equal(compact ? delta.entities.players.b : delta.world.players.b, null);
    assert.equal(delta.world.terrain, undefined);
    assert.ok(
      JSON.parse(new DeltaStream(compact).encode(w, account('a'), prepareFrame(w))).world.terrain,
    );
  });

test('room pantry stocks are delivered only to their guest, including legacy projections', async () => {
  const { publicBuildings, privatePlayer } = await import('../src/server/snapshots.ts');
  const w = createWorld('rooms', 'Rooms', 'a'),
    a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo');
  const inn = w.buildings[0];
  inn.lodging = {
    open: true,
    rate: 100,
    guests: {
      a: { until: 3600, stock: { bread: 777 } },
      b: { until: 3600, stock: { water: 888 } },
    },
  };
  assert.deepEqual(publicBuildings(w)[0].lodging!.guests.a.stock, {});
  assert.equal(privatePlayer(w, a).roomPantries[inn.id].bread, 777);
  assert.equal(privatePlayer(w, b).roomPantries[inn.id].bread, undefined);
  assert.ok(!prepareFrame(w).fields.buildings.includes('777'));
});

test('compact states reconstruct legacy state, including deletions, privacy, ordering and skipped broadcasts', async () => {
  const { mergeState } = await import('../src/client/state.ts');
  const { advance } = await import('../src/shared/simulation.ts');
  const w = createWorld('compact', 'Compact', 'a');
  const a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo');
  a.online = b.online = true;
  const account = { id: 'a', credits: 100, cargo: {} } as Account;
  const compact = new DeltaStream(true),
    legacy = new DeltaStream();
  let actual: typeof w | undefined, expected: typeof w | undefined;
  let deliveredAccount: Account | undefined;
  for (let i = 0; i < 40; i++) {
    advance(w, 0.2);
    a.x += 0.123456;
    b.x += 0.21;
    if (i === 2) {
      a.job = w.buildings[0].id;
      a.task = { kind: 'test', end: 999 };
    }
    if (i === 3) {
      delete a.job;
      delete a.task;
    }
    if (i === 4) {
      w.buildings[0].owner = 'b';
      a.inventory.bread = 4;
    }
    if (i === 5) w.buildings.reverse();
    if (i === 6) w.buildings.splice(3, 1);
    if (i === 7) w.buildings.push({ ...w.buildings[0], id: '2' }, { ...w.buildings[0], id: '1' });
    if (i === 8) a.authority = 0; // Must revoke previously visible ledger/script.
    if (i === 9) b.online = false;
    if (i === 10) b.online = true;
    if (i === 11) account.credits += 10;
    if (i === 12)
      w.messages.push({ name: 'Bo', time: w.time, kind: 'chat', text: 'secret', to: 'b' });
    if (i === 13) w.messages.push({ name: 'Bo', time: w.time, kind: 'chat', text: 'Hello' });
    if (i > 15 && i < 25) continue; // Flow control skips generations, not deltas in flight.
    const frame = prepareFrame(w);
    const message = JSON.parse(compact.encode(w, account, frame));
    actual = mergeState(actual, message);
    expected = mergeState(expected, JSON.parse(legacy.encode(w, account, frame)));
    if (message.account) deliveredAccount = message.account;
    assert.deepEqual(actual, expected, 'state mismatch at generation ' + i);
    assert.deepEqual(deliveredAccount, account);
    assert.ok(!JSON.stringify(message).includes('secret'));
  }
  const fresh = JSON.parse(new DeltaStream(true).encode(w, account, prepareFrame(w)));
  assert.equal(fresh.partial, false);
  assert.deepEqual(mergeState(undefined, fresh), actual);
});

test('compact updates omit unchanged chat and account data and shrink a busy parish substantially', async () => {
  const { advance } = await import('../src/shared/simulation.ts');
  const w = createWorld('size', 'Size', 'owner'),
    p = addPlayer(w, 'a', 'Ada');
  p.online = true;
  for (let i = 0; i < 100; i++)
    w.messages.push({ name: 'Ada', time: 0, kind: 'chat', text: 'A busy parish message ' + i });
  const a = { id: 'a' } as Account,
    old = new DeltaStream(),
    compact = new DeltaStream(true);
  old.encode(w, a, prepareFrame(w));
  compact.encode(w, a, prepareFrame(w));
  let before = 0,
    after = 0;
  for (let i = 0; i < 20; i++) {
    advance(w, 0.2);
    const frame = prepareFrame(w);
    before += old.encode(w, a, frame).length;
    const result = compact.encode(w, a, frame);
    after += result.length;
    const packet = JSON.parse(result);
    assert.equal(packet.world.messages, undefined);
    assert.equal(packet.account, undefined);
    assert.equal(packet.world.buildings, undefined);
  }
  assert.ok(after < before * 0.3, `${after} should be less than 30% of ${before}`);
});

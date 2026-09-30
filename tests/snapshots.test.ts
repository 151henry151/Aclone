// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { DeltaStream, prepareFrame } from '../src/server/snapshots.ts';
import type { Account } from '../src/server/universe.ts';
test('shared delta frames isolate private inventory, messages and scripts, including reconnects', () => {
  const w = createWorld('delta', 'Delta', 'a');
  const a = addPlayer(w, 'a', 'Ada'),
    b = addPlayer(w, 'b', 'Bo');
  a.online = b.online = true;
  a.inventory.gold = 777;
  b.inventory.gold = 888;
  w.script = 'private source';
  w.messages.push({ name: 'Ada', text: 'private message', kind: 'chat', time: 0, to: 'a' } as any);
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
  const as = new DeltaStream(),
    bs = new DeltaStream();
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
  assert.equal(delta.world.players.b, null);
  assert.equal(delta.world.terrain, undefined);
  assert.ok(JSON.parse(new DeltaStream().encode(w, account('a'), prepareFrame(w))).world.terrain);
});

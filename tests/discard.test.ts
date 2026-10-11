// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld } from '../src/shared/simulation.ts';

test('any player can discard only carried goods, with no cash or refund', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'fisher', 'Fisher');
  p.inventory = { fish: 141 };
  const cash = p.cash;
  for (const quantity of [-1, 0, 1.5, 142, Infinity, '1'])
    assert.throws(() => act(w, p.id, { type: 'discard', item: 'fish', quantity }));
  assert.throws(() => act(w, p.id, { type: 'discard', item: '__proto__', quantity: 1 }));
  assert.equal(p.inventory.fish, 141);
  act(w, p.id, { type: 'discard', item: 'fish', quantity: 10 });
  assert.equal(p.inventory.fish, 131);
  assert.equal(p.cash, cash);
});

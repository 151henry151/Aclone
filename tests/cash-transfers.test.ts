// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { stepSchema } from '../src/server/npc/decision.ts';
test('money transfers exceed 100d while goods remain quantities, with affordability and validation intact', () => {
  const w = createWorld('cash', 'Cash', 'server'),
    p = addPlayer(w, 'p', 'P');
  const bank = w.buildings.find((b) => b.kind === 'bank')!,
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.cash = 500000;
  p.bank = 0;
  Object.assign(p, { x: bank.x, z: bank.z });
  act(w, p.id, { type: 'bank', building: bank.id, direction: 'deposit', amount: 250000 });
  assert.equal(p.bank, 250000);
  assert.equal(p.cash, 250000);
  act(w, p.id, { type: 'bank', building: bank.id, direction: 'withdraw', amount: 250000 });
  assert.equal(p.bank, 0);
  assert.equal(p.cash, 500000);
  for (const amount of [-1, 0, 1.1, 10_000_001, NaN, Infinity])
    assert.throws(() =>
      act(w, p.id, { type: 'bank', building: bank.id, direction: 'deposit', amount }),
    );
  assert.throws(() =>
    act(w, p.id, { type: 'bank', building: bank.id, direction: 'deposit', amount: 500001 }),
  );
  mill.owner = p.id;
  mill.investment = 0;
  Object.assign(p, { x: mill.x, z: mill.z });
  act(w, p.id, { type: 'investment', building: mill.id, direction: 'deposit', amount: 250000 });
  act(w, p.id, { type: 'investment', building: mill.id, direction: 'withdraw', amount: 250000 });
  assert.equal(p.cash, 500000);
  assert.equal(mill.investment, 0);
  mill.owner = 'someone';
  mill.sell.flour = 20000;
  mill.stock.flour = 10;
  act(w, p.id, { type: 'trade', building: mill.id, item: 'flour', direction: 'buy', quantity: 2 });
  assert.equal(p.cash, 460000);
  assert.equal(p.inventory.flour, 2, '400d purchase is legal');
});

test('chat/planner cash schemas accept the same larger bank and investment transfers', () => {
  for (const type of ['bank', 'investment'])
    assert.doesNotThrow(() =>
      stepSchema.parse({
        kind: 'act',
        action: { type, building: 'b1', direction: 'deposit', amount: 250000 },
      }),
    );
});

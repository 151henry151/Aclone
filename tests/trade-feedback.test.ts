// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TradeFeedback, type TradeReceipt } from '../src/client/trade-feedback.ts';
const receipt: TradeReceipt = {
  world: 'a',
  building: 'shop',
  item: 'water',
  name: 'Water',
  direction: 'buy',
  quantity: 1,
  total: 775,
  denariiPerSheckle: 100,
};
test('ten individually confirmed purchases total quantity and actual changing prices', () => {
  const feedback = new TradeFeedback();
  for (let i = 0; i < 9; i++) feedback.add(receipt, 0);
  assert.equal(feedback.add({ ...receipt, total: 800 }, 0), 'Bought 10 Water for 77.75d in total.');
  // A failed request has no receipt; late successful replies remain in the original visit.
  assert.match(feedback.add(receipt, 0), /Bought 11 Water/);
});
test('separate shops, items, directions, worlds and visits never combine', () => {
  const feedback = new TradeFeedback();
  feedback.add(receipt, 0);
  for (const change of [
    { building: 'b' },
    { item: 'bread' },
    { direction: 'sell' as const },
    { world: 'b' },
  ])
    assert.match(feedback.add({ ...receipt, ...change }, 0), /(?:Bought|Sold) 1 /);
  assert.match(feedback.add(receipt, 1), /Bought 1 /);
  feedback.clear();
  assert.equal(feedback.summary, '');
});

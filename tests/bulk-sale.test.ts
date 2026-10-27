// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bulkSale } from '../src/client/bulk-sale';
import { createWorld, addPlayer, act } from '../src/shared/simulation';

test('bulk sales respect inventory, per-item storage, working capital and the transaction limit', () => {
  const b = { buy: { fish: 125 }, stock: { fish: 20 }, capacity: 200, investment: 100000 };
  assert.deepEqual(bulkSale(b, 'fish', 50, 125), { quantity: 50, note: '' });
  assert.equal(bulkSale(b, 'fish', 0, 125).quantity, 0);
  assert.equal(bulkSale(b, 'fish', 300, 125).quantity, 180);
  assert.match(bulkSale(b, 'fish', 300, 125).note, /storage.*120 left/);
  b.investment = 125 * 17 + 124;
  assert.equal(bulkSale(b, 'fish', 50, 125).quantity, 17);
  assert.match(bulkSale(b, 'fish', 50, 125).note, /buying funds.*33 left/);
  b.investment = 124;
  assert.equal(bulkSale(b, 'fish', 50, 125).quantity, 0);
  b.investment = 10000000;
  b.capacity = 50000;
  assert.equal(bulkSale(b, 'fish', 20000, 125).quantity, 10000);
  assert.equal(bulkSale(b, 'fish', 50, 126).quantity, 0);
  assert.equal(bulkSale(b, 'missing', 50, 125).quantity, 0);
});

test('a partial bulk sale settles exactly once through the existing authoritative trade', () => {
  const w = createWorld('bulk', 'Bulk', 'owner');
  const b = w.buildings.find((b) => b.kind === 'market')!;
  const p = addPlayer(w, 'seller', 'Seller');
  Object.assign(p, { x: b.x, z: b.z + 12, inventory: { fish: 100 }, cash: 0 });
  b.buy.fish = 125;
  b.stock.fish = 95;
  b.capacity = 100;
  b.investment = 2000;
  const quantity = bulkSale(b, 'fish', p.inventory.fish, 125).quantity;
  act(w, p.id, {
    type: 'trade',
    building: b.id,
    item: 'fish',
    direction: 'sell',
    expectedPrice: 125,
    quantity,
  });
  assert.equal(p.inventory.fish, 95);
  assert.equal(p.cash, 625);
  assert.equal(b.investment, 1375);
  assert.equal(b.stock.fish, 100);
  assert.equal(bulkSale(b, 'fish', p.inventory.fish, 125).quantity, 0);
});

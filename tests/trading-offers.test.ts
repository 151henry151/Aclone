// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { normalizeTradingOffers } from '../src/shared/trading.ts';
import { Store } from '../src/server/store.ts';
function fixture() {
  const w = createWorld('trades', 'Trades', 'owner');
  const owner = addPlayer(w, 'owner', 'Owner'),
    seller = addPlayer(w, 'seller', 'Seller');
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = owner.id;
  b.buy.flour = 5181;
  b.stock.flour = 0;
  b.stock.bread = 10;
  b.investment = 1_000_000;
  owner.x = seller.x = b.x;
  owner.z = seller.z = b.z;
  seller.inventory.flour = 93;
  const admin = (fields: Record<string, unknown>) =>
    act(w, owner.id, {
      type: 'buildingAdmin',
      building: b.id,
      item: 'flour',
      side: 'buy',
      ...fields,
    });
  const sell = (fields: Record<string, unknown> = {}) =>
    act(w, seller.id, {
      type: 'trade',
      building: b.id,
      item: 'flour',
      direction: 'sell',
      quantity: 93,
      ...fields,
    });
  return { w, owner, seller, b, admin, sell };
}
test('pausing purchases refuses delivery, preserves the quote, and survives a database reload', () => {
  const { w, seller, b, admin, sell } = fixture();
  admin({ enabled: false });
  assert.equal(b.buy.flour, undefined);
  assert.equal(b.pausedPrices?.buy?.flour, 5181);
  const before = JSON.stringify(w);
  assert.throws(() => sell(), /does not trade/);
  assert.equal(JSON.stringify(w), before);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world.buildings.find((v) => v.id === b.id)!;
    assert.equal(loaded.buy.flour, undefined);
    assert.equal(loaded.pausedPrices?.buy?.flour, 5181);
  } finally {
    store.close();
  }
  admin({ enabled: true });
  const cash = seller.cash;
  sell({ expectedPrice: 5181 });
  assert.equal(seller.cash - cash, 93 * 5181);
  assert.equal(seller.inventory.flour, 0);
  assert.equal(b.pausedPrices?.buy?.flour, undefined);
});
test('zero legacy bids cannot consume cargo, and become closed offers on migration', () => {
  const { b, sell, seller, admin } = fixture();
  b.buy.flour = 0;
  assert.throws(() => sell(), /does not trade/);
  assert.equal(seller.inventory.flour, 93);
  normalizeTradingOffers(b);
  assert.equal(b.buy.flour, undefined);
  assert.throws(() => admin({ enabled: true }));
  assert.throws(() => admin({ price: 99 }));
  admin({ price: 100 });
  assert.equal(b.buy.flour, 100);
});
test('a changed quote rejects the entire sale without moving goods or money', () => {
  const { w, admin, sell } = fixture();
  admin({ price: 4000 });
  const before = JSON.stringify(w);
  assert.throws(() => sell({ expectedPrice: 5181 }), /price changed/);
  assert.equal(JSON.stringify(w), before);
  sell({ expectedPrice: 4000 });
});
test('sales can be paused independently and visitors cannot edit trading settings', () => {
  const { w, b, seller, admin } = fixture();
  const price = b.sell.bread;
  admin({ item: 'bread', side: 'sell', enabled: false });
  assert.equal(b.sell.bread, undefined);
  assert.equal(b.buy.flour, 5181);
  assert.throws(() =>
    act(w, seller.id, {
      type: 'buildingAdmin',
      building: b.id,
      item: 'bread',
      side: 'sell',
      enabled: true,
    }),
  );
  admin({ item: 'bread', side: 'sell', enabled: true });
  assert.equal(b.sell.bread, price);
});

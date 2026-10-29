// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import {
  bulkDiscounts,
  bulkPurchaseQuote,
  validateBulkDiscounts,
  tradeTotal,
} from '../src/shared/bulk-discounts';
import { bulkDiscountFormValue } from '../src/client/bulk-discounts';
import { tradeQuoteText } from '../src/client/tax-info';
import { salesReceipt } from '../src/shared/taxes';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { Store } from '../src/server/store';
function fixture() {
  const w = createWorld('bulk', 'Bulk', 'owner'),
    owner = addPlayer(w, 'owner', 'Owner'),
    buyer = addPlayer(w, 'buyer', 'Buyer');
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = owner.id;
  b.government = false;
  b.sell.bread = 101;
  b.stock.bread = 1000;
  b.investment = 100000;
  buyer.x = owner.x = b.x;
  buyer.z = owner.z = b.z;
  buyer.cash = 100000;
  buyer.inventory = {};
  const buy = (quantity: number, fields: Record<string, unknown> = {}) =>
    act(w, buyer.id, {
      type: 'trade',
      building: b.id,
      item: 'bread',
      quantity,
      direction: 'buy',
      ...fields,
    });
  const admin = (bulkDiscounts: unknown, id = owner.id) =>
    act(w, id, { type: 'buildingAdmin', building: b.id, bulkDiscounts });
  return { w, b, owner, buyer, buy, admin };
}
test('defaults, boundaries, highest tier and fractional currency rounding', () => {
  const { b } = fixture();
  assert.equal(bulkPurchaseQuote(b, 101, 99).total, 9999);
  assert.deepEqual(bulkPurchaseQuote(b, 101, 100), {
    subtotal: 10100,
    total: 9999,
    percent: 1,
    saving: 101,
  });
  assert.equal(bulkPurchaseQuote(b, 101, 250).percent, 2);
  assert.equal(bulkPurchaseQuote(b, 101, 500).percent, 3);
  b.bulkDiscounts = [{ quantity: 2, percent: 33.33 }];
  assert.equal(bulkPurchaseQuote(b, 1, 2).total, 2);
  b.government = true;
  delete b.bulkDiscounts;
  assert.equal(bulkDiscounts(b).length, 0);
});
test('discounted purchase, taxes, receipts and displayed quote agree; supplier bid is unchanged', () => {
  const { w, b, buyer, buy, admin } = fixture();
  admin([
    { quantity: 20, percent: 10 },
    { quantity: 50, percent: 15 },
  ]);
  const cash = buyer.cash,
    till = b.investment,
    total = 4293;
  const tax = salesReceipt(w, b, total);
  buy(50, { expectedPrice: 101, expectedTotal: total });
  assert.equal(cash - buyer.cash, total);
  assert.equal(b.investment - till, tax.net);
  assert.equal(b.stock.bread, 950);
  assert.equal(buyer.inventory.bread, 50);
  assert.equal(tradeTotal(b, 'bread', 'buy', 50), total);
  assert.match(tradeQuoteText(w, b, 'bread', 'sell', 101, 50), /Bulk discount 15%/);
  b.buy.bread = 100;
  assert.equal(tradeTotal(b, 'bread', 'sell', 50), 5000);
  assert.match(tradeQuoteText(w, b, 'bread', 'buy', 100, 50), /No sales-tax deduction/);
});
test('owner can disable and restore defaults; strangers and malformed tiers cannot mutate state', () => {
  const { w, b, buyer, admin } = fixture();
  admin([]);
  assert.deepEqual(bulkDiscounts(b), []);
  admin(null);
  assert.equal(bulkDiscounts(b).length, 3);
  for (const bad of [
    [{ quantity: 1, percent: 3 }],
    [{ quantity: 10001, percent: 1 }],
    [{ quantity: 5, percent: 101 }],
    [{ quantity: 5, percent: NaN }],
    [{ quantity: 5, percent: 1.234 }],
    [
      { quantity: 5, percent: 5 },
      { quantity: 5, percent: 6 },
    ],
    [
      { quantity: 5, percent: 5 },
      { quantity: 10, percent: 2 },
    ],
    'bad',
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => admin(bad));
    assert.equal(JSON.stringify(w), before);
  }
  assert.throws(() => admin([], buyer.id));
  assert.deepEqual(
    validateBulkDiscounts([
      { quantity: 100, percent: 4 },
      { quantity: 50, percent: 2 },
    ]),
    [
      { quantity: 50, percent: 2 },
      { quantity: 100, percent: 4 },
    ],
  );
});
test('stale discount totals reject atomically and stock/carry/cash limits still apply', () => {
  const { w, b, buyer, buy, admin } = fixture();
  admin([{ quantity: 10, percent: 10 }]);
  let before = JSON.stringify(w);
  assert.throws(() => buy(10, { expectedTotal: 1010 }), /discount changed/);
  assert.equal(JSON.stringify(w), before);
  b.stock.bread = 5;
  before = JSON.stringify(w);
  assert.throws(() => buy(10), /stock/);
  assert.equal(JSON.stringify(w), before);
  b.stock.bread = 1000;
  buyer.cash = 1;
  assert.throws(() => buy(10), /cash/);
  buyer.cash = 100000;
  assert.throws(() => buy(1000), /Cargo/);
});
test('discount policies survive database saves and world-design round trips including opt-out', () => {
  const { w, b, admin } = fixture();
  admin([{ quantity: 25, percent: 2.5 }]);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(
      store.loadWorlds()[0].world.buildings.find((o) => o.id === b.id)!.bulkDiscounts,
      b.bulkDiscounts,
    );
  } finally {
    store.close();
  }
  for (const policy of [[], [{ quantity: 25, percent: 2.5 }]]) {
    b.bulkDiscounts = policy;
    const other = createWorld('copy', 'Copy', 'owner');
    applyDesign(other, exportDesign(w));
    assert.deepEqual(other.buildings.find((o) => o.id === b.id)!.bulkDiscounts, policy);
  }
});
test('editor handles defaults, opt-out, blanks and incomplete levels', () => {
  assert.equal(bulkDiscountFormValue({ bulkMode: 'default' }), null);
  assert.deepEqual(bulkDiscountFormValue({ bulkMode: 'off' }), []);
  assert.deepEqual(
    bulkDiscountFormValue({ bulkMode: 'custom', bulkQuantity0: '100', bulkPercent0: '2.5' }),
    [{ quantity: 100, percent: 2.5 }],
  );
  assert.throws(() => bulkDiscountFormValue({ bulkMode: 'custom', bulkQuantity0: '100' }), /both/);
});

test('large safe currency totals round exactly without overflowing intermediate floating-point precision', () => {
  const { b } = fixture();
  b.bulkDiscounts = [{ quantity: 2, percent: 0.01 }];
  const price = 900719925473;
  const quote = bulkPurchaseQuote(b, price, 1000);
  assert.equal(quote.total, Number((BigInt(price) * 1000n * 9999n + 9999n) / 10000n));
  assert.throws(() => bulkPurchaseQuote(b, Number.MAX_SAFE_INTEGER, 2), /large/);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { salesReceipt, taxFacts } from '../src/shared/taxes.ts';
import { tradeQuoteText } from '../src/client/tax-info.ts';

test('shop tax preview matches cash execution, including fractional transaction rounding', () => {
  const w = createWorld('tax', 'Tax test', 'owner');
  const p = addPlayer(w, 'visitor', 'Visitor');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  const town = w.towns[0];
  b.x = p.x = town.x;
  b.z = p.z = town.z;
  b.owner = 'owner';
  b.stock.flour = 20;
  b.sell.flour = 137;
  b.investment = 100000;
  w.settings.salesTax = 0.05;
  town.salesTax = 0.02;
  const receipt = salesReceipt(w, b, 137 * 3);
  assert.deepEqual(receipt, { gross: 411, worldTax: 20, townTax: 8, tax: 28, net: 383 });
  const cash = p.cash,
    till = b.investment;
  act(w, p.id, { type: 'trade', building: b.id, direction: 'buy', item: 'flour', quantity: 3 });
  assert.equal(cash - p.cash, receipt.gross);
  assert.equal(b.investment - till, receipt.net);
  assert.match(
    tradeQuoteText(w, b, 'flour', 'sell', 137, 3),
    /you pay 4.11d total. Included tax 0.28d/,
  );
  b.buy.flour = 101;
  const beforeSale = p.cash;
  act(w, p.id, { type: 'trade', building: b.id, direction: 'sell', item: 'flour', quantity: 3 });
  assert.equal(p.cash - beforeSale, 303);
  assert.match(
    tradeQuoteText(w, b, 'flour', 'buy', 101, 3),
    /you receive 3.03d. No sales-tax deduction/,
  );
});

test('public facts reflect live local rates and cap combined deductions', () => {
  const w = createWorld('tax', 'Tax test', 'owner');
  const town = w.towns[0];
  w.settings.salesTax = 0.8;
  town.salesTax = 0.7;
  assert.equal(salesReceipt(w, town, 10000).net, 0);
  const facts = taxFacts(w, town);
  assert.equal(facts.atCurrentLocation.sales, 1);
  assert.equal(facts.towns[0].salesTax, 0.7);
  assert.match(facts.shopPurchases, /INCLUDED/);
  assert.match(facts.access, /World\/F9/);
  assert.match(tradeQuoteText(w, w.buildings[0], 'flour', 'sell', 100, 0), /whole quantity/);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { propertyQuote, migrateEstates, PROPERTY_YEAR } from '../src/shared/property.ts';
import { items } from '../src/shared/catalog.ts';
test('Puddlewick death retains stock/capital and transfers them for a live equity-adjusted price', () => {
  const w = createWorld('puddlewick', 'Town', 'server');
  const p = addPlayer(w, 'p', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.stock = { wheat: 12 };
  b.investment = 20000;
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(b.owner, undefined);
  assert.equal(b.stock.wheat, 12);
  assert.equal(b.investment, 20000);
  const q = propertyQuote(w, b);
  assert.equal(q.premium, Math.round((12 * items.wheat.price + 20000) * 0.9));
  const buyer = addPlayer(w, 'buyer', 'Buyer');
  buyer.x = b.x;
  buyer.z = b.z;
  buyer.cash = q.total + 10000;
  act(w, buyer.id, { type: 'buyBuilding', building: b.id });
  assert.equal(buyer.cash, 10000);
  assert.equal(b.owner, buyer.id);
  assert.equal(b.investment, 20000);
  assert.equal(b.stock.wheat, 12);
  assert.equal(b.estate, undefined);
});
test('estate prices compound down yearly and follow current equity, not editable quotes', () => {
  const w = createWorld('puddlewick', 'Town', 'server');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.stock = { flour: 30 };
  b.investment = 20000;
  const initial = propertyQuote(w, b);
  w.time = PROPERTY_YEAR;
  assert.equal(propertyQuote(w, b).total, Math.round(initial.total * 0.95));
  w.time = PROPERTY_YEAR * 2;
  assert.equal(propertyQuote(w, b).total, Math.round(initial.total * 0.95 ** 2));
  b.sell.flour = 1;
  assert.equal(propertyQuote(w, b).total, Math.round(initial.total * 0.95 ** 2));
  const buyer = addPlayer(w, 'buyer', 'Buyer');
  buyer.x = b.x;
  buyer.z = b.z;
  act(w, buyer.id, {
    type: 'trade',
    building: b.id,
    direction: 'buy',
    item: 'flour',
    quantity: 10,
  });
  assert.ok(propertyQuote(w, b).total < Math.round(initial.total * 0.95 ** 2));
  assert.equal(b.stock.flour, 20);
  assert.equal(b.investment, 20010);
});
test('worlds can clear estates or preserve without a premium; migrations respect later customization', () => {
  const w = createWorld('custom', 'Custom', 'owner');
  const p = addPlayer(w, 'p', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.stock = { wheat: 12 };
  b.investment = 20000;
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.deepEqual(b.stock, {});
  assert.equal(b.investment, 0);
  w.settings.retainEstateContents = true;
  w.settings.estateEquityShare = 0;
  b.owner = p.id;
  b.stock = { wheat: 12 };
  b.investment = 20000;
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.equal(propertyQuote(w, b).total, b.estate!.base);
  assert.equal(b.stock.wheat, 12);
  const parish = createWorld('puddlewick', 'Town', 'server');
  parish.settings.retainEstateContents = false;
  migrateEstates(parish);
  assert.equal(parish.settings.retainEstateContents, false);
});

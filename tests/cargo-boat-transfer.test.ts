// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightSetup } from './cargo-boat-hold.test';
import { act, advance, makeBuilding } from '../src/shared/simulation';
import { stockWeight } from '../src/shared/fishing-expedition';
function transfer(w: any, p: any, operation: string, more: any = {}) {
  return act(w, p.id, {
    type: 'boatHold',
    operation,
    slot: 35,
    item: 'stone',
    quantity: 10,
    ...more,
  });
}
test('timed hold transfers conserve stock, enforce all dry-goods and weight limits and cancel cleanly', () => {
  const { w, p, d } = freightSetup();
  p.inventory = { stone: 10 };
  transfer(w, p, 'load');
  assert.equal(p.task?.kind, 'freight');
  assert.equal(p.task!.end - w.time, 2);
  advance(w, 1);
  assert.equal(p.inventory.stone, 10);
  assert.equal(p.boatHold?.stone, undefined);
  advance(w, 1);
  assert.equal(p.inventory.stone, 0);
  assert.equal(p.boatHold?.stone, 10);
  advance(w, 2);
  assert.equal(p.boatHold?.stone, 10);
  transfer(w, p, 'unload');
  transfer(w, p, 'cancel');
  advance(w, 3);
  assert.equal(p.boatHold?.stone, 10);
  p.boatHold = { stone: 1000 };
  p.inventory = { stone: 1, water: 1, fish: 1, cows: 1 };
  for (const item of ['stone', 'water', 'fish', 'cows'])
    assert.throws(() => transfer(w, p, 'load', { item, quantity: 1 }), /full|unsuitable/i);
  assert.equal(stockWeight(w, p.boatHold), 2000);
  p.boatHold = {};
  p.inventory = { stone: 10 };
  p.speed = 1;
  assert.throws(() => transfer(w, p, 'load'), /stop/i);
  p.speed = 0;
  p.x += 500;
  assert.throws(() => transfer(w, p, 'load'), /landing|dock|berth/i);
  Object.assign(p, d.berth);
  for (const quantity of [-1, 0, 0.5, NaN, Infinity, 10001])
    assert.throws(() => transfer(w, p, 'load', { quantity }));
  transfer(w, p, 'load');
  p.inventory.stone = 0;
  advance(w, 3);
  assert.equal(p.boatHold.stone, undefined);
  assert.equal(p.task, undefined);
});
test('saved moored holds transfer with owned stockrooms and cannot be handled remotely or by someone else', () => {
  const { w, p, d } = freightSetup();
  p.boatHold = { stone: 50 };
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  const shop = d.building!;
  shop.owner = p.id;
  shop.stock = { stone: 20 };
  shop.capacity = 1000;
  transfer(w, p, 'load', { building: shop.id });
  advance(w, 3);
  assert.equal(w.mooredBoats![p.id + ':35'].cargo?.stone, 60);
  assert.equal(shop.stock.stone, 10);
  shop.owner = 'other';
  assert.throws(() => transfer(w, p, 'unload', { building: shop.id }), /own/i);
  p.x += 500;
  assert.throws(() => transfer(w, p, 'unload'), /landing|dock|berth/i);
});
test('hold shop purchases and sales are timed, funded and respect changed world rules', () => {
  const { w, p, d } = freightSetup();
  const shop = d.building!;
  shop.owner = 'merchant';
  shop.stock = { stone: 100 };
  shop.sell = { stone: 600 };
  shop.buy = { stone: 700 };
  shop.investment = 1000000;
  (w.settings as any).freightTransferRate = 20;
  const cash = p.cash,
    stock = shop.stock.stone;
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    storage: 'hold',
    slot: 35,
    direction: 'buy',
    item: 'stone',
    quantity: 10,
  });
  assert.equal(p.task!.end - w.time, 1);
  assert.equal(p.cash, cash);
  advance(w, 1);
  assert.equal(p.boatHold?.stone, 10);
  assert.equal(p.cash, cash - 6000);
  assert.equal(shop.stock.stone, stock - 10);
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    storage: 'hold',
    slot: 35,
    direction: 'sell',
    item: 'stone',
    quantity: 10,
  });
  advance(w, 1);
  assert.equal(p.boatHold?.stone, 0);
  assert.equal(p.cash, cash + 1000);
  shop.stock = {};
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: shop.id,
        storage: 'hold',
        slot: 35,
        direction: 'buy',
        item: 'stone',
        quantity: 1,
      }),
    /stock/i,
  );
  shop.stock = { stone: 100 };
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    storage: 'hold',
    slot: 35,
    direction: 'buy',
    item: 'stone',
    quantity: 10,
  });
  shop.sell.stone = 900;
  advance(w, 1);
  assert.equal(p.boatHold?.stone, 0);
  const far = makeBuilding('far', 'market', d.land.x + 31, d.land.z);
  far.stock = { stone: 10 };
  far.sell = { stone: 600 };
  w.buildings.push(far);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: far.id,
        storage: 'hold',
        slot: 35,
        direction: 'buy',
        item: 'stone',
        quantity: 1,
      }),
    /range|reach/i,
  );
  (w.settings as any).freightShopRange = 40;
  act(w, p.id, {
    type: 'trade',
    building: far.id,
    storage: 'hold',
    slot: 35,
    direction: 'buy',
    item: 'stone',
    quantity: 1,
  });
  advance(w, 1);
  assert.equal(p.boatHold?.stone, 1);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { restorePublicPuddlewick, governmentStores } from '../src/server/government-stores.ts';
import { emergencyImport, availableSupply } from '../src/shared/harbour-supply.ts';
import { Store } from '../src/server/store.ts';
import { Navigator } from '../src/server/npc/navigation.ts';
import { createApp } from '../src/server/app.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('restore starter government once without altering player property or other worlds', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'hank');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(b, { owner: 'hank', investment: 32100, stock: { wheat: 12 }, wage: 1000 });
  const before = structuredClone(w.buildings);
  assert.equal(restorePublicPuddlewick(w), true);
  assert.equal(w.owner, 'server');
  assert.deepEqual(w.buildings, before);
  assert.equal(restorePublicPuddlewick(w), false);
  for (const custom of [
    createWorld('custom', 'Puddlewick', 'hank'),
    createWorld('otherwick', 'Custom', 'hank'),
  ]) {
    assert.equal(restorePublicPuddlewick(custom), false);
    assert.equal(custom.owner, 'hank');
    assert.equal(governmentStores(custom), false);
  }
});

test('premium government food and water remain available without stock or treasury funding', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'buyer', 'Buyer');
  for (const b of w.buildings) b.stock = {};
  assert.equal(governmentStores(w), true);
  const b = w.buildings.find((b) => b.id === 'parish-government-stores')!;
  assert.doesNotThrow(() => new Navigator(w, p, b, 12));
  assert.equal(governmentStores(w), false);
  const harbour = w.buildings.find((b) => b.id === 'b0')!;
  assert.equal(emergencyImport(w, harbour, 'water'), false);
  p.x = b.x;
  p.z = b.z;
  p.cash = 100000;
  for (const item of ['water', 'bread']) {
    assert.ok(b.sell[item] > harbour.sell[item]);
    assert.ok(availableSupply(w, b, item) > 0);
    const before = p.cash;
    b.investment = 0;
    act(w, p.id, { type: 'trade', building: b.id, item, quantity: 2, direction: 'buy' });
    assert.equal(p.cash, before - b.sell[item] * 2);
    assert.equal(b.stock[item], 0);
    assert.ok(b.investment >= 0);
  }
  p.cash = 0;
  assert.throws(
    () =>
      act(w, p.id, { type: 'trade', building: b.id, item: 'water', quantity: 1, direction: 'buy' }),
    /cash/,
  );
  assert.equal(emergencyImport(w, b, 'fuel'), false);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const saved = loaded.buildings.find((s) => s.id === b.id)!;
    assert.deepEqual(saved.buy, {});
    assert.deepEqual(Object.keys(saved.sell).sort(), ['bread', 'water']);
    assert.ok(emergencyImport(loaded, saved, 'water'));
  } finally {
    store.close();
  }
});

test('a player-owned public Puddlewick still sells government bread and water from an empty shelf', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(governmentStores(w), true);
  w.owner = 'hank';
  const shop = w.buildings.find((b) => b.id === 'parish-government-stores')!;
  shop.stock = {};
  shop.investment = 0;
  const p = addPlayer(w, 'visitor', 'Visitor');
  p.x = shop.x;
  p.z = shop.z;
  p.cash = 200000;
  p.inventory = {};
  act(w, p.id, { type: 'trade', building: shop.id, item: 'water', quantity: 2, direction: 'buy' });
  act(w, p.id, { type: 'trade', building: shop.id, item: 'bread', quantity: 1, direction: 'buy' });
  assert.equal(p.inventory.water, 2);
  assert.equal(p.inventory.bread, 1);
  assert.ok(emergencyImport(w, shop, 'water'));
  assert.ok(emergencyImport(w, shop, 'bread'));
});

test('Government necessities restocks bread and water after the shelf is emptied', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'hank');
  assert.equal(governmentStores(w), true);
  const shop = w.buildings.find((b) => b.id === 'parish-government-stores')!;
  shop.stock = { bread: 0, water: 0 };
  shop.investment = 0;
  advance(w, 1);
  assert.ok((shop.stock.water ?? 0) >= 24);
  assert.ok((shop.stock.bread ?? 0) >= 24);
  const visitor = addPlayer(w, 'buyer', 'Buyer');
  visitor.x = shop.x;
  visitor.z = shop.z;
  visitor.cash = 500000;
  act(w, visitor.id, {
    type: 'trade',
    building: shop.id,
    item: 'water',
    quantity: shop.stock.water,
    direction: 'buy',
  });
  act(w, visitor.id, {
    type: 'trade',
    building: shop.id,
    item: 'bread',
    quantity: shop.stock.bread,
    direction: 'buy',
  });
  assert.equal(shop.stock.water, 0);
  assert.equal(shop.stock.bread, 0);
  advance(w, 1);
  assert.ok((shop.stock.water ?? 0) >= 24);
  assert.ok((shop.stock.bread ?? 0) >= 24);
});

test('server startup persists the ownership repair and one shop without resetting the mill', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'aclone-government-'));
  const store = new Store(join(dataDir, 'aclone.sqlite'));
  const w = createWorld('puddlewick', 'Puddlewick', 'hank');
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  Object.assign(mill, { owner: 'hank', wage: 1000, investment: 32100, stock: { wheat: 12 } });
  store.saveWorld(w, Date.now() / 1000);
  store.close();
  const app = await createApp({ dataDir, port: 0, dev: false });
  try {
    const saved = app.store.loadWorlds()[0].world;
    assert.equal(saved.owner, 'server');
    assert.equal(saved.publicParishVersion, 1);
    assert.equal(saved.buildings.filter((b) => b.id === 'parish-government-stores').length, 1);
    const kept = saved.buildings.find((b) => b.id === mill.id)!;
    assert.equal(kept.owner, 'hank');
    assert.equal(kept.wage, 1000);
    assert.equal(kept.investment, 32100);
    assert.deepEqual(kept.stock, { wheat: 12 });
  } finally {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  }
});

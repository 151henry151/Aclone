// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import {
  governmentPremium,
  restockGovernmentStores,
  emergencyImport,
} from '../src/shared/harbour-supply';
import { economyRules } from '../src/shared/economy-rules';
import { Store } from '../src/server/store';
const defaults = {
  governmentImportPremium: 25,
  governmentWaterFloor: 1000,
  governmentBreadFloor: 10000,
  governmentFuelFloor: 4500,
  governmentImportBidMargin: 100,
};
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const shop = makeBuilding('parish-government-stores', 'market', 0, 0),
    port = makeBuilding('public', 'market', 100, 0),
    privateShop = makeBuilding('private', 'market', 200, 0);
  Object.assign(shop, {
    government: true,
    owner: 'treasury',
    sell: { water: 1000, bread: 10000, fuel: 10000 },
    buy: {},
    stock: {},
    investment: 0,
  });
  Object.assign(port, {
    government: true,
    owner: 'treasury',
    sell: { water: 1000, bread: 2000, fuel: 3000 },
    buy: { water: 100, bread: 200, fuel: 300 },
  });
  Object.assign(privateShop, {
    government: false,
    owner: 'other',
    sell: { water: 9000, bread: 9000, fuel: 8000 },
    buy: {},
  });
  w.buildings = [shop, port, privateShop];
  p.x = p.z = 0;
  p.cash = 100000;
  p.inventory = {};
  w.settings.salesTax = 0;
  w.towns = [];
  return { w, p, shop, port, privateShop };
}
test('import premium defaults reproduce quotes and supply missing saved fields', () => {
  const { w, shop } = setup();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  for (const [key, value] of Object.entries(defaults))
    assert.equal((economyRules(w.settings) as any)[key], value);
  assert.equal(governmentPremium(w, shop, 'water'), 1250);
  assert.equal(governmentPremium(w, shop, 'bread'), 10000);
  assert.equal(governmentPremium(w, shop, 'fuel'), 10000);
});
test('premium rule edits republish only government necessities with each formula bound honoured', () => {
  const { w, p, shop, port, privateShop } = setup();
  const others = structuredClone([port, privateShop]),
    stock = structuredClone(shop.stock);
  act(w, p.id, {
    type: 'settings',
    patch: {
      governmentImportPremium: 50,
      governmentWaterFloor: 0,
      governmentBreadFloor: 0,
      governmentFuelFloor: 0,
      governmentImportBidMargin: 1,
    },
  });
  assert.deepEqual(shop.sell, { water: 1500, bread: 3000, fuel: 12000 });
  assert.deepEqual([port, privateShop], others);
  assert.deepEqual(shop.stock, stock);
  assert.equal(shop.investment, 0);
  act(w, p.id, {
    type: 'settings',
    patch: { governmentWaterFloor: 7000, governmentBreadFloor: 8000, governmentFuelFloor: 13000 },
  });
  assert.deepEqual(shop.sell, { water: 7000, bread: 8000, fuel: 13000 });
  act(w, p.id, {
    type: 'settings',
    patch: {
      governmentImportPremium: 0,
      governmentWaterFloor: 0,
      governmentBreadFloor: 0,
      governmentFuelFloor: 0,
      governmentImportBidMargin: 20000,
    },
  });
  assert.deepEqual(shop.sell, { water: 20100, bread: 20200, fuel: 20300 });
});
test('empty-shelf purchases use changed premiums and preserve import accounting/cash failures', () => {
  const { w, p, shop, port } = setup();
  act(w, p.id, { type: 'settings', patch: { governmentImportPremium: 50 } });
  assert.ok(emergencyImport(w, shop, 'fuel'));
  const price = shop.sell.fuel;
  assert.ok(price > port.buy.fuel);
  act(w, p.id, { type: 'trade', building: shop.id, item: 'fuel', direction: 'buy', quantity: 1 });
  assert.equal(p.cash, 100000 - price);
  assert.equal(p.inventory.fuel, 1);
  assert.equal(shop.stock.fuel, 0);
  assert.equal(shop.investment, price - Math.floor(price * 0.8));
  p.cash = 0;
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: shop.id,
        item: 'fuel',
        direction: 'buy',
        quantity: 1,
      }),
    /cash/,
  );
  assert.equal(JSON.stringify(w), before);
});
test('unchanged/unrelated settings and reload retain food quotes while fuel uses live premiums', () => {
  const { w, p, shop, privateShop } = setup();
  shop.sell.bread = 12345;
  shop.sell.water = 2345;
  act(w, p.id, { type: 'settings', patch: { governmentImportPremium: 25 } });
  act(w, p.id, { type: 'settings', patch: { mapPrintPrice: 123 } });
  restockGovernmentStores(w);
  assert.equal(shop.sell.bread, 12345);
  assert.equal(shop.sell.water, 2345);
  privateShop.sell.fuel = 10000;
  restockGovernmentStores(w);
  assert.equal(shop.sell.fuel, 12500);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      b = loaded.buildings.find((b) => b.id === shop.id)!;
    assert.equal(b.sell.bread, 12345);
    assert.equal(b.sell.water, 2345);
  } finally {
    store.close();
  }
});
test('private/emergency lookalike shops and other worlds are never repriced', () => {
  for (const change of ['private', 'custom', 'construction']) {
    const { w, p, shop } = setup();
    if (change === 'private') shop.owner = p.id;
    if (change === 'custom') w.id = 'custom';
    if (change === 'construction') shop.construction = { remaining: { wood: 1 } } as any;
    const before = structuredClone(shop);
    act(w, p.id, { type: 'settings', patch: { governmentImportPremium: 50 } });
    assert.deepEqual(shop, before);
  }
});
test('premium rules validate atomically and appear in creation/summary and portable designs', async () => {
  const { w, p } = setup();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { governmentImportPremium: -1 },
    { governmentImportPremium: 501 },
    { governmentWaterFloor: 1.5 },
    { governmentImportBidMargin: 0 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.equal(JSON.stringify(w), before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: {
      governmentImportPremium: 37,
      governmentWaterFloor: 1234,
      governmentBreadFloor: 5678,
      governmentFuelFloor: 9012,
      governmentImportBidMargin: 321,
    },
  });
  for (const value of ['37%', '1234', '5678', '9012', '321'])
    assert.ok(rulesSummary(w).includes(value));
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  for (const key of Object.keys(defaults))
    assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
});

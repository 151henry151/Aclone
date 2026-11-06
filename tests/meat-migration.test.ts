// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act } from '../src/shared/simulation';
import { Store } from '../src/server/store';
import { items } from '../src/shared/catalog';
test('the one-time meat migration adds missing listings but preserves operator prices, paused quotes, stock and adult herds', () => {
  const w = createWorld('meat-old-save', 'Old save', 'owner');
  delete w.meatVersion; // Model a save made before the meat catalogue existed.
  const market = makeBuilding('market', 'market', 0, 0);
  market.owner = 'operator';
  market.buy = { beef: 17 };
  market.sell = { calves: 99, steak: 4000 };
  market.pausedPrices = { buy: { pork: 20 }, sell: { muttonPie: 25 } };
  market.stock = { cows: 4, calves: 1, steak: 8 };
  const farm = makeBuilding('farm', 'dairy', 30, 0);
  farm.stock = { cows: 4, milk: 12 };
  w.buildings = [market, farm];
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const shop = loaded.buildings[0];
    assert.equal(shop.buy.beef, 17);
    assert.equal(shop.buy.pork, undefined);
    assert.equal(shop.sell.muttonPie, undefined);
    assert.equal(shop.sell.calves, 99);
    assert.equal(shop.sell.steak, 4000);
    assert.deepEqual(shop.stock, market.stock);
    assert.deepEqual(loaded.buildings[1].stock, farm.stock);
    assert.ok(shop.sell.beefStew > 0);
    assert.ok(shop.buy.lambs > 0);
    assert.ok(items.steak.food! > 0);
    delete shop.sell.beefStew;
    store.saveWorld(loaded);
    assert.equal(store.loadWorlds()[0].world.buildings[0].sell.beefStew, undefined);
  } finally {
    store.close();
  }
});
test('butcher fees, selected menus and validated rules remain portable world-builder choices', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { settingsFields } = await import('../src/client/creator-editor');
  const w = createWorld('meat-design', 'Meat design', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('butcher', 'butcher', 0, 0);
  b.slaughterFees = { cows: 1234, chickens: 0 };
  b.recipe = 'butcher_pigs';
  const k = makeBuilding('kitchen', 'kitchen', 30, 0);
  k.recipe = 'meat_muttonPie';
  w.buildings = [b, k];
  const before = structuredClone(w.settings);
  assert.throws(() =>
    act(w, p.id, { type: 'settings', patch: { porkYield: 15, homeCookingYield: 0 } }),
  );
  assert.deepEqual(w.settings, before);
  act(w, p.id, {
    type: 'settings',
    patch: {
      porkYield: 15,
      homeCookingYield: 2,
      rawMeatSpoilageDays: 3,
      slaughterFeeFraction: 0.25,
    },
  });
  const dest = createWorld('meat-recipient', 'Meat recipient', 'recipient');
  applyDesign(dest, exportDesign(w));
  assert.deepEqual(dest.buildings[0].slaughterFees, b.slaughterFees);
  assert.equal(dest.buildings[0].recipe, 'butcher_pigs');
  assert.equal(dest.buildings[1].recipe, 'meat_muttonPie');
  assert.equal(dest.settings.porkYield, 15);
  assert.equal(dest.settings.homeCookingYield, 2);
  for (const field of ['porkYield', 'homeCookingYield', 'rawMeatSpoilageDays', 'butchersEnabled'])
    assert.ok(settingsFields().includes(`name="${field}"`));
});

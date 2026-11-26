// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { integrateTurkeys } from '../src/shared/turkey-migration';
import { items, buildings } from '../src/shared/catalog';
import { cargoAccepts } from '../src/shared/cargo-policy';
import { butcherRamp } from '../src/shared/butcher';
import { meatMenus } from '../src/shared/meat-recipes';
import { Store } from '../src/server/store';
import { exportDesign, applyDesign } from '../src/server/world-design';

test('old saves get missing turkey listings and a finite public founding flock without overwriting operators', () => {
  const w = createWorld('old-turkey', 'Old world', 'owner');
  delete w.turkeyVersion;
  const market = makeBuilding('public', 'market', 0, 0);
  Object.assign(market, {
    owner: 'treasury',
    government: true,
    stock: { bread: 2 },
    buy: {},
    sell: {},
  });
  const privateShop = makeBuilding('private', 'pub', 30, 0);
  Object.assign(privateShop, {
    owner: 'owner',
    stock: { bread: 7 },
    buy: { turkeyMeat: 12 },
    sell: {},
    pausedPrices: { sell: { turkeyDinner: 40 } },
  });
  const depleted = makeBuilding('depleted', 'starport', 60, 0);
  Object.assign(depleted, { owner: 'treasury', government: true, stock: { turkeys: 0 } });
  const full = makeBuilding('full', 'market', 90, 0);
  Object.assign(full, {
    owner: 'treasury',
    government: true,
    stock: { bread: full.capacity / items.bread.weight },
  });
  const custom = makeBuilding('custom', 'market', 120, 0);
  Object.assign(custom, { templateId: 'custom-market', stock: {}, buy: {}, sell: {} });
  w.buildings = [market, privateShop, depleted, full, custom];
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const [publicPort, pub, empty, packed, template] = loaded.buildings;
    assert.equal(publicPort.stock.turkeys, 12);
    assert.equal(publicPort.sell.turkeys, buildings.market.sell.turkeys);
    assert.equal(pub.buy.turkeyMeat, 12);
    assert.equal(pub.sell.turkeyDinner, undefined);
    assert.ok(pub.sell.turkeyPie > 0);
    assert.deepEqual(pub.stock, { bread: 7 });
    assert.equal(empty.stock.turkeys, 0);
    assert.equal(packed.stock.turkeys, 0);
    assert.deepEqual(template.sell, {});
    publicPort.stock.turkeys = 0;
    delete pub.sell.turkeyPie;
    assert.equal(integrateTurkeys(loaded), false);
    store.saveWorld(loaded);
    const again = store.loadWorlds()[0].world;
    assert.equal(again.buildings[0].stock.turkeys, 0);
    assert.equal(again.buildings[1].sell.turkeyPie, undefined);
  } finally {
    store.close();
  }
});

test('turkeys and poults need livestock transport, adult slaughter returns fresh turkey and young stay protected', () => {
  const w = createWorld('turkey-service', 'Turkey service', 'owner');
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, activeWork: false });
  w.zones = [];
  w.towns = [];
  const p = addPlayer(w, 'owner', 'Keeper');
  const b = makeBuilding('butcher', 'butcher', 0, 0),
    ramp = butcherRamp(b);
  Object.assign(p, ramp, { vehicle: 0, cash: 100000, inventory: {} });
  const worker = addPlayer(w, 'worker', 'Butcher');
  Object.assign(worker, { skills: ['butcher'], job: b.id, activeUntil: 100000 });
  b.employees = [worker.id];
  w.buildings = [b];
  const wagon = {
    id: 'wagon',
    owner: p.id,
    kind: 'livestock' as const,
    ...ramp,
    heading: 0,
    cargo: { turkeys: 1, poults: 1 } as Record<string, number>,
    attached: p.id,
  };
  w.trailers = { wagon };
  for (const item of ['turkeys', 'poults']) {
    assert.equal(cargoAccepts(w, { kind: 'box', cargo: {} }, 240, item, 1), false);
    assert.equal(cargoAccepts(w, wagon, 240, item, 1), true);
  }
  assert.equal(cargoAccepts(w, { kind: 'livestock', cargo: {} }, 240, 'turkeys', 61), false);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'butcher',
        building: b.id,
        operation: 'slaughter',
        item: 'poults',
        quantity: 1,
        storage: 'trailer',
        trailer: wagon.id,
      }),
    /matur/i,
  );
  act(w, p.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'turkeys',
    quantity: 1,
    storage: 'trailer',
    trailer: wagon.id,
  });
  assert.equal(wagon.cargo.turkeys, 1);
  advance(w, p.task!.end - w.time);
  assert.equal(wagon.cargo.turkeys ?? 0, 0);
  assert.equal(wagon.cargo.poults, 1);
  assert.equal(wagon.cargo.turkeyMeat, 3);
  assert.equal(cargoAccepts(w, { kind: 'fish', cargo: {} }, 240, 'turkeyMeat', 3), true);
  advance(w, w.settings.rawMeatSpoilageDays! * w.settings.dayLength);
  assert.equal(wagon.cargo.turkeyMeat ?? 0, 0, 'unchilled meat spoils');
});

test('all turkey dishes cook from real ingredients at home and nourish the player', () => {
  for (const menu of ['turkeyDinner', 'turkeyPie', 'turkeySoup']) {
    const w = createWorld(menu, menu, 'owner');
    Object.assign(w.settings, { hungerRate: 0, thirstRate: 0 });
    const p = addPlayer(w, 'owner', 'Cook');
    Object.assign(p, { x: 0, z: 0, vehicle: 5, inventory: { turkeyMeat: 1 } });
    const home = makeBuilding('home', 'home', 0, 0);
    home.owner = p.id;
    home.stock = { ...meatMenus[menu].inputs };
    w.buildings = [home];
    assert.throws(
      () => act(w, p.id, { type: 'use', item: 'turkeyMeat' }),
      /Raw meat must be cooked/,
    );
    act(w, p.id, { type: 'home', building: home.id });
    act(w, p.id, { type: 'cook', menu });
    advance(w, p.task!.end - w.time);
    assert.equal(home.stock[menu], 1);
    for (const id of Object.keys(meatMenus[menu].inputs)) assert.equal(home.stock[id] ?? 0, 0);
    act(w, p.id, {
      type: 'stock',
      building: home.id,
      item: menu,
      direction: 'withdraw',
      quantity: 1,
    });
    p.hunger = 60000;
    act(w, p.id, { type: 'use', item: menu });
    assert.equal(p.hunger, 60000 - items[menu].food!);
  }
});

test('saved freshness and world-design poult ages, turkey fees, recipes and rules survive round trips', () => {
  const w = createWorld('turkey-design', 'Turkey design', 'owner');
  const b = makeBuilding('farm', 'turkeyFarm', 0, 0);
  b.stock = { turkeys: 2, poults: 1 };
  b.young = [{ item: 'poults', count: 1, born: 0, grownDays: 3 }];
  const butcher = makeBuilding('butcher', 'butcher', 40, 0);
  butcher.slaughterFees = { turkeys: 1200 };
  butcher.recipe = 'butcher_turkeys';
  const restaurant = makeBuilding('restaurant', 'kitchen', 80, 0);
  restaurant.recipe = 'meat_turkeyDinner';
  restaurant.stock = { turkeyMeat: 2 };
  restaurant.meat = [{ item: 'turkeyMeat', count: 2, agedDays: 0.5, checkedAt: w.time }];
  w.buildings = [b, butcher, restaurant];
  Object.assign(w.settings, { turkeyYield: 5, turkeyBreedingMinimum: 3, poultMaturityDays: 10 });
  const dest = createWorld('turkey-import', 'Turkey import', 'recipient');
  applyDesign(dest, exportDesign(w));
  assert.deepEqual(dest.buildings[0].young, [{ ...b.young![0], careSince: dest.time }]);
  assert.equal(dest.buildings[0].kind, 'turkeyFarm');
  assert.deepEqual(dest.buildings[1].slaughterFees, { turkeys: 1200 });
  assert.equal(dest.buildings[1].recipe, 'butcher_turkeys');
  assert.equal(dest.buildings[2].recipe, 'meat_turkeyDinner');
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.buildings[2].meat, restaurant.meat);
  } finally {
    store.close();
  }
  assert.equal(dest.settings.turkeyYield, 5);
  assert.equal(dest.settings.poultMaturityDays, 10);
});

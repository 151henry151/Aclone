// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { feedShelterNow } from '../src/shared/nutrition';
import { Store } from '../src/server/store';
import { recipes, items, buildings, defaults } from '../src/shared/catalog';
function kitchen() {
  const w = createWorld('meat-kitchen', 'Meat kitchen', 'owner');
  w.buildings = [];
  w.zones = [];
  w.towns = [];
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, activeWork: false });
  const p = addPlayer(w, 'owner', 'Cook');
  Object.assign(p, { x: 0, z: 0, vehicle: 5, inventory: {}, cash: 100000 });
  const home = makeBuilding('home', 'home', 0, 0);
  home.owner = p.id;
  home.stock = {};
  w.buildings = [home];
  p.home = home.id;
  return { w, p, home };
}
test('raw meat is refused manually and ignored automatically unless the world explicitly allows it', () => {
  const { w, p } = kitchen();
  p.inventory = { beef: 2, steak: 1 };
  p.hunger = 60000;
  assert.throws(() => act(w, p.id, { type: 'use', item: 'beef' }), /Raw meat must be cooked/);
  feedShelterNow(w, p, { beef: 1 });
  assert.equal(p.hunger, 60000);
  act(w, p.id, { type: 'use', item: 'steak' });
  assert.ok(p.hunger < 60000, 'existing cooked Steak remains edible');
  Object.assign(w.settings, { rawMeatEdible: true, rawMeatFood: 18000 });
  p.hunger = 60000;
  act(w, p.id, { type: 'use', item: 'beef' });
  assert.equal(p.hunger, 42000);
  const stock = { beef: 1 };
  p.hunger = 60000;
  feedShelterNow(w, p, stock);
  assert.equal(stock.beef, 0);
  assert.equal(p.hunger, 42000);
});
test('mixed raw-meat batches keep their ages through chilled storage, transfers and a saved reload', () => {
  const { w, p, home } = kitchen();
  home.stock.beef = 1;
  advance(w, 600);
  const cold = makeBuilding('cold', 'kitchen', 0, 0);
  cold.owner = p.id;
  cold.stock = { beef: 1 };
  cold.employees = [];
  w.buildings.push(cold);
  act(w, p.id, {
    type: 'stock',
    building: home.id,
    item: 'beef',
    direction: 'withdraw',
    quantity: 1,
  });
  act(w, p.id, {
    type: 'stock',
    building: cold.id,
    item: 'beef',
    direction: 'deposit',
    quantity: 1,
  });
  advance(w, 1800);
  assert.equal(cold.stock.beef, 2, 'cold storage pauses freshness');
  act(w, p.id, {
    type: 'stock',
    building: cold.id,
    item: 'beef',
    direction: 'withdraw',
    quantity: 2,
  });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    advance(loaded, 599);
    assert.equal(loaded.players[p.id].inventory.beef, 2);
    advance(loaded, 1);
    assert.equal(loaded.players[p.id].inventory.beef, 1, 'only the day-old portion expires');
    advance(loaded, 600);
    assert.equal(loaded.players[p.id].inventory.beef ?? 0, 0);
  } finally {
    store.close();
  }
});
test('a chilled trailer preserves raw meat while an ordinary livestock wagon does not', () => {
  const { w, p } = kitchen();
  w.trailers = Object.fromEntries(
    ['fish', 'livestock'].map((kind) => [
      kind,
      {
        id: kind,
        owner: p.id,
        kind: kind as 'fish' | 'livestock',
        x: 0,
        z: 0,
        heading: 0,
        cargo: { pork: 2 },
      },
    ]),
  );
  advance(w, 1200);
  assert.equal(w.trailers.fish.cargo.pork, 2);
  assert.equal(w.trailers.livestock.cargo.pork ?? 0, 0);
});
test('every meat menu pays its inputs and cooks, beats hearty nutrition, and serves faster than home cooking', () => {
  for (const item of [
    'beefStew',
    'porkSupper',
    'muttonPie',
    'roastChicken',
    'meatBreakfast',
    'pubMeatPie',
    'steak',
  ]) {
    const recipe = recipes[`meat_${item}`];
    assert.ok(recipe, `${item} has a cook recipe`);
    assert.equal(recipe.skill, 'cook');
    const kind =
      item === 'meatBreakfast' ? 'dairyKitchen' : item === 'pubMeatPie' ? 'pub' : 'kitchen';
    const shop = buildings[kind];
    const costs =
      Object.entries(recipe.inputs).reduce((sum, [id, n]) => sum + n * shop.buy[id], 0) +
      shop.wage * (shop.idealEmployees ?? 1);
    const yieldCount = recipe.outputs[item];
    assert.ok(yieldCount > defaults.homeCookingYield!);
    assert.ok(
      recipe.seconds / yieldCount < defaults.homeCookingSeconds!,
      `${item}: business cooks are faster per portion`,
    );
    assert.ok(
      shop.sell[item] * yieldCount * (1 - defaults.salesTax) >= costs * 1.2,
      `${item}: taxed margin`,
    );
    if (item !== 'steak')
      for (const stat of ['food', 'drink', 'health'] as const)
        assert.ok((items[item][stat] ?? 0) > (items.meals[stat] ?? 0), `${item}: better ${stat}`);
  }
});
test('home cooking uses pantry then inventory, takes time, and returns one meal to the home', () => {
  const { w, p, home } = kitchen();
  home.stock = { beef: 1, potatoes: 1 };
  p.inventory = { potatoes: 1, water: 1 };
  assert.throws(
    () => act(w, p.id, { type: 'cook', menu: 'beefStew' }),
    /inside.*home|home.*inside/i,
  );
  act(w, p.id, { type: 'home', building: home.id });
  act(w, p.id, { type: 'cook', menu: 'beefStew' });
  assert.equal(p.task?.kind, 'homeCook');
  assert.equal(home.stock.beef, 1);
  advance(w, 179);
  assert.equal(home.stock.beefStew, undefined);
  advance(w, 1);
  assert.equal(home.stock.beefStew, 1);
  assert.equal(home.stock.beef ?? 0, 0);
  assert.equal(home.stock.potatoes ?? 0, 0);
  assert.equal(p.inventory.potatoes ?? 0, 0);
  assert.equal(p.inventory.water ?? 0, 0);
  advance(w, 1);
  assert.equal(home.stock.beefStew, 1);
});
test('home cooking refuses empty/disabled kitchens and cancels on leaving, lost access or full storage', () => {
  for (const change of ['leave', 'ownership', 'capacity', 'disabled', 'ingredients']) {
    const { w, p, home } = kitchen();
    act(w, p.id, { type: 'home', building: home.id });
    assert.throws(() => act(w, p.id, { type: 'cook', menu: 'beefStew' }), /ingredient|stock/i);
    home.stock = { beef: 1, potatoes: 2, water: 1 };
    act(w, p.id, { type: 'cook', menu: 'beefStew' });
    if (change === 'leave') act(w, p.id, { type: 'outside' });
    if (change === 'ownership') home.owner = 'elsewhere';
    if (change === 'capacity') home.stock.beefStew = home.capacity;
    if (change === 'disabled') w.settings.homeCookingEnabled = false;
    if (change === 'ingredients') home.stock.water = 0;
    advance(w, 180);
    assert.equal(home.stock.beef, 1, change);
    assert.equal(home.stock.beefStew ?? 0, change === 'capacity' ? home.capacity : 0, change);
    assert.equal(p.task, undefined, change);
  }
});
test('a rented inn room cooks from its private pantry, never the business stock or another guest', () => {
  const { w, p } = kitchen();
  const inn = makeBuilding('inn', 'bnb', 0, 0);
  inn.owner = 'innkeeper';
  inn.stock = { beef: 100, potatoes: 100, water: 100 };
  inn.lodging = {
    open: true,
    rate: 100,
    guests: {
      [p.id]: { until: 3600, stock: { beef: 1, potatoes: 2, water: 1 } },
      other: { until: 3600, stock: { beef: 4 } },
    },
  };
  w.buildings = [inn];
  const before = structuredClone(inn.stock);
  act(w, p.id, { type: 'home', building: inn.id });
  act(w, p.id, { type: 'cook', menu: 'beefStew' });
  advance(w, 180);
  assert.equal(inn.lodging.guests[p.id].stock.beefStew, 1);
  assert.equal(inn.lodging.guests.other.stock.beef, 4);
  assert.deepEqual(inn.stock, before);
});
test('offline cooking completes at its due time before ingredients would spoil', () => {
  const { w, p, home } = kitchen();
  home.stock = { beef: 1, potatoes: 2, water: 1 };
  act(w, p.id, { type: 'home', building: home.id });
  act(w, p.id, { type: 'cook', menu: 'beefStew' });
  const copy = structuredClone(w);
  advance(w, 2400);
  for (let i = 0; i < 40; i++) advance(copy, 60);
  assert.equal(home.stock.beefStew, 1);
  assert.deepEqual(home.stock, copy.buildings[0].stock);
});
test('inn pantry transfers and renewed bookings preserve raw meat freshness', () => {
  const { w, p } = kitchen();
  const inn = makeBuilding('inn', 'hotel', 0, 0);
  Object.assign(inn, { owner: 'host', lodging: { open: true, rate: 0, guests: {} } });
  w.buildings.push(inn);
  p.inventory = { beef: 1 };
  advance(w, 600);
  act(w, p.id, { type: 'lodging', building: inn.id, operation: 'rent', hours: 1 });
  act(w, p.id, {
    type: 'lodging',
    building: inn.id,
    operation: 'store',
    direction: 'deposit',
    item: 'beef',
    quantity: 1,
  });
  advance(w, 3600);
  act(w, p.id, { type: 'lodging', building: inn.id, operation: 'rent', hours: 1 });
  act(w, p.id, {
    type: 'lodging',
    building: inn.id,
    operation: 'store',
    direction: 'withdraw',
    item: 'beef',
    quantity: 1,
  });
  advance(w, 599);
  assert.equal(p.inventory.beef, 1);
  advance(w, 1);
  assert.equal(p.inventory.beef ?? 0, 0);
});
test('empty raw-meat stores cannot attach an old ledger to a new portion', async () => {
  const { expireMeat } = await import('../src/shared/meat-freshness');
  const { w, p } = kitchen();
  p.inventory = {};
  p.inventoryLife = { meat: [{ item: 'beef', count: 1, agedDays: 1.9, checkedAt: 0 }] };
  expireMeat(w);
  assert.deepEqual(p.inventoryLife.meat, []);
  p.inventory.beef = 1;
  advance(w, 60);
  assert.equal(p.inventory.beef, 1);
});
test('fresh meat ages once across clock freeze, changed day length and disabled spoilage', async () => {
  const { w, p } = kitchen();
  p.inventory = { beef: 1 };
  advance(w, 600);
  act(w, p.id, { type: 'settings', patch: { dayLength: 0 } });
  advance(w, 2000);
  assert.equal(p.inventoryLife?.meat?.[0].agedDays, 1);
  act(w, p.id, { type: 'settings', patch: { dayLength: 1200 } });
  advance(w, 600);
  assert.equal(p.inventoryLife?.meat?.[0].agedDays, 1.5);
  act(w, p.id, { type: 'settings', patch: { rawMeatSpoilageDays: 0 } });
  advance(w, 3000);
  assert.equal(p.inventory.beef, 1);
  act(w, p.id, { type: 'settings', patch: { rawMeatSpoilageDays: 2 } });
  advance(w, 599);
  assert.equal(p.inventory.beef, 1);
  advance(w, 1);
  assert.equal(p.inventory.beef ?? 0, 0);
});
test('world-enabled raw provisions keep their age through actual ship-store transfers', () => {
  const { w, p } = kitchen();
  w.settings.rawMeatEdible = true;
  p.vehicle = 30;
  p.inventory = { beef: 1 };
  advance(w, 600);
  act(w, p.id, { type: 'expedition', operation: 'store', item: 'beef', quantity: 1 });
  advance(w, 300);
  act(w, p.id, { type: 'expedition', operation: 'take', item: 'beef', quantity: 1 });
  advance(w, 300);
  assert.equal(p.inventory.beef ?? 0, 0);
});

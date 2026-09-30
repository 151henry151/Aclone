// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  move,
  makeBuilding,
} from '../src/shared/simulation.ts';
import { buildings, items } from '../src/shared/catalog.ts';
import { Store } from '../src/server/store.ts';
import { finishHarvest } from '../src/shared/farming.ts';

const setup = () => {
  const w = createWorld('feedback', 'Feedback', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = b.x;
  p.z = b.z + 12;
  p.skills = ['miller'];
  b.owner = p.id;
  return { w, p, b };
};
test('wheeled steering reverses with actual travel direction, including braking, but walking does not', () => {
  const w = createWorld('steering', 'Steering', 'p');
  w.buildings = [];
  const p = addPlayer(w, 'p', 'Driver');
  for (const vehicle of [0, 1, 5]) {
    const forward = { ...structuredClone(p), vehicle, speed: 5, heading: 0 };
    const reverse = { ...structuredClone(p), vehicle, speed: -5, heading: 0 };
    move(w, forward, { throttle: 1, steer: 1, boost: false }, 0.05);
    move(w, reverse, { throttle: 1, steer: 1, boost: false }, 0.05);
    assert.ok(reverse.speed < 0, 'still moving backwards while braking');
    assert.ok(
      vehicle === 5 ? forward.heading * reverse.heading > 0 : forward.heading * reverse.heading < 0,
    );
  }
  p.speed = 0;
  p.heading = 0;
  move(w, p, { throttle: 0, steer: 1, boost: false }, 0.05);
  assert.equal(p.heading, 0);
});
test('owners cannot trade with or take paid work at their own property; stock transfers remain available', () => {
  const { w, p, b } = setup();
  b.stock.flour = 10;
  p.inventory.wheat = 5;
  b.investment = 10000;
  for (const action of [
    { type: 'trade', direction: 'buy', item: 'flour', quantity: 1 },
    { type: 'trade', direction: 'sell', item: 'wheat', quantity: 1 },
    { type: 'job' },
    { type: 'work' },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { ...action, building: b.id }), /own|owner/i);
    assert.equal(JSON.stringify(w), before);
  }
  const forge = makeBuilding('own-forge', 'forge', p.x, p.z);
  forge.owner = p.id;
  w.buildings.push(forge);
  p.inventory.steel = 2;
  p.inventory.wood = 4;
  assert.throws(
    () => act(w, p.id, { type: 'task', building: forge.id, task: 'craft' }),
    /own|owner/i,
  );
  const cash = p.cash;
  act(w, p.id, { type: 'stock', building: b.id, direction: 'deposit', item: 'wheat', quantity: 2 });
  act(w, p.id, {
    type: 'stock',
    building: b.id,
    direction: 'withdraw',
    item: 'flour',
    quantity: 2,
  });
  assert.equal(p.cash, cash);
  assert.equal(p.inventory.flour, 2);
});
test('buying your workplace removes your employment without firing other staff', () => {
  const { w, p, b } = setup();
  b.owner = 'seller';
  b.forSale = true;
  p.cash = 10000000;
  const other = addPlayer(w, 'other', 'Worker');
  other.job = b.id;
  b.employees = [other.id];
  act(w, p.id, { type: 'job', building: b.id });
  act(w, p.id, { type: 'buyBuilding', building: b.id });
  assert.equal(p.job, undefined);
  assert.deepEqual(b.employees, [other.id]);
});
test('legacy owner employment is cleared on load and cannot earn production or reserved harvest wages', () => {
  const { w, p, b } = setup();
  p.job = b.id;
  p.activeUntil = 1e8;
  b.employees = [p.id];
  b.investment = 100000;
  b.stock.wheat = 100;
  b.progress = 1;
  const cash = p.cash;
  advance(w, 600);
  assert.equal(p.cash, cash);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(loaded.players[p.id].job, undefined);
    assert.deepEqual(loaded.buildings.find((x) => x.id === b.id)!.employees, []);
  } finally {
    store.close();
  }
  const farm = makeBuilding('own-farm', 'farm', 0, 0);
  farm.owner = p.id;
  farm.investment = 5000;
  farm.employees = [p.id];
  farm.plots = [
    {
      crop: 'wheat',
      planted: 0,
      ready: 1,
      water: 0,
      fertilized: false,
      harvest: { player: p.id, amount: 4, wage: 2200 },
    },
  ];
  w.buildings.push(farm);
  finishHarvest(w, p, farm.id, 0);
  assert.equal(p.cash, cash);
  assert.equal(farm.investment, 5000);
  assert.equal(farm.stock.wheat, (buildings.farm.stock.wheat ?? 0) + 4);
});
test('default deliveries earn about three percent at Harbour stores with no same-store round trip profit', () => {
  for (const [kind, b] of Object.entries(buildings)) {
    for (const [item, price] of Object.entries(b.sell)) {
      if (kind !== 'market') {
        const bid = buildings.market.buy[item];
        assert.ok(bid > price, `${kind}: ${item} has a delivery margin`);
        assert.ok((bid - price) / price <= 0.032, `${kind}: ${item} margin stays small`);
      }
      if (b.buy[item] !== undefined)
        assert.ok(b.buy[item] < price, `${kind}: no instant ${item} arbitrage`);
    }
  }
  const w = createWorld('delivery', 'Delivery', 'owner'),
    p = addPlayer(w, 'p', 'Haulier');
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!,
    market = w.buildings.find((b) => b.kind === 'market')!;
  bakery.stock.bread = 10;
  market.investment = 100000;
  p.x = bakery.x;
  p.z = bakery.z;
  const cash = p.cash;
  act(w, p.id, {
    type: 'trade',
    building: bakery.id,
    item: 'bread',
    quantity: 2,
    direction: 'buy',
  });
  p.x = market.x;
  p.z = market.z;
  act(w, p.id, {
    type: 'trade',
    building: market.id,
    item: 'bread',
    quantity: 2,
    direction: 'sell',
  });
  assert.equal(p.cash - cash, Math.round(items.bread.price * 0.03) * 2);
});

test('old default prices migrate once while custom quotes, cash, stock and crop listings survive', async () => {
  const old = (await import('../data/legacy-prices-0.6.json')).default;
  const { w, p, b } = setup();
  delete w.tradePricing;
  const market = w.buildings.find((b) => b.kind === 'market')!,
    farm = w.buildings.find((b) => b.kind === 'farm')!;
  for (const lot of w.buildings) {
    const prices = old[lot.kind as keyof typeof old];
    lot.buy = { ...prices.buy };
    lot.sell = { ...prices.sell };
  }
  market.buy.bread = 3333;
  b.sell.flour = 2222;
  farm.sell.potatoes = Math.round(items.potatoes.price * 0.9);
  const stock = JSON.stringify(w.buildings.map((b) => b.stock));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal(loaded.tradePricing, 1);
    assert.equal(loaded.players[p.id].cash, p.cash);
    assert.equal(JSON.stringify(loaded.buildings.map((b) => b.stock)), stock);
    assert.equal(loaded.buildings.find((b) => b.id === market.id)!.buy.bread, 3333);
    assert.equal(
      loaded.buildings.find((b) => b.id === market.id)!.buy.flour,
      buildings.market.buy.flour,
    );
    assert.equal(loaded.buildings.find((x) => x.id === b.id)!.sell.flour, 2222);
    assert.equal(
      loaded.buildings.find((x) => x.id === farm.id)!.sell.potatoes,
      items.potatoes.price,
    );
    // A later owner can intentionally choose an old price without the next load rewriting it.
    loaded.buildings.find((b) => b.id === market.id)!.buy.flour = old.market.buy.flour;
    store.saveWorld(loaded);
    assert.deepEqual(store.loadWorlds()[0].world, loaded);
  } finally {
    store.close();
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildings, items, recipes, defaults } from '../src/shared/catalog.ts';
import { crops, fertilizerPrice } from '../src/shared/farming.ts';
import {
  createWorld,
  makeBuilding,
  addPlayer,
  act,
  advance,
  productionInterval,
} from '../src/shared/simulation.ts';
import { waterworksSite } from '../src/shared/shoreline.ts';
import { Store } from '../src/server/store.ts';

const ports = new Set(['market', 'starport']);
const producers = (item: string) =>
  Object.entries(buildings).filter(
    ([kind, b]) =>
      !ports.has(kind) &&
      (kind === 'farm' ? !!crops[item] : !!recipes[b.recipe ?? '']?.outputs[item]),
  );

test('every processor input has a profitable supply route, and local delivery beats raw exports', () => {
  for (const [kind, b] of Object.entries(buildings)) {
    if (!b.recipe || kind === 'farm') continue;
    for (const item of Object.keys(recipes[b.recipe].inputs)) {
      const sources = producers(item);
      for (const [source, supplier] of sources) {
        assert.ok(b.buy[item] > supplier.sell[item], `${source} -> ${kind}: ${item} haulage pays`);
        assert.ok(
          b.buy[item] > buildings.market.buy[item],
          `${kind}: better than Harbour for ${item}`,
        );
        assert.ok(
          b.buy[item] > buildings.starport.buy[item],
          `${kind}: better than spaceport for ${item}`,
        );
        assert.ok(
          buildings.market.sell[item] > supplier.sell[item],
          `${source}: cheaper than imports`,
        );
        assert.ok(
          buildings.starport.sell[item] > supplier.sell[item],
          `${source}: cheaper than spaceport`,
        );
      }
      if (!sources.length) {
        assert.ok(['logs', 'dirt', 'gravel'].includes(item), `Missing source for ${item}`);
        assert.ok(b.buy[item] > buildings.market.buy[item], `${kind}: rewards gathering locally`);
      }
    }
  }
});

test('every actual production batch pays its input suppliers and worker and retains at least 20% on cost after default taxes', () => {
  for (const [kind, def] of Object.entries(buildings)) {
    if (!def.recipe || kind === 'farm') continue;
    const recipe = recipes[def.recipe];
    const w = createWorld(`balance-${kind}`, 'Balance', 'owner');
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const b = makeBuilding('business', kind, 0, 0);
    if (kind === 'waterworks') {
      b.z = 144;
      b.rotation = waterworksSite(w, b)!.rotation;
    }
    b.stock = {};
    b.investment = 10000000;
    w.buildings = [b];
    const supplier = addPlayer(w, 'supplier', 'Supplier'),
      worker = addPlayer(w, 'worker', 'Worker');
    supplier.x = worker.x = 0;
    supplier.z = worker.z = b.z;
    supplier.cash = 10000000;
    worker.skills = [recipe.skill];
    const initial = b.investment;
    for (const [item, quantity] of Object.entries(recipe.inputs)) {
      supplier.inventory[item] = quantity;
      act(w, supplier.id, { type: 'trade', building: b.id, direction: 'sell', item, quantity });
    }
    const inputs = initial - b.investment;
    act(w, worker.id, { type: 'job', building: b.id });
    const workerCash = worker.cash;
    advance(w, productionInterval(w, b));
    assert.equal(
      worker.cash - workerCash,
      b.wage - Math.floor(b.wage * defaults.wageTax),
      `${kind}: actual wage paid`,
    );
    for (const [item, quantity] of Object.entries(recipe.outputs)) {
      assert.equal(b.stock[item], quantity, `${kind}: actual production`);
      act(w, supplier.id, { type: 'trade', building: b.id, direction: 'buy', item, quantity });
    }
    const profit = b.investment - initial;
    assert.ok(
      profit >= (inputs + b.wage) * 0.2,
      `${kind}: ${profit} profit on ${inputs + b.wage} cost`,
    );
    // Owners who haul their own output can use either export outlet as a fallback.
    for (const port of ports) {
      const exports = Object.entries(recipe.outputs).reduce(
        (n, [item, qty]) => n + buildings[port].buy[item] * qty,
        0,
      );
      assert.ok(exports > inputs + b.wage, `${kind}: fallback ${port} covers batch cost`);
    }
  }
});

test('local retailers can restock from producers, cover tax and undercut imported finished goods', () => {
  for (const kind of ['pub', 'bnb', 'hotel', 'garage']) {
    const shop = buildings[kind];
    for (const [item, ask] of Object.entries(shop.sell)) {
      const source = producers(item);
      const supply = source.length
        ? Math.min(...source.map(([, b]) => b.sell[item]))
        : buildings.market.sell[item];
      assert.ok(shop.buy[item] > supply, `${kind} ${item}: restocking haulage pays`);
      assert.ok(
        ask - Math.floor(ask * 0.07) > shop.buy[item],
        `${kind} ${item}: profitable after sales tax`,
      );
      if (source.length) {
        assert.ok(
          shop.buy[item] > buildings.market.buy[item],
          `${kind} ${item}: preferred local customer`,
        );
        assert.ok(ask < buildings.market.sell[item], `${kind} ${item}: cheaper for players`);
      }
    }
  }
  for (const [kind, b] of Object.entries(buildings))
    for (const [item, bid] of Object.entries(b.buy))
      if (b.sell[item] !== undefined)
        assert.ok(bid < b.sell[item], `${kind}: no same-counter ${item} arbitrage`);
  // Neither public outlet can be used as an infinite import/export price loop.
  for (const item of Object.keys(items))
    for (const a of ports)
      for (const b of ports) assert.ok(buildings[a].sell[item] > buildings[b].buy[item]);
});

for (const version of [undefined, 1] as const) {
  test(`saved pricing ${version ?? 'legacy'} upgrades public/unowned quotes once and preserves all player-owned settings`, () => {
    const w = createWorld('migration', 'Migration', 'human');
    w.tradePricing = version;
    const mill = w.buildings.find((b) => b.kind === 'mill')!;
    mill.owner = 'human';
    mill.buy = { wheat: 600 };
    mill.sell = { flour: 2000 };
    mill.wage = 1000;
    const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
    bakery.owner = 'npc';
    bakery.buy = { flour: 1300 };
    // Even a government flag on a player-owned property must not allow migration.
    bakery.government = true;
    const protectedBuildings = structuredClone([mill, bakery]);
    const farm = w.buildings.find((b) => b.kind === 'farm')!;
    farm.sell = { wheat: 800, potatoes: 12345 };
    farm.investment = 32100;
    farm.stock = { wheat: 118, potatoes: 7 };
    const market = w.buildings.find((b) => b.kind === 'market')!;
    market.buy.wheat = 824;
    const money = w.buildings.map((b) => [b.investment, b.wage, b.price]);
    const stock = w.buildings.map((b) => b.stock);
    const store = new Store(':memory:');
    try {
      store.saveWorld(w);
      const loaded = store.loadWorlds()[0].world;
      assert.equal(loaded.tradePricing, 3);
      assert.deepEqual(
        loaded.buildings.filter((b) => [mill.id, bakery.id].includes(b.id)),
        protectedBuildings,
      );
      assert.deepEqual(
        loaded.buildings.map((b) => [b.investment, b.wage, b.price]),
        money,
      );
      assert.deepEqual(
        loaded.buildings.map((b) => b.stock),
        stock,
      );
      assert.deepEqual(loaded.buildings.find((b) => b.id === farm.id)!.sell, buildings.farm.sell);
      assert.deepEqual(loaded.buildings.find((b) => b.id === market.id)!.buy, buildings.market.buy);
      loaded.buildings.find((b) => b.id === farm.id)!.sell.wheat = 789;
      store.saveWorld(loaded);
      assert.deepEqual(store.loadWorlds()[0].world, loaded, 'subsequent edits survive reload');
    } finally {
      store.close();
    }
  });
}

test('all six crops cover seed, a harvest wage, full irrigation and fertilizer at a conservative half yield', () => {
  for (const [item, crop] of Object.entries(crops)) {
    const cost =
      crop.seed + buildings.farm.wage + 9 * buildings.market.sell.water + fertilizerPrice;
    const sales = Math.floor(crop.yield / 2) * buildings.farm.sell[item];
    assert.ok(
      sales - Math.floor(sales * 0.07) > cost,
      `${item}: viable at half the nominal harvest`,
    );
  }
});

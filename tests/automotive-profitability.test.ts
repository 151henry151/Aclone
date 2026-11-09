// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { automotiveConfig, automotiveProducts } from '../src/shared/automotive-config';
import { automotiveExportQuote } from '../src/shared/automotive-exports';
import { cashFlow } from '../src/shared/reports';
import { creatorSchema } from '../src/shared/creator';

test('a funded factory earns only realized sales across twelve paid production runs and keeps unsold inputs and stock separate', () => {
  const w = createWorld('automotive-profit', 'Factory accounts', 'owner');
  w.towns = [];
  w.buildings = [];
  w.terrain = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, {
    activeWork: false,
    hungerRate: 0,
    thirstRate: 0,
    offlineEfficiency: 0,
    seaLevel: -50,
  });
  const owner = addPlayer(w, 'owner', 'Factory founder');
  Object.assign(owner, { x: 0, z: 17, vehicle: 0, inventory: {}, cash: 100_000_000 });
  const buyer = addPlayer(w, 'buyer', 'Established haulier');
  Object.assign(buyer, { x: 0, z: 17, vehicle: 5, cash: 10_000_000, inventory: {} });
  const b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
  b.owner = owner.id;
  b.stock = {};
  b.investment = 5_000_000;
  const supplier = makeBuilding('supplier', 'warehouse', 12, 17);
  supplier.owner = 'supplier-owner';
  supplier.stock = {};
  supplier.sell = { ...automotiveConfig(w).factory.buy };
  supplier.investment = 0;
  w.buildings = [b, supplier];
  const products = Array.from({ length: 12 }, (_, i) => automotiveProducts[i % 4]);
  for (const product of products)
    for (const [id, n] of Object.entries(automotiveConfig(w).products[product].inputs))
      supplier.stock[id] = (supplier.stock[id] ?? 0) + n;
  supplier.stock.steel += 9; // Explicit finite opening inventory: these nine units never sell.
  const openingStock = { ...supplier.stock },
    startCash = owner.cash + b.investment,
    buyerCash = buyer.cash;
  const workers = Array.from({ length: 6 }, (_, i) => {
    const p = addPlayer(w, 'crew' + i, 'Engineer');
    Object.assign(p, { x: 0, z: 0, skills: ['engineer'] });
    act(w, p.id, { type: 'job', building: b.id });
    return p;
  });
  const wagesBefore = workers.reduce((n, p) => n + p.cash, 0);
  let inputPaid = 0,
    exportGross = 0,
    retailGross = 0,
    handlingSeconds = 0,
    assemblySeconds = 0;
  for (let i = 0; i < products.length; i++) {
    const product = products[i],
      recipe = automotiveConfig(w).products[product];
    for (const [item, n] of Object.entries(recipe.inputs)) {
      for (let remaining = n; remaining > 0;) {
        const quantity = Math.min(20, remaining);
        act(w, owner.id, {
          type: 'trade',
          building: supplier.id,
          direction: 'buy',
          item,
          quantity,
        });
        inputPaid += quantity * supplier.sell[item];
        act(w, owner.id, { type: 'stock', building: b.id, direction: 'deposit', item, quantity });
        remaining -= quantity;
        advance(w, 30);
        handlingSeconds += 30;
      }
    }
    act(w, owner.id, { type: 'manufacturing', building: b.id, op: 'queue', product });
    advance(w, recipe.seconds);
    assemblySeconds += recipe.seconds;
    assert.equal(b.manufacturing!.orders.length, 0);
    const unit = b.manufacturing!.ready.at(-1)!;
    assert.equal(unit.product, product);
    if (i === 1) {
      act(w, buyer.id, {
        type: 'manufacturing',
        building: b.id,
        op: 'buy',
        unit: unit.id,
        expectedPrice: recipe.price,
      });
      retailGross += recipe.price;
    } else if (i < products.length - 1) {
      let quote = automotiveExportQuote(w, product);
      if (!quote.available) {
        advance(w, quote.nextIn);
        quote = automotiveExportQuote(w, product);
      }
      act(w, owner.id, {
        type: 'manufacturing',
        building: b.id,
        op: 'export',
        unit: unit.id,
        expectedPrice: quote.price,
      });
      exportGross += quote.price;
    }
  }
  assert.equal(b.manufacturing!.ready.length, 1, 'Keep the final unsold unit; no phantom buyer');
  assert.equal(b.accounts!.batches, 12);
  assert.equal(
    Object.values(b.accounts!.sold).reduce((a, n) => a + n, 0),
    11,
  );
  assert.equal(buyer.cash, buyerCash - retailGross);
  assert.equal(supplier.stock.steel, 9);
  for (const [id, n] of Object.entries(b.accounts!.consumed))
    assert.equal(n, openingStock[id] - (supplier.stock[id] ?? 0));
  const grossPayroll = 12 * 6 * b.wage;
  assert.equal(
    workers.reduce((n, p) => n + p.cash, 0) - wagesBefore,
    grossPayroll * (1 - w.settings.wageTax),
  );
  const realized = owner.cash + b.investment - startCash;
  assert.equal(
    realized,
    (exportGross + retailGross) * (1 - w.settings.salesTax) - inputPaid - grossPayroll,
  );
  assert.ok(realized > 0, 'Finite realized sales cover paid inputs and all completed payrolls');
  const final = structuredClone(b.manufacturing),
    investment = b.investment;
  advance(w, 7 * 86400);
  assert.deepEqual(b.manufacturing, final, 'Waiting cannot create units or sell unsold stock');
  assert.equal(b.investment, investment, 'No automatic factory subsidy');
  const result = {
    runs: 12,
    sold: 11,
    unsold: b.manufacturing!.ready,
    assemblyHours: assemblySeconds / 3600,
    handlingSeconds,
    inputPaid,
    grossPayroll,
    retailGross,
    exportGross,
    realizedContribution: realized,
    unsoldSupplierSteel: 9,
    factoryRecordedOperatingCash: cashFlow(b.accounts!),
    assumptions:
      'Finite opening supplier inventory, actual paid input purchases and stock deposits, six paid engineers, ordinary sales/wage taxes, ten quota-limited exports and one paid local buyer. Co-located supply cash replay: 30 seconds handling per load; no travel cost or guaranteed demand inferred. Construction capital is excluded from operating contribution and remains a separate recovery cost.',
  };
  mkdirSync('output/automotive-factory', { recursive: true });
  writeFileSync(
    'output/automotive-factory/factory-profitability.json',
    JSON.stringify(result, null, 2),
  );
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { exportShipments } from '../src/shared/export-shipments.ts';
import { migrateEconomy } from '../src/shared/economy.ts';
import { buildings } from '../src/shared/catalog.ts';
import { labourReward, RELIEF_PAY } from '../src/shared/public-labour.ts';
import { Store } from '../src/server/store.ts';

test('shipments clear real stock and refill exhausted public tills once per persisted departure', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const port = w.buildings.find((b) => b.kind === 'starport')!;
  for (const b of w.buildings) b.stock = {};
  port.stock = { water: 500, tools: 70 };
  port.investment = 0;
  exportShipments(w, 1799);
  assert.equal(port.investment, 0);
  exportShipments(w, 1800);
  assert.equal(port.stock.water, 460);
  assert.equal(port.stock.tools, 30);
  const sales = w.ledger.filter((e) => e.reason === 'export shipment');
  assert.equal(
    sales.reduce((s, e) => s + e.amount, 0),
    port.investment,
  );
  const cash = port.investment;
  exportShipments(w, 1800);
  assert.equal(port.investment, cash);
  const store = new Store(':memory:');
  try {
    w.time = 1800;
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    exportShipments(loaded, 1800);
    assert.equal(loaded.buildings.find((b) => b.id === port.id)!.investment, cash);
    exportShipments(loaded, 3600);
    assert.ok(loaded.buildings.find((b) => b.id === port.id)!.investment > cash);
  } finally {
    store.close();
  }
});
test('exports leave household necessities, cannot mint cash without cargo or use private/emergency shops', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  for (const b of w.buildings) {
    b.stock = {};
    b.investment = 0;
  }
  const port = w.buildings.find((b) => b.kind === 'starport')!;
  port.stock.water = 12;
  exportShipments(w, 1800);
  assert.equal(port.investment, 0);
  port.stock.water = 100;
  port.owner = 'human';
  exportShipments(w, 3600);
  assert.equal(port.stock.water, 100);
  port.owner = 'treasury';
  w.id = 'custom';
  exportShipments(w, 5400);
  assert.equal(port.investment, 0);
});
test('export settlement is catalogue-capped and imports cannot be immediately re-exported at a profit', () => {
  for (const kind of ['market', 'starport'])
    for (const [item, bid] of Object.entries(buildings[kind].buy)) {
      for (const source of ['market', 'starport'])
        assert.ok(
          Math.floor(bid * 1.1) < buildings[source].sell[item],
          `${item} import/export spread`,
        );
    }
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    port = w.buildings.find((b) => b.kind === 'starport')!;
  for (const b of w.buildings) b.stock = {};
  port.stock.tools = 48;
  port.buy.tools = 9999999;
  port.investment = 0;
  exportShipments(w, 1800);
  assert.equal(port.investment, 40 * Math.floor(buildings.starport.buy.tools * 1.1));
});
test('one-time Puddlewick rebalance updates owned prices/wages without resetting property, goods or money', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  delete w.crewPricing;
  mill.owner = 'HANK_ROMP';
  mill.name = "Hank's mill";
  mill.wage = 1000;
  mill.sell.flour = 2000;
  mill.investment = 12345;
  mill.stock = { wheat: 118 };
  migrateEconomy(w);
  assert.equal(mill.wage, buildings.mill.wage);
  assert.deepEqual(mill.sell, buildings.mill.sell);
  assert.equal(mill.owner, 'HANK_ROMP');
  assert.equal(mill.investment, 12345);
  assert.deepEqual(mill.stock, { wheat: 118 });
  mill.sell.flour = 123;
  migrateEconomy(w);
  assert.equal(mill.sell.flour, 123);
  const custom = createWorld('custom', 'Custom', 'owner'),
    other = custom.buildings.find((b) => b.kind === 'mill')!;
  other.owner = 'human';
  other.wage = 17;
  migrateEconomy(custom);
  assert.equal(other.wage, 17);
});
test('public relief is means-tested, quoted at start, and persists across reload with a cooldown', () => {
  const w = createWorld('relief', 'Relief', 'server'),
    p = addPlayer(w, 'p', 'P'),
    office = w.buildings.find((b) => b.kind === 'workhouse')!;
  p.x = office.x;
  p.z = office.z;
  p.cash = 0;
  p.bank = 0;
  assert.equal(labourReward(w, p), RELIEF_PAY);
  act(w, p.id, { type: 'task', building: office.id, task: 'labour' });
  p.cash = 10000;
  advance(w, 15);
  assert.equal(p.cash, 10000 + RELIEF_PAY, 'quoted amount honoured');
  p.cash = 0;
  act(w, p.id, { type: 'task', building: office.id, task: 'labour' });
  advance(w, 15);
  assert.equal(p.cash, 100);
  const copy = JSON.parse(JSON.stringify(w));
  assert.equal(labourReward(copy, copy.players[p.id]), 100);
  advance(copy, 1800);
  assert.equal(labourReward(copy, copy.players[p.id]), RELIEF_PAY);
  copy.players[p.id].bank = 6000;
  assert.equal(labourReward(copy, copy.players[p.id]), 100);
});

test('new worlds do not overwrite subsequent owner quotes when loaded', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = 'p';
  mill.sell.flour = 123;
  mill.wage = 42;
  migrateEconomy(w);
  assert.equal(mill.sell.flour, 123);
  assert.equal(mill.wage, 42);
});

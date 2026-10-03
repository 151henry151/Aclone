// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import {
  accounts,
  cashFlow,
  productionReport,
  leaveReport,
  returnReport,
} from '../src/shared/reports.ts';
import { Store } from '../src/server/store.ts';
import { privatePlayer, publicBuildings, prepareFrame } from '../src/server/snapshots.ts';
function setup() {
  const w = createWorld('report', 'Reports', 'owner');
  const owner = addPlayer(w, 'owner', 'Owner'),
    trader = addPlayer(w, 'trader', 'Trader');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = owner.id;
  b.stock = { wheat: 20, flour: 20 };
  b.investment = 100000;
  owner.x = trader.x = b.x;
  owner.z = trader.z = b.z;
  return { w, owner, trader, b };
}
test('business cash flow separates capital, counts traded goods, and persists ledger detail', () => {
  const { w, owner, trader, b } = setup();
  const base = b.investment;
  act(w, owner.id, { type: 'investment', building: b.id, direction: 'deposit', amount: 3000 });
  act(w, trader.id, {
    type: 'trade',
    building: b.id,
    direction: 'buy',
    item: 'flour',
    quantity: 2,
  });
  trader.inventory.wheat = 3;
  act(w, trader.id, {
    type: 'trade',
    building: b.id,
    direction: 'sell',
    item: 'wheat',
    quantity: 3,
  });
  act(w, owner.id, { type: 'investment', building: b.id, direction: 'withdraw', amount: 1000 });
  const a = accounts(w, b);
  assert.equal(a.capitalIn, 3000);
  assert.equal(a.capitalOut, 1000);
  assert.equal(cashFlow(a), b.investment - base - 2000);
  assert.equal(a.sold.flour, 2);
  assert.equal(a.bought.wheat, 3);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const row = store.db.prepare("SELECT details FROM ledger WHERE reason='purchase'").get()!;
    assert.deepEqual(JSON.parse(String(row.details)), {
      building: b.id,
      item: 'flour',
      quantity: 2,
    });
    assert.deepEqual(store.loadWorlds()[0].world.buildings.find((v) => v.id === b.id)!.accounts, a);
  } finally {
    store.close();
  }
});
test('production reports count completed batches and identify actual shortages', () => {
  const { w, trader, b } = setup();
  trader.skills = ['miller'];
  act(w, trader.id, { type: 'job', building: b.id });
  const capital = b.investment;
  advance(w, 600);
  const a = accounts(w, b);
  assert.equal(a.batches, 1);
  assert.equal(a.produced.flour, 3);
  assert.equal(a.consumed.wheat, 5);
  assert.equal(a.wages + a.tax, b.wage);
  assert.equal(cashFlow(a), b.investment - capital);
  b.stock.wheat = 0;
  assert.ok(productionReport(w, b).some((s) => s.includes('Missing 5 wheat')));
  advance(w, 600);
  assert.equal(a.batches, 1);
});
test('return report survives save/load and explains a lost estate without leaking accounts', () => {
  const { w, owner, trader, b } = setup();
  leaveReport(w, owner);
  owner.health = 1;
  owner.hunger = owner.thirst = 50000;
  advance(w, 1);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const returning = saved.players.owner;
    returnReport(saved, returning);
    assert.equal(
      returning.awayReport!.events.find((e) => e.kind === 'death')?.cause,
      'dehydration',
    );
    assert.equal(returning.awayReport!.events.find((e) => e.kind === 'estate')?.building, b.id);
    assert.equal(returning.departure, undefined);
    b.owner = owner.id;
    accounts(w, b);
    assert.ok(privatePlayer(w, owner).statements[b.id]);
    assert.equal(privatePlayer(w, trader).statements[b.id], undefined);
    assert.equal(
      Object.hasOwn(
        publicBuildings(w).find((v) => v.id === b.id)!,
        'accounts',
      ),
      false,
    );
    assert.ok(!JSON.stringify(prepareFrame(w)).includes('cashChange'));
  } finally {
    store.close();
  }
});

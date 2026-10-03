// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { route, shipStats, stationPrice } from '../src/shared/galaxy.ts';
test('route planning respects range and upgrades and hangar choices persist', () => {
  const s = new Store(':memory:');
  try {
    const u = new Universe(s),
      { account: a, token } = u.register('Explorer');
    a.credits = 1000;
    u.upgrade(a, 'drive');
    assert.equal(shipStats(a).range, 6);
    assert.ok(route('hearth', 'farthing', shipStats(a).range).length > 1);
    u.buyShip(a, 'hauler');
    u.buyShip(a, 'shuttle');
    assert.equal(a.credits, 720);
    assert.ok(u.authenticate(token)?.hangar?.includes('hauler'));
  } finally {
    s.close();
  }
});
test('markets enforce station inventory and roll back account and supply on failed persistence', () => {
  const s = new Store(':memory:');
  try {
    const u = new Universe(s),
      { account: a } = u.register('Trader');
    a.credits = 100000;
    const before = u.market(a.system);
    u.trade(a, 'electronics', 2, true);
    assert.equal(u.market(a.system).stock.electronics, before.stock.electronics - 2);
    const copy = JSON.stringify(a),
      stock = JSON.stringify(u.market(a.system));
    s.db.exec(
      "CREATE TRIGGER fail_update BEFORE UPDATE ON accounts BEGIN SELECT RAISE(ABORT,'disk failure'); END",
    );
    assert.throws(() => u.trade(a, 'electronics', 1, true));
    assert.equal(JSON.stringify(a), copy);
    assert.equal(JSON.stringify(u.market(a.system)), stock);
    assert.ok(
      stationPrice('hearth', 'electronics').buy > stationPrice('hearth', 'electronics').sell,
    );
  } finally {
    s.close();
  }
});
test('courier cargo reserves capacity, rewards only at destination, and survey pays once', () => {
  const s = new Store(':memory:');
  try {
    const u = new Universe(s),
      { account: a, token } = u.register('Courier');
    u.courier(a, 'accept');
    assert.throws(() => u.courier(a, 'deliver'));
    const target = a.mission!.destination;
    u.travel(a, target);
    u.arrive(a, a.transit!.arrives);
    u.courier(a, 'deliver');
    assert.throws(() => u.courier(a, 'deliver'));
    u.survey(a);
    const credits = a.credits;
    assert.throws(() => u.survey(a));
    assert.equal(a.credits, credits);
    assert.ok(u.authenticate(token)?.visited?.includes(target));
  } finally {
    s.close();
  }
});
test('jumps persist in transit, block station actions and finish once after reconnect', () => {
  const s = new Store(':memory:');
  try {
    const u = new Universe(s),
      { account: a, token } = u.register('Traveller');
    u.travel(a, 'brindle');
    assert.equal(a.system, 'hearth');
    assert.equal(a.transit?.destination, 'brindle');
    assert.throws(() => u.trade(a, 'electronics', 1, true), /transit/);
    const paid = a.credits;
    u.arrive(a, a.transit!.arrives + 1);
    assert.equal(a.system, 'brindle');
    assert.equal(a.credits, paid);
    u.arrive(a, Infinity);
    assert.equal(u.authenticate(token)?.system, 'brindle');
  } finally {
    s.close();
  }
});

test('hull roles trade range, cargo, journey time and fuel while preserving starter cargo', async () => {
  const { jumpQuote, routeQuote } = await import('../src/shared/galaxy.ts');
  const quote = (ship: string) => jumpQuote({ ship }, 'hearth', 'brindle');
  assert.equal(shipStats({ ship: 'shuttle' }).capacity, 20);
  assert.ok(quote('hauler').cost < quote('shuttle').cost);
  assert.ok(quote('courier').seconds < quote('hauler').seconds);
  assert.ok(shipStats({ ship: 'explorer' }).range > shipStats({ ship: 'courier' }).range);
  const risk = (ship: string) => jumpQuote({ ship }, 'rime', 'vessel');
  assert.ok(risk('escort').hazardCost < risk('hauler').hazardCost);
  const trip = routeQuote({ ship: 'shuttle', upgrades: { drive: 2 } }, 'hearth', 'vessel')!;
  assert.ok(trip.path.length > 2);
  assert.equal(
    trip.cost,
    trip.path
      .slice(1)
      .reduce(
        (sum, to, i) =>
          sum + jumpQuote({ ship: 'shuttle', upgrades: { drive: 2 } }, trip.path[i], to).cost,
        0,
      ),
  );
  assert.equal(routeQuote({ ship: 'shuttle' }, 'hearth', 'vessel'), undefined);
});
test('actual jump charges the displayed hull quote atomically and retains saved arrival', async () => {
  const { jumpQuote } = await import('../src/shared/galaxy.ts');
  const store = new Store(':memory:');
  try {
    const u = new Universe(store),
      { account: a, token } = u.register('Role tester');
    a.credits = 1000;
    u.buyShip(a, 'courier');
    const expected = jumpQuote(a, a.system, 'brindle'),
      before = a.credits,
      time = Date.now() / 1000;
    u.travel(a, 'brindle');
    assert.equal(a.credits, before - expected.cost);
    assert.ok(Math.abs(a.transit!.arrives - time - expected.seconds) < 1);
    assert.equal(u.authenticate(token)!.transit!.arrives, a.transit!.arrives);
    assert.throws(() => u.buyShip(a, 'shuttle'), /transit/);
    u.arrive(a, Infinity);
    a.credits = 0;
    const snapshot = JSON.stringify(a);
    assert.throws(() => u.travel(a, 'hearth'), /fuel/);
    assert.equal(JSON.stringify(a), snapshot);
  } finally {
    store.close();
  }
});

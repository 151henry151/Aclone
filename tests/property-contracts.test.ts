// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { propertyQuote } from '../src/shared/property.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('contracts', 'Contracts', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    q = addPlayer(w, 'operator', 'Operator'),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.investment = 1000;
  b.stock = { wheat: 10 };
  p.x = q.x = b.x;
  p.z = q.z = b.z;
  p.cash = q.cash = 1000000;
  act(w, p.id, { type: 'propertyContract', operation: 'rules', leases: true, auctions: true });
  return { w, p, q, b };
}
test('lease restores title and charges depleted assets only once across expiry and reload', () => {
  const { w, p, q, b } = setup(),
    equity = propertyQuote(w, b).equity,
    before = p.cash + q.cash + b.investment;
  act(w, p.id, {
    type: 'propertyContract',
    operation: 'leaseOffer',
    building: b.id,
    rent: 500,
    hours: 1,
  });
  act(w, q.id, { type: 'propertyContract', operation: 'leaseAccept', building: b.id });
  assert.equal(b.owner, q.id);
  assert.equal(b.operatingLease?.bond, equity);
  assert.throws(() => act(w, q.id, { type: 'listProperty', building: b.id, price: 1 }), /contract/);
  act(w, q.id, { type: 'investment', building: b.id, direction: 'withdraw', amount: 500 });
  // Avoid unrelated economic effects: move the clock to the contractual boundary.
  w.time = b.operatingLease!.ends;
  advance(w, 0.1);
  assert.equal(b.owner, p.id);
  assert.equal(b.operatingLease, undefined);
  assert.equal(p.cash + q.cash + b.investment, before);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const cash = saved.players[q.id].cash;
    advance(saved, 0.1);
    assert.equal(saved.players[q.id].cash, cash);
  } finally {
    store.close();
  }
});
test('auction outbids refund escrow and settlement transfers title exactly once', () => {
  const { w, p, q, b } = setup(),
    r = addPlayer(w, 'third', 'Third');
  r.cash = 10000;
  r.x = b.x;
  r.z = b.z;
  act(w, p.id, {
    type: 'propertyContract',
    operation: 'auctionList',
    building: b.id,
    minimum: 1000,
    hours: 1,
  });
  const start = q.cash;
  act(w, q.id, { type: 'propertyContract', operation: 'bid', building: b.id, amount: 1000 });
  assert.equal(q.cash, start - 1000);
  act(w, r.id, { type: 'propertyContract', operation: 'bid', building: b.id, amount: 1200 });
  assert.equal(q.cash, start);
  const seller = p.cash;
  w.time = b.auction!.ends;
  advance(w, 0.1);
  assert.equal(b.owner, r.id);
  assert.equal(p.cash, seller + 1200);
  advance(w, 0.1);
  assert.equal(p.cash, seller + 1200);
});

test('destroyed properties return auction escrow and settle lease bonds once', () => {
  for (const mode of ['auction', 'lease']) {
    const { w, p, q, b } = setup(),
      before = q.cash;
    if (mode === 'auction') {
      act(w, p.id, {
        type: 'propertyContract',
        operation: 'auctionList',
        building: b.id,
        minimum: 1000,
        hours: 1,
      });
      act(w, q.id, { type: 'propertyContract', operation: 'bid', building: b.id, amount: 1000 });
    } else {
      act(w, p.id, {
        type: 'propertyContract',
        operation: 'leaseOffer',
        building: b.id,
        rent: 500,
        hours: 1,
      });
      act(w, q.id, { type: 'propertyContract', operation: 'leaseAccept', building: b.id });
    }
    const bond = b.operatingLease?.bond ?? 0,
      landlord = p.cash;
    b.condition = 0;
    advance(w, 0.1);
    assert.equal(
      w.buildings.some((v) => v.id === b.id),
      false,
    );
    assert.equal(q.cash, mode === 'auction' ? before : before - 500 - bond);
    assert.equal(p.cash, landlord + bond);
    const money = p.cash + q.cash;
    advance(w, 0.1);
    assert.equal(p.cash + q.cash, money);
  }
});
test('a normal sale listing cancels a stale lease offer', () => {
  const { w, p, q, b } = setup();
  act(w, p.id, {
    type: 'propertyContract',
    operation: 'leaseOffer',
    building: b.id,
    rent: 500,
    hours: 1,
  });
  act(w, p.id, { type: 'listProperty', building: b.id, price: 1200 });
  assert.equal(b.leaseOffer, undefined);
  assert.throws(
    () => act(w, q.id, { type: 'propertyContract', operation: 'leaseAccept', building: b.id }),
    /No lease/,
  );
});

test('leases preserve landlord business limits while operator homes use their separate allowance', () => {
  const { w, p, q, b } = setup();
  w.settings.maxBuildings = 1;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = q.id;
  act(w, p.id, {
    type: 'propertyContract',
    operation: 'leaseOffer',
    building: b.id,
    rent: 100,
    hours: 1,
  });
  act(w, q.id, { type: 'propertyContract', operation: 'leaseAccept', building: b.id });
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  shop.owner = undefined;
  shop.government = false;
  shop.price = 1;
  p.x = shop.x;
  p.z = shop.z;
  assert.throws(() => act(w, p.id, { type: 'buyBuilding', building: shop.id }), /Property limit/);
});

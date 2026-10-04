// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { buildings } from '../src/shared/catalog.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('cancel-test', 'Construction', 'admin');
  w.buildings = [];
  w.zones = [];
  w.towns[0].tax = 0.1;
  const p = addPlayer(w, 'builder', 'Builder');
  p.cash = 1000000;
  act(w, p.id, { type: 'construct', kind: 'home' });
  return { w, p, b: w.buildings[0] };
}
test('cancelling refunds 75% of the original base cost once, retaining tax and freeing the site', () => {
  const { w, p, b } = setup();
  const paid = Math.round(buildings.home.price * 1.1),
    refund = Math.floor(buildings.home.price * 0.75);
  assert.equal(p.cash, 1000000 - paid);
  b.price = 99999999; // A quote must never control a recorded construction refund.
  w.towns[0].tax = 0.9;
  act(w, p.id, { type: 'cancelConstruction', building: b.id, amount: 99999999 });
  assert.equal(p.cash, 1000000 - paid + refund);
  assert.equal(w.buildings.length, 0);
  assert.equal(w.ledger.at(-1)?.amount, refund);
  assert.match(w.ledger.at(-1)!.reason, /construction refund/i);
  const cash = p.cash;
  assert.throws(() => act(w, p.id, { type: 'cancelConstruction', building: b.id }));
  assert.equal(p.cash, cash);
  act(w, p.id, { type: 'construct', kind: 'home' });
  assert.equal(w.buildings.length, 1);
});
test('cancellation rejects other owners, remote players and finished buildings without changing cash', () => {
  const { w, p, b } = setup();
  const admin = addPlayer(w, 'admin', 'Administrator');
  const before = p.cash;
  assert.throws(() => act(w, admin.id, { type: 'cancelConstruction', building: b.id }), /owner/);
  p.x += 100;
  assert.throws(() => act(w, p.id, { type: 'cancelConstruction', building: b.id }), /near/);
  p.x = b.x;
  p.inventory = { ...b.construction! };
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.constructionCost, undefined);
  assert.throws(() => act(w, p.id, { type: 'cancelConstruction', building: b.id }), /unfinished/);
  assert.equal(p.cash, before);
  assert.equal(w.buildings.length, 1);
});
test('partially supplied sites remain cancellable after saving; delivered materials are not refunded', () => {
  const { w, p, b } = setup();
  const item = Object.keys(b.construction!)[0];
  p.inventory = { [item]: 1 };
  act(w, p.id, { type: 'supply', building: b.id });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    const cash = restored.players[p.id].cash;
    act(restored, p.id, { type: 'cancelConstruction', building: b.id });
    assert.equal(restored.players[p.id].cash, cash + Math.floor(buildings.home.price * 0.75));
    assert.equal(restored.players[p.id].inventory[item], 0);
    assert.equal(restored.buildings.length, 0);
  } finally {
    store.close();
  }
});
test('older construction sites without receipts refund a conservative base catalogue value', () => {
  const { w, p, b } = setup();
  delete b.constructionCost;
  b.price = Math.floor(buildings.home.price / 2);
  const before = p.cash;
  act(w, p.id, { type: 'cancelConstruction', building: b.id });
  assert.equal(p.cash, before + Math.floor(b.price * 0.75));
});

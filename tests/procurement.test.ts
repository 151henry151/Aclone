// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { refreshOrders, orderAllowance } from '../src/shared/procurement.ts';
import { Store } from '../src/server/store.ts';
function fixture() {
  const w = createWorld('orders', 'Orders', 'owner');
  w.settings.parishOrders = true;
  w.settings.parishOrderBudget = 120000;
  refreshOrders(w);
  const p = addPlayer(w, 'supplier', 'Supplier');
  const b = w.buildings.find((b) => b.id === w.procurement!.building)!;
  p.x = b.x;
  p.z = b.z;
  return { w, p, b };
}
test('funded orders conserve escrow and limit early monopolies without replaying on restart', () => {
  const { w, p, b } = fixture();
  const state = w.procurement!,
    order = state.orders[0];
  assert.equal(
    order.unitPrice,
    440,
    'gravel bid is exactly 110% without floating-point rounding drift',
  );
  const start = p.cash,
    budget = state.remainingBudget;
  p.inventory[order.item] = order.quantity;
  const quantity = orderAllowance(w, p, order);
  const request = { type: 'fulfilOrder', building: b.id, order: order.id, quantity };
  act(w, p.id, request);
  assert.equal(p.cash - start, quantity * order.unitPrice);
  assert.equal(state.remainingBudget, budget - quantity * order.unitPrice);
  assert.equal(order.delivered, quantity);
  assert.throws(() => act(w, p.id, { ...request, quantity: 1 }), /allowance/i);
  assert.equal(order.delivered, quantity);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    refreshOrders(loaded);
    assert.deepEqual(loaded.procurement, state);
    assert.equal(loaded.ledger.filter((e) => e.reason === 'parish procurement budget').length, 1);
  } finally {
    store.close();
  }
  w.time = state.expiresAt - 1;
  const rest = order.quantity - order.delivered;
  act(w, p.id, { ...request, quantity: rest });
  assert.equal(order.delivered, order.quantity);
  assert.equal(state.remainingBudget + state.paid, budget);
});
test('orders rotate with bounded funding and validate cargo, proximity, time and world settings', () => {
  const { w, p, b } = fixture();
  const first = w.procurement!,
    order = first.orders[0];
  const request = { type: 'fulfilOrder', building: b.id, order: order.id, quantity: 1 };
  assert.throws(() => act(w, p.id, request), /carry/i);
  p.inventory[order.item] = 1;
  p.x += 100;
  assert.throws(() => act(w, p.id, request), /near/i);
  p.x = b.x;
  w.settings.parishOrders = false;
  assert.throws(() => act(w, p.id, request), /disabled/i);
  w.settings.parishOrders = true;
  w.time = first.expiresAt;
  assert.throws(() => act(w, p.id, request), /expired/i);
  refreshOrders(w);
  assert.notDeepEqual(
    w.procurement!.orders.map((o) => o.item),
    first.orders.map((o) => o.item),
  );
  const count = w.ledger.filter((e) => e.reason === 'parish procurement budget').length;
  advance(w, 3600 * 24 * 7);
  assert.equal(
    w.ledger.filter((e) => e.reason === 'parish procurement budget').length,
    count + 1,
    'no backlog of grants after downtime',
  );
  assert.ok(w.procurement!.remainingBudget <= w.settings.parishOrderBudget);
});

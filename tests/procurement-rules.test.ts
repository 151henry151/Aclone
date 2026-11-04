// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { economyRules } from '../src/shared/economy-rules';
import { refreshOrders, orderAllowance } from '../src/shared/procurement';
import { procurementHtml } from '../src/client/procurement';
import { Store } from '../src/server/store';
const defaults = { parishOrderPeriod: 3600, parishOrderShare: 0.5, parishOrderShareWindow: 0.5 };
function setup() {
  const w = createWorld('order-rules', 'Orders', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.settings.parishOrders = true;
  w.settings.parishOrderBudget = 120000;
  const b = w.buildings.find((b) => b.kind === 'market' && b.government)!;
  p.x = b.x;
  p.z = b.z;
  w.time = 0;
  return { w, p, b };
}
test('supply-order rules retain defaults and fall back in old saves', () => {
  const { w, p } = setup();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  for (const [key, value] of Object.entries(defaults))
    assert.equal((economyRules(w.settings) as any)[key], value);
  refreshOrders(w);
  assert.equal(w.procurement!.expiresAt, 3600);
  assert.equal(
    orderAllowance(w, p, w.procurement!.orders[0]),
    Math.ceil(w.procurement!.orders[0].quantity / 2),
  );
});
test('changed supply shares enforce exact early allowance then open at the configured boundary', () => {
  const { w, p, b } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { parishOrderPeriod: 120, parishOrderShare: 0.25, parishOrderShareWindow: 0.25 },
  });
  refreshOrders(w);
  const c = w.procurement!,
    o = c.orders[0];
  assert.equal(c.expiresAt, 120);
  const allowance = Math.ceil(o.quantity * 0.25);
  assert.equal(orderAllowance(w, p, o), allowance);
  p.inventory[o.item] = o.quantity;
  act(w, p.id, { type: 'fulfilOrder', building: b.id, order: o.id, quantity: allowance });
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'fulfilOrder', building: b.id, order: o.id, quantity: 1 }),
    /allowance/,
  );
  assert.equal(JSON.stringify(w), before);
  w.time = 29.99;
  assert.equal(orderAllowance(w, p, o), 0);
  w.time = 30;
  assert.equal(orderAllowance(w, p, o), o.quantity - allowance);
  assert.match(procurementHtml(w, p), /25%/);
  assert.match(procurementHtml(w, p), /0.5 minutes/);
  act(w, p.id, {
    type: 'fulfilOrder',
    building: b.id,
    order: o.id,
    quantity: o.quantity - allowance,
  });
  assert.equal(o.delivered, o.quantity);
  assert.equal(
    c.remainingBudget + c.paid,
    c.orders.reduce((n, o) => n + o.quantity * o.unitPrice, 0),
  );
});
test('funded rounds retain terms across edits and reloads; new duration never reuses order ids', () => {
  const { w, p } = setup();
  act(w, p.id, {
    type: 'settings',
    patch: { parishOrderPeriod: 120, parishOrderShare: 0.25, parishOrderShareWindow: 0.25 },
  });
  refreshOrders(w);
  const first = structuredClone(w.procurement!);
  w.time = 60;
  act(w, p.id, {
    type: 'settings',
    patch: { parishOrderPeriod: 3600, parishOrderShare: 0.1, parishOrderShareWindow: 1 },
  });
  refreshOrders(w);
  assert.deepEqual(w.procurement, first);
  assert.equal(orderAllowance(w, p, w.procurement!.orders[0]), first.orders[0].quantity);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    refreshOrders(saved);
    assert.deepEqual(saved.procurement, first);
  } finally {
    store.close();
  }
  w.time = 120;
  refreshOrders(w);
  const next = w.procurement!;
  assert.equal(next.opensAt, 120);
  assert.equal(next.expiresAt, 3720);
  assert.notEqual(next.orders[0].id, first.orders[0].id);
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'fulfilOrder',
        building: next.building,
        order: first.orders[0].id,
        quantity: 1,
      }),
    /no longer/,
  );
  assert.equal(JSON.stringify(w), before);
  assert.equal(orderAllowance(w, p, next.orders[0]), Math.ceil(next.orders[0].quantity * 0.1));
  const grants = () => w.ledger.filter((e) => e.reason === 'parish procurement budget').length;
  assert.equal(grants(), 2);
  refreshOrders(w);
  assert.equal(grants(), 2);
  w.time = 86400 * 7;
  refreshOrders(w);
  assert.equal(grants(), 3);
  assert.equal(
    (w.procurement!.opensAt - next.expiresAt) % 3600,
    0,
    'downtime preserves the new round schedule',
  );
  assert.ok(w.procurement!.remainingBudget <= w.settings.parishOrderBudget);
});
test('zero share and zero window behave distinctly while disabled/absent orders stay unavailable', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'settings', patch: { parishOrderShare: 0, parishOrderShareWindow: 1 } });
  refreshOrders(w);
  assert.equal(orderAllowance(w, p, w.procurement!.orders[0]), 0);
  w.time = w.procurement!.expiresAt;
  act(w, p.id, { type: 'settings', patch: { parishOrderShareWindow: 0 } });
  refreshOrders(w);
  assert.equal(orderAllowance(w, p, w.procurement!.orders[0]), w.procurement!.orders[0].quantity);
  w.settings.parishOrders = false;
  assert.match(procurementHtml(w, p), /disabled/);
  assert.equal(orderAllowance(w, p, w.procurement!.orders[0]), 0);
  delete w.procurement;
  w.settings.parishOrders = true;
  assert.match(procurementHtml(w, p), /No current orders/);
});
test('supply-order fields validate, appear in creation/summary and round-trip designs', async () => {
  const { w, p } = setup();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { parishOrderPeriod: 0 },
    { parishOrderPeriod: 120.5 },
    { parishOrderShare: 1.1 },
    { parishOrderShareWindow: -0.1 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.deepEqual(w.settings, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: { parishOrderPeriod: 120, parishOrderShare: 0.25, parishOrderShareWindow: 0.75 },
  });
  const summary = rulesSummary(w);
  for (const value of ['120', '25%', '75%']) assert.ok(summary.includes(value));
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  for (const key of Object.keys(defaults))
    assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
});

test('legacy funded rounds keep their original share even after world rules change', () => {
  const { w, p } = setup();
  refreshOrders(w);
  delete w.procurement!.earlyShare;
  delete w.procurement!.shareUntil;
  act(w, p.id, { type: 'settings', patch: { parishOrderShare: 0, parishOrderShareWindow: 0 } });
  assert.equal(
    orderAllowance(w, p, w.procurement!.orders[0]),
    Math.ceil(w.procurement!.orders[0].quantity / 2),
  );
  w.time = 1800;
  assert.equal(orderAllowance(w, p, w.procurement!.orders[0]), w.procurement!.orders[0].quantity);
});

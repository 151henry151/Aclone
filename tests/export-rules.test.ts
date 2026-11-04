// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { economyRules } from '../src/shared/economy-rules';
import { exportShipments } from '../src/shared/export-shipments';
import { migrateEconomy } from '../src/shared/economy';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  for (const b of w.buildings) {
    b.stock = {};
    b.investment = 0;
  }
  const port = w.buildings.find((b) => b.kind === 'starport')!;
  port.stock.tools = 1000;
  return { w, p, port };
}
test('export rules preserve defaults and legacy missing-key schedules', () => {
  const { w } = setup();
  assert.equal((w.settings as any).exportShipmentInterval, 1800);
  delete (w.settings as any).exportShipmentInterval;
  assert.equal((economyRules(w.settings) as any).exportShipmentInterval, 1800);
  w.time = 3600;
  w.exportShipment = 2;
  delete (w as any).exportShipmentAt;
  migrateEconomy(w);
  assert.equal((w as any).exportShipmentAt, 3600);
  exportShipments(w, 3600);
  assert.equal(w.ledger.filter((e) => e.reason === 'export shipment').length, 0);
  delete w.exportShipment;
  delete (w as any).exportShipmentAt;
  w.time = 4000;
  migrateEconomy(w);
  assert.equal((w as any).exportShipmentAt, 3600);
});
test('shorter interval sells actual cargo once at its boundary and survives reload', () => {
  const { w, p, port } = setup();
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 60 } });
  exportShipments(w, 59);
  assert.equal(port.stock.tools, 1000);
  exportShipments(w, 60);
  assert.equal(port.stock.tools, 960);
  assert.ok(port.investment > 0);
  const cash = port.investment;
  exportShipments(w, 60);
  assert.equal(port.investment, cash);
  w.time = 60;
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const b = saved.buildings.find((b) => b.id === port.id)!;
    exportShipments(saved, 60);
    assert.equal(b.investment, cash);
    exportShipments(saved, 120);
    assert.equal(b.stock.tools, 920);
  } finally {
    store.close();
  }
});
test('changing interval restarts from edit time without retroactive exports; unchanged saves keep schedule', () => {
  const { w, p, port } = setup();
  w.time = 1800;
  exportShipments(w, w.time);
  assert.equal(port.stock.tools, 960);
  w.time = 2000;
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 60 } });
  exportShipments(w, 2000);
  assert.equal(port.stock.tools, 960);
  exportShipments(w, 2059);
  assert.equal(port.stock.tools, 960);
  w.time = 2059;
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 60 } });
  exportShipments(w, 2060);
  assert.equal(port.stock.tools, 920);
  w.time = 2060;
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 3600 } });
  exportShipments(w, 5659);
  assert.equal(port.stock.tools, 920);
  exportShipments(w, 5660);
  assert.equal(port.stock.tools, 880);
});
test('catch-up stays bounded, empty cargo earns nothing and private/custom terminals stay excluded', () => {
  const { w, p, port } = setup();
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 60 } });
  port.stock.tools = 10000;
  exportShipments(w, 1000000);
  assert.equal(port.stock.tools, 10000 - 48 * 40);
  port.stock = {};
  const cash = port.investment;
  exportShipments(w, 1000060);
  assert.equal(port.investment, cash);
  port.stock.tools = 100;
  port.owner = p.id;
  exportShipments(w, 1000120);
  assert.equal(port.stock.tools, 100);
  port.owner = 'treasury';
  w.id = 'custom';
  exportShipments(w, 1000180);
  assert.equal(port.stock.tools, 100);
});
test('export interval validates atomically and is carried by editor, summary and portable designs', async () => {
  const { w, p } = setup();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  assert.ok(settingsFields().includes('name="exportShipmentInterval"'));
  for (const value of [0, 59, 60.5, 86401]) {
    const before = JSON.stringify(w);
    assert.throws(() =>
      act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: value } }),
    );
    assert.equal(JSON.stringify(w), before);
  }
  act(w, p.id, { type: 'settings', patch: { exportShipmentInterval: 73 } });
  assert.ok(rulesSummary(w).includes('73 seconds'));
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.equal((dest.settings as any).exportShipmentInterval, 73);
});

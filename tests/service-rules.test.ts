// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { vehicleRecord, repairStatus } from '../src/shared/vehicle-services';
import { economyRules } from '../src/shared/economy-rules';
const defaults = {
  vehicleServiceFee: 1000,
  vehicleServiceSteel: 1,
  mapPrintPrice: 1000,
  ammunitionRefitPrice: 2500,
};
function fixture() {
  const w = createWorld('services-rules', 'Services', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    q = addPlayer(w, 'q', 'Neighbour');
  const b = makeBuilding('garage', 'garage', 0, 0);
  b.owner = 'other';
  w.buildings = [b];
  w.script = '';
  for (const r of [p, q])
    Object.assign(r, {
      x: 0,
      z: 0,
      y: 0,
      online: true,
      engine: false,
      inventory: {},
      cash: 100000,
    });
  vehicleRecord(w, p).condition = vehicleRecord(w, q).condition = 40;
  return { w, p, q, b };
}
test('service rules preserve named defaults and old saves use the same fallback', () => {
  const { w } = fixture();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value, key);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  for (const [key, value] of Object.entries(defaults))
    assert.equal((economyRules(w.settings) as any)[key], value, key);
});
test('garage services honour fee and parts, retain owner exemption, and reject shortages atomically', () => {
  const { w, p, b } = fixture();
  act(w, p.id, { type: 'settings', patch: { vehicleServiceFee: 321, vehicleServiceSteel: 2 } });
  p.inventory.steel = 1;
  const service = () => act(w, p.id, { type: 'serviceVehicle', building: b.id });
  const before = JSON.stringify(w);
  assert.throws(service, /Steel/);
  assert.equal(JSON.stringify(w), before);
  p.inventory.steel = 4;
  const cash = p.cash,
    till = b.investment;
  service();
  assert.equal(p.cash, cash - 321);
  assert.equal(b.investment, till + 321);
  assert.equal(p.inventory.steel, 2);
  assert.equal(vehicleRecord(w, p).condition, 65);
  b.owner = p.id;
  service();
  assert.equal(p.cash, cash - 321);
  assert.equal(p.inventory.steel, 0);
  assert.equal(vehicleRecord(w, p).condition, 90);
});
test('roadside parts checks match consumption, and zero-part service requires no carried steel', () => {
  const { w, p, q, b } = fixture();
  p.skills = ['mechanic'];
  p.inventory.tools = 1;
  p.inventory.steel = 1;
  act(w, p.id, { type: 'settings', patch: { vehicleServiceSteel: 2 } });
  assert.match(repairStatus(w, p, q).reason!, /2 Steel/);
  assert.throws(() => act(w, p.id, { type: 'repairVehicle', player: q.id }));
  p.inventory.steel = 2;
  act(w, p.id, { type: 'repairVehicle', player: q.id });
  assert.equal(p.inventory.steel, 0);
  assert.equal(vehicleRecord(w, q).condition, 65);
  delete p.inventory.steel;
  act(w, p.id, { type: 'settings', patch: { vehicleServiceSteel: 0, vehicleServiceFee: 0 } });
  act(w, p.id, { type: 'repairVehicle', player: q.id });
  assert.equal(vehicleRecord(w, q).condition, 90);
  act(w, p.id, { type: 'serviceVehicle', building: b.id });
  assert.equal(p.inventory.steel ?? 0, 0);
  assert.equal(p.inventory.tools, 1);
});
test('map and ammunition prices govern real payments, free settings and cash failures', () => {
  const { w, p, b } = fixture();
  act(w, p.id, { type: 'settings', patch: { mapPrintPrice: 123, ammunitionRefitPrice: 456 } });
  const cash = p.cash,
    till = b.investment;
  act(w, p.id, { type: 'buyMap', building: b.id });
  assert.equal(p.cash, cash - 123);
  assert.equal(b.investment, till + 123);
  assert.equal(p.inventory.parishMap, 1);
  assert.throws(() => act(w, p.id, { type: 'buyMap', building: b.id }), /already/);
  p.energy = 0;
  p.ammo = {};
  act(w, p.id, { type: 'refit', building: b.id });
  assert.equal(p.cash, cash - 579);
  assert.equal(p.energy, 65000);
  assert.ok(p.ammo.machine! > 0);
  p.cash = 0;
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'refit', building: b.id }), /cash/);
  assert.equal(JSON.stringify(w), before);
  delete p.inventory.parishMap;
  act(w, p.id, { type: 'settings', patch: { mapPrintPrice: 0, ammunitionRefitPrice: 0 } });
  act(w, p.id, { type: 'buyMap', building: b.id });
  act(w, p.id, { type: 'refit', building: b.id });
  assert.equal(p.cash, 0);
});
test('service settings validate, appear in creation/summary and round-trip world designs', async () => {
  const { w, p } = fixture();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const key of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${key}"`));
  for (const patch of [
    { vehicleServiceFee: -1 },
    { vehicleServiceSteel: 1.5 },
    { mapPrintPrice: -1 },
    { ammunitionRefitPrice: 0.2 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.deepEqual(w.settings, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: {
      vehicleServiceFee: 123,
      vehicleServiceSteel: 2,
      mapPrintPrice: 456,
      ammunitionRefitPrice: 789,
    },
  });
  for (const value of ['123', '2 Steel', '456', '789']) assert.ok(rulesSummary(w).includes(value));
  const dest = createWorld('dest', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  for (const key of Object.keys(defaults))
    assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
});
test('resident service plans quote configured fees and buy only missing parts', async () => {
  const { w, p, b } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: {
      vehicleServiceFee: 321,
      vehicleServiceSteel: 2,
      mapPrintPrice: 123,
      ammunitionRefitPrice: 456,
      requireMapItem: true,
    },
  });
  const { adaptiveChoices } = await import('../src/server/npc/adaptive');
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical',
    notebook: '',
    intent: 'Maintain vehicle',
    plan: [],
    index: 0,
    experiences: [],
  } as any;
  p.inventory.steel = 2;
  let choices = adaptiveChoices(w, p, state);
  assert.ok(choices.some((c) => c.description.includes('using 2 Steel and 321')));
  assert.ok(choices.some((c) => c.description.includes('map') && c.description.includes('123')));
  assert.ok(
    choices.some((c) => c.description.includes('ammunition') && c.description.includes('456')),
  );
  p.inventory.steel = 1;
  b.sell.steel = 100;
  b.stock.steel = 10;
  choices = adaptiveChoices(w, p, state);
  const buy = choices.find((c) => c.description.includes('Buy 1 Steel spare'));
  assert.ok(buy);
  assert.ok(
    buy.plan.some((s) => s.kind === 'act' && s.action.type === 'trade' && s.action.quantity === 1),
  );
});

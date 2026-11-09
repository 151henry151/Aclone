// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { trailerAction, type Trailer } from '../src/shared/trailers';
import { addFreshMeat, expireMeat, expireMeatStock } from '../src/shared/meat-freshness';
import { automotiveConfig } from '../src/shared/automotive-config';
import { worldItems } from '../src/shared/world-catalogue';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('reefer', 'Cold freight', 'p');
  w.buildings = [];
  Object.assign(w.settings, { dayLength: 3600, rawMeatSpoilageDays: 10 });
  const p = addPlayer(w, 'p', 'Haulier');
  Object.assign(p, { x: 0, z: 0, vehicle: 5, speed: 0, inventory: { fuel: 2 }, fuel: 17 });
  const t: Trailer = {
    id: 'reefer',
    kind: 'semiRefrigerated',
    owner: p.id,
    x: 0,
    z: 0,
    heading: 0,
    cargo: {},
  };
  w.trailers = { [t.id]: t };
  const action = (operation: string, extra = {}) =>
    trailerAction(w, p, { type: 'trailer', id: t.id, operation, ...extra });
  const tick = (seconds: number) => {
    w.time += seconds;
    expireMeat(w);
  };
  return { w, p, t, action, tick };
}
test('cooling requires independently purchased fuel and explicit power, with atomic refusals', () => {
  const { w, p, t, action } = setup();
  assert.throws(() => action('cooling', { running: true }), /fuel/i);
  assert.equal(p.fuel, 17);
  action('coolingRefuel', { quantity: 1 });
  assert.equal(p.inventory.fuel, 1);
  assert.equal((t as any).cooling.fuel, worldItems(w).fuel.fuel);
  assert.equal((t as any).cooling.running, false);
  action('cooling', { running: true });
  assert.equal((t as any).cooling.running, true);
  const before = structuredClone(w);
  assert.throws(() => action('coolingRefuel', { quantity: 100 }), /fuel|room/i);
  assert.deepEqual(w, before);
  const stranger = addPlayer(w, 'other', 'Other');
  Object.assign(stranger, { x: 0, z: 0, vehicle: 5 });
  assert.throws(
    () =>
      trailerAction(w, stranger, {
        type: 'trailer',
        operation: 'cooling',
        id: t.id,
        running: false,
      }),
    /own/i,
  );
});
test('fuel depletion divides a long interval into cooled and warm ageing without resetting existing age', () => {
  const { w, t, action, tick } = setup();
  addFreshMeat(w, t.cargo, 'beef', 2);
  tick(3600);
  assert.equal(t.life!.meat![0].agedDays, 1);
  action('coolingRefuel', { quantity: 1 });
  action('cooling', { running: true });
  const hours = worldItems(w).fuel.fuel;
  // Use a short known tank interval; changing burn is a real world rule.
  act(w, 'p', { type: 'automotiveConfig', patch: { refrigeration: { fuelPerHour: hours } } });
  tick(7200);
  assert.ok(Math.abs(t.life!.meat![0].agedDays - 2.2) < 1e-8);
  assert.equal((t as any).cooling.fuel, 0);
  action('coolingRefuel', { quantity: 1 });
  assert.ok(Math.abs(t.life!.meat![0].agedDays - 2.2) < 1e-8);
  tick(3600);
  assert.ok(Math.abs(t.life!.meat![0].agedDays - 2.4) < 1e-8);
});
test('empty and fish-only cooling uses fuel, and power-off and world changes settle old rates', () => {
  const { w, t, action, tick } = setup();
  action('coolingRefuel', { quantity: 1 });
  action('cooling', { running: true });
  const fuel = (t as any).cooling.fuel;
  tick(1800);
  assert.ok(Math.abs((t as any).cooling.fuel - fuel + 0.5) < 1e-8);
  t.cargo.fish = 5;
  w.time += 1800;
  action('cooling', { running: false });
  assert.ok(Math.abs((t as any).cooling.fuel - fuel + 1) < 1e-8);
  tick(3600);
  assert.ok(Math.abs((t as any).cooling.fuel - fuel + 1) < 1e-8);
  assert.equal(t.cargo.fish, 5);
  action('cooling', { running: true });
  w.time += 1800;
  act(w, 'p', { type: 'automotiveConfig', patch: { refrigeration: { fuelPerHour: 2 } } });
  assert.ok(Math.abs((t as any).cooling.fuel - fuel + 1.5) < 1e-8);
  tick(1800);
  assert.ok(Math.abs((t as any).cooling.fuel - fuel + 2.5) < 1e-8);
});
test('refrigeration and dated cargo survive transfer and SQLite restart, with validated tank edits', () => {
  const { w, p, t, action, tick } = setup();
  addFreshMeat(w, t.cargo, 'beef', 1);
  action('coolingRefuel', { quantity: 1 });
  action('cooling', { running: true });
  tick(3600);
  action('unload', { item: 'beef', quantity: 1 });
  assert.ok(Math.abs(p.inventoryLife!.meat![0].agedDays - 0.2) < 1e-8);
  action('load', { item: 'beef', quantity: 1 });
  const db = new Store(':memory:');
  try {
    db.saveWorld(w);
    assert.deepEqual(db.loadWorlds()[0].world.trailers![t.id], t);
  } finally {
    db.close();
  }
  const before = structuredClone(w);
  assert.throws(
    () =>
      act(w, 'p', { type: 'automotiveConfig', patch: { refrigeration: { fuelCapacity: 0.1 } } }),
    /fuel|tank|capacity/i,
  );
  assert.deepEqual(w, before);
  assert.equal((automotiveConfig(w) as any).refrigeration.ageingMultiplier, 0.2);
});

test('owners see separate empty refrigeration controls and all world refrigeration settings', async () => {
  const { trailerPanel } = await import('../src/client/trailer-panel');
  const { automotiveEditor } = await import('../src/client/automotive-panel');
  const { w, p } = setup();
  assert.match(trailerPanel(w, p), /Refuel refrigeration/);
  assert.match(trailerPanel(w, p), /Add refrigeration fuel first/);
  const editor = automotiveEditor(w);
  assert.match(editor, /creator-automotive-refrigeration-form/);
  for (const key of ['enabled', 'fuelCapacity', 'fuelPerHour', 'ageingMultiplier'])
    assert.ok(editor.includes(`name="${key}"`));
});

test('nonperishable meals avoid world-wide stock scans while empty reefers still burn fuel', () => {
  const { w, p, t, action } = setup();
  action('coolingRefuel', { quantity: 1 });
  action('cooling', { running: true });
  let unrelatedReads = 0;
  for (let i = 0; i < 100; i++) {
    const other = addPlayer(w, 'diner-' + i, 'Diner');
    const inventory = other.inventory;
    Object.defineProperty(other, 'inventory', {
      get() {
        unrelatedReads++;
        return inventory;
      },
    });
  }
  delete w.players[p.id];
  w.players[p.id] = p;
  const fuel = t.cooling!.fuel;
  w.time += 1800;
  for (let i = 0; i < 100; i++) expireMeatStock(w, p.inventory);
  expireMeatStock(w, t.cargo);
  assert.equal(unrelatedReads, 0, 'A non-meat meal must not inspect unrelated inventories');
  assert.ok(Math.abs(t.cooling!.fuel - fuel + 0.5) < 1e-8);
  t.cargo.fish = 1;
  w.time += 1800;
  expireMeatStock(w, t.cargo);
  assert.ok(Math.abs(t.cooling!.fuel - fuel + 1) < 1e-8);
});

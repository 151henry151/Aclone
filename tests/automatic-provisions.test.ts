// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, advance, act } from '../src/shared/simulation';
import { homeProvisions } from '../src/shared/home-provisions';
import { prepareAutomaticProvisions } from '../src/server/automatic-provisions-rules';
import { FISHING_BOAT } from '../src/shared/boats';
function setup() {
  const w = createWorld('test-provisions', 'Test', 'owner');
  w.buildings = [];
  const p = addPlayer(w, 'owner', 'Owner');
  delete p.needsGraceUntil;
  Object.assign(p, {
    hunger: 30000,
    thirst: 30000,
    inventory: { bread: 20, water: 20 },
    online: false,
  });
  Object.assign(w.settings, {
    autoConsumeInventory: true,
    autoConsumeHomeStock: true,
    maxOfflineDays: 0,
    postDeathGraceSeconds: 0,
  });
  const home = makeBuilding('house', 'home', 0, 0);
  home.owner = p.id;
  home.stock = { bread: 20, water: 20 };
  p.home = home.id;
  return { w, p, home };
}
test('homeless players eat inventory automatically online and offline; toggling off preserves manual rules', () => {
  for (const online of [true, false]) {
    const { w, p } = setup();
    p.online = online;
    advance(w, 1);
    assert.ok(p.hunger < 30000 && p.thirst < 30000);
    assert.ok(p.inventory.bread < 20 && p.inventory.water < 20);
    w.settings.autoConsumeInventory = false;
    p.hunger = p.thirst = 30000;
    const stock = { ...p.inventory };
    advance(w, 1);
    assert.deepEqual(p.inventory, stock);
    assert.ok(p.hunger > 30000 && p.thirst > 30000);
  }
});
test('inventory is used before selected home stock outside; business and other owners supplies are excluded', () => {
  const { w, p, home } = setup();
  w.buildings = [home];
  advance(w, 1);
  assert.deepEqual(home.stock, { bread: 20, water: 20 });
  p.inventory = {};
  p.hunger = p.thirst = 30000;
  advance(w, 1);
  assert.ok(home.stock.bread < 20 && home.stock.water < 20);
  for (const change of [
    () => (home.owner = 'other'),
    () => {
      home.owner = p.id;
      home.kind = 'bakery';
    },
  ]) {
    change();
    p.hunger = p.thirst = 30000;
    const stock: Record<string, number> = { ...home.stock };
    advance(w, 1);
    assert.deepEqual(home.stock, stock);
  }
});
test('home benefit is configurable, applies only indoors, and works with automatic inventory disabled', () => {
  const { w, p, home } = setup();
  w.buildings = [home];
  home.stock = {};
  p.inventory = {};
  w.settings.homeNeedsMultiplier = 0.5;
  w.settings.autoConsumeInventory = false;
  p.hunger = p.thirst = 0;
  p.atHome = true;
  advance(w, 100);
  assert.equal(p.hunger, w.settings.hungerRate * 50);
  assert.equal(p.thirst, w.settings.thirstRate * 50);
  p.atHome = false;
  advance(w, 100);
  assert.equal(p.hunger, w.settings.hungerRate * 150);
  p.authority = 100;
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { homeNeedsMultiplier: 1.1 } }));
});
test('offline catch-up equals live ticks across inventory exhaustion, home fallback and room expiry', () => {
  const { w, p, home } = setup();
  home.kind = 'bnb';
  home.owner = 'host';
  home.lodging = {
    open: true,
    rate: 0,
    guests: { [p.id]: { until: w.time + 7000, stock: { bread: 4, water: 4 } } },
  };
  w.buildings = [home];
  p.inventory = { bread: 1, water: 1 };
  const v = structuredClone(w);
  advance(w, 12000);
  for (let i = 0; i < 12000; i += 10) advance(v, 10);
  const q = v.players[p.id];
  for (const key of ['hunger', 'thirst', 'health'] as const)
    assert.ok(Math.abs(p[key] - q[key]) < 1e-6, key);
  assert.deepEqual(p.inventory, q.inventory);
  assert.deepEqual(home.lodging, v.buildings[0].lodging);
  assert.equal(p.deaths, q.deaths);
});
test('home forecast includes inventory fallback and configurable benefit without mutating supplies', () => {
  const { w, p, home } = setup();
  w.buildings = [home];
  p.atHome = true;
  home.stock = { bread: 1, water: 1 };
  p.inventory = { bread: 2, water: 3 };
  w.settings.homeNeedsMultiplier = 0.5;
  const before = JSON.stringify(w),
    estimate = homeProvisions(w, p)!;
  assert.equal(JSON.stringify(w), before);
  advance(w, estimate.seconds + 0.001);
  assert.ok(
    home.stock.bread + p.inventory.bread === 0 || home.stock.water + p.inventory.water === 0,
  );
  assert.equal(p.deaths, 0);
  assert.equal(homeProvisions(w, p)!.seconds, 0);
});
test('deckhands use captain provisions first and meals are charged once; online captain may use inventory', () => {
  const { w, p } = setup();
  p.vehicle = FISHING_BOAT;
  p.online = true;
  p.boatStores = { bread: 10, water: 10 };
  p.fishingVoyage = {
    members: { crew: 0.1 },
    offers: {},
    departed: true,
    caught: {},
    expenses: 0,
    fuelPrice: 1,
    provisionPrices: { bread: 2, water: 3 },
  };
  const crew = addPlayer(w, 'crew', 'Crew');
  delete crew.needsGraceUntil;
  Object.assign(crew, {
    hitch: p.id,
    hunger: 30000,
    thirst: 30000,
    inventory: { bread: 10, water: 10 },
  });
  advance(w, 1);
  assert.ok(p.inventory.bread < 20);
  assert.deepEqual(crew.inventory, { bread: 10, water: 10 });
  assert.equal(
    p.fishingVoyage.expenses,
    (10 - p.boatStores.bread) * 2 + (10 - p.boatStores.water) * 3,
  );
  assert.ok(p.fishingVoyage.expenses > 0);
});
test('Puddlewick migration is once-only and leaves other worlds alone', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(prepareAutomaticProvisions(w), true);
  assert.equal(w.settings.autoConsumeInventory, true);
  assert.equal(w.settings.autoConsumeHomeStock, true);
  w.settings.autoConsumeInventory = false;
  assert.equal(prepareAutomaticProvisions(w), false);
  assert.equal(w.settings.autoConsumeInventory, false);
  const other = createWorld('other', 'Other', 'owner');
  assert.equal(prepareAutomaticProvisions(other), false);
  assert.equal(other.settings.autoConsumeInventory, false);
});

test('long offline absence uses real supplies without a house; no provisions means starvation still applies', () => {
  const { w, p } = setup();
  p.inventory = { bread: 100, water: 100 };
  advance(w, 86400 * 2);
  assert.equal(p.deaths, 0);
  assert.ok(p.inventory.bread < 100 && p.inventory.water < 100);
  p.inventory = {};
  p.hunger = p.thirst = 50000;
  p.health = 6;
  advance(w, 2);
  assert.equal(p.deaths, 1);
});
test('remote room feeding stops at expiry and cannot use lodging business stock', () => {
  const { w, p, home } = setup();
  home.kind = 'bnb';
  home.owner = 'host';
  home.lodging = {
    open: true,
    rate: 0,
    guests: { [p.id]: { until: w.time + 1, stock: { bread: 10, water: 10 } } },
  };
  w.buildings = [home];
  p.inventory = {};
  advance(w, 2);
  assert.ok(home.lodging.guests[p.id].stock.bread < 10);
  const guest = { ...home.lodging.guests[p.id].stock },
    business = { ...home.stock };
  p.hunger = p.thirst = 30000;
  advance(w, 1);
  assert.deepEqual(home.lodging.guests[p.id].stock, guest);
  assert.deepEqual(home.stock, business);
  assert.ok(p.hunger > 30000);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
import { trailerDefs, trailerAccepts, trailerFactors, type Trailer } from '../src/shared/trailers';
import { Store } from '../src/server/store';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { worldItems } from '../src/shared/world-catalogue';
import { vehicleDef } from '../src/shared/vehicle-config';

function setup() {
  const w = createWorld('fuel-trailer', 'Fuel trailer', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  w.settings.seaLevel = -50;
  Object.assign(p, {
    x: 0,
    z: -200,
    y: terrainHeight(w, 0, -200),
    heading: 0,
    vehicle: 0,
    inventory: {},
    cash: 4000000,
    online: true,
    speed: 0,
  });
  const garage = makeBuilding('garage', 'garage', 14, -200);
  w.buildings.push(garage);
  return { w, p, garage };
}
function buy() {
  assert.ok(trailerDefs.fuel, 'fuel tanker catalogue entry');
  const fixture = setup(),
    { w, p, garage } = fixture;
  act(w, p.id, { type: 'trailer', operation: 'buy', kind: 'fuel', building: garage.id });
  return { ...fixture, t: Object.values(w.trailers!)[0] };
}
test('fuel tanker uses the liquid-tanker body size, bounded fuel capacity and a separate fuel-only hold', () => {
  assert.ok(trailerDefs.fuel, 'fuel tanker catalogue entry');
  const { w, p, t } = buy();
  assert.equal(trailerDefs.fuel.length, trailerDefs.tanker.length);
  assert.equal(trailerDefs.fuel.width, trailerDefs.tanker.width);
  assert.equal(trailerDefs.fuel.price, 575000);
  assert.equal(trailerDefs.fuel.capacity, 700);
  assert.equal(p.cash, 4000000 - 575000);
  assert.notEqual(trailerDefs.fuel.color, trailerDefs.tanker.color);
  const units = worldItems(w).fuel.fuel!;
  assert.equal(units, 8);
  assert.equal(trailerDefs.fuel.capacity * units, 5600);
  assert.ok(trailerDefs.fuel.capacity * units > vehicleDef(w, 30).tank!);
  assert.ok(trailerDefs.fuel.capacity * units < vehicleDef(w, 30).tank! * 2);
  assert.equal(trailerAccepts(w, t, 'fuel', 700), true);
  assert.equal(trailerAccepts(w, t, 'fuel', 701), false);
  for (const item of ['water', 'milk', 'bread', 'fish', 'logs', 'steel', 'not-an-item'])
    assert.equal(trailerAccepts(w, t, item, 1), false, item);
  const liquid: Trailer = { ...t, kind: 'tanker', cargo: {} };
  assert.equal(trailerAccepts(w, liquid, 'fuel', 1), false);
  assert.equal(trailerAccepts(w, liquid, 'water', 700), true);
  liquid.cargo.water = 1;
  assert.equal(trailerAccepts(w, liquid, 'milk', 1), false);
});
test('refinery loading, own transfers, loaded penalties and saved fuel remain exact', () => {
  const { w, p, t, garage } = buy();
  garage.kind = 'refinery';
  garage.sell = { fuel: 3850 };
  garage.stock = { fuel: 700 };
  garage.capacity = 1000;
  garage.investment = 0;
  const cash = p.cash,
    empty = trailerFactors(w, p);
  act(w, p.id, {
    type: 'trade',
    building: garage.id,
    direction: 'buy',
    item: 'fuel',
    quantity: 500,
    storage: 'trailer',
  });
  assert.equal(t.cargo.fuel, 500);
  assert.equal(garage.stock.fuel, 200);
  assert.equal(p.cash, cash - Math.ceil(500 * 3850 * 0.97));
  assert.equal(p.inventory.fuel, undefined);
  assert.ok(trailerFactors(w, p).speed < empty.speed);
  assert.ok(trailerFactors(w, p).fuel > empty.fuel);
  act(w, p.id, { type: 'trailer', operation: 'unload', id: t.id, item: 'fuel', quantity: 10 });
  assert.equal(p.inventory.fuel, 10);
  assert.equal(t.cargo.fuel, 490);
  act(w, p.id, { type: 'trailer', operation: 'load', id: t.id, item: 'fuel', quantity: 7 });
  assert.equal(p.inventory.fuel, 3);
  assert.equal(t.cargo.fuel, 497);
  act(w, p.id, { type: 'trailer', operation: 'unhitch', id: t.id });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    assert.deepEqual(saved.trailers![t.id], t);
  } finally {
    store.close();
  }
  for (const lose of [true, false]) {
    const copy = structuredClone(w),
      q = copy.players[p.id],
      rig = copy.trailers![t.id];
    rig.attached = q.id;
    copy.settings.loseInventoryOnDeath = lose;
    q.age = copy.settings.maxAge + 1;
    advance(copy, 0.1);
    assert.equal(rig.attached, undefined);
    assert.equal(rig.owner, q.id);
    assert.equal(rig.cargo.fuel, lose ? undefined : 497);
  }
});
test('world owner tunes fuel-tanker price and capacity, with existing loads protected and design defaults preserved', async () => {
  const { w, p, garage } = setup();
  act(w, p.id, { type: 'trailerTuning', kind: 'fuel', price: 600000, capacity: 800 });
  const { trailerDef } = await import('../src/shared/trailers');
  assert.equal(trailerDef(w, 'fuel').price, 600000);
  assert.equal(trailerDef(w, 'fuel').capacity, 800);
  assert.equal(trailerDef(w, 'tanker').capacity, 700);
  act(w, p.id, { type: 'trailer', operation: 'buy', kind: 'fuel', building: garage.id });
  const t = Object.values(w.trailers!)[0];
  assert.equal(p.cash, 3400000);
  t.cargo.fuel = 750;
  assert.equal(trailerAccepts(w, t, 'fuel', 50), true);
  assert.equal(trailerAccepts(w, t, 'fuel', 51), false);
  for (const patch of [
    { price: -1, capacity: 800 },
    { price: 1.5, capacity: 800 },
    { price: 100000001, capacity: 800 },
    { price: 1, capacity: 0 },
    { price: 1, capacity: 100001 },
    { price: 1, capacity: 700 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'trailerTuning', kind: 'fuel', ...patch }));
    assert.equal(JSON.stringify(w), before);
  }
  const visitor = addPlayer(w, 'visitor', 'Visitor');
  assert.throws(() =>
    act(w, visitor.id, { type: 'trailerTuning', kind: 'fuel', price: 1, capacity: 800 }),
  );
  const target = createWorld('import', 'Imported', 'builder');
  applyDesign(target, exportDesign(w));
  assert.deepEqual(target.trailerTuning, w.trailerTuning);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.trailerTuning, w.trailerTuning);
  } finally {
    store.close();
  }
});

test('partial trailer tuning preserves untouched defaults and prior overrides', async () => {
  const { w, p } = setup();
  const { trailerDef } = await import('../src/shared/trailers');
  act(w, p.id, { type: 'trailerTuning', kind: 'fuel', capacity: 900 });
  assert.equal(trailerDef(w, 'fuel').price, 575000);
  act(w, p.id, { type: 'trailerTuning', kind: 'fuel', price: 600000 });
  assert.equal(trailerDef(w, 'fuel').capacity, 900);
  assert.equal(trailerDef(w, 'fuel').price, 600000);
});

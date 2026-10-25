// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, advance } from '../src/shared/simulation';
import { homeProvisions } from '../src/shared/home-provisions';
import { items } from '../src/shared/catalog';
function setup() {
  const w = createWorld('home-test', 'Home', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('house', 'home', 0, 0);
  b.owner = p.id;
  b.stock = { bread: 3, water: 5 };
  w.buildings = [b];
  Object.assign(p, { atHome: true, home: b.id, hunger: 10000, thirst: 15000, online: false });
  delete p.needsGraceUntil;
  return { w, p, b };
}
test('forecast matches actual automatic consumption to the last serving, without counting time to death or mutating state', () => {
  const { w, p, b } = setup();
  const before = JSON.stringify(w),
    e = homeProvisions(w, p)!;
  assert.equal(JSON.stringify(w), before);
  assert.ok(e.seconds > 0);
  assert.ok(e.exhausted);
  advance(w, e.seconds - 0.01);
  assert.ok(b.stock.bread > 0 && b.stock.water > 0);
  advance(w, 0.02);
  assert.ok(b.stock.bread === 0 || b.stock.water === 0);
  assert.ok(p.health > 0);
  assert.equal(p.deaths, 0);
  assert.equal(homeProvisions(w, p)!.seconds, 0);
});
test('empty stores report now even if well fed; disabled needs do not falsely limit supplies', () => {
  const { w, p, b } = setup();
  b.stock = { bread: 1 };
  p.hunger = p.thirst = 0;
  assert.deepEqual(homeProvisions(w, p), { seconds: 0, exhausted: 'drink' });
  w.settings.thirstRate = 0;
  assert.equal(homeProvisions(w, p)!.exhausted, 'food');
  w.settings.hungerRate = 0;
  assert.equal(homeProvisions(w, p)!.seconds, Infinity);
});
test('mixed food/drink servings are not counted twice and use the real shelter rate', () => {
  const { w, p, b } = setup();
  const mixed = Object.entries(items).find(([, d]) => d.food && d.drink);
  assert.ok(mixed);
  b.stock = { [mixed[0]]: 3 };
  const e = homeProvisions(w, p)!;
  advance(w, e.seconds + 0.001);
  assert.equal(b.stock[mixed[0]], 0);
  assert.equal(e.exhausted, 'food and drink');
});
test('grace delays consumption, and rented-room forecasts use the private pantry and booking boundary', () => {
  const { w, p, b } = setup();
  const baseline = homeProvisions(w, p)!.seconds;
  p.needsGraceUntil = w.time + 100;
  assert.equal(homeProvisions(w, p)!.seconds, baseline + 100);
  b.kind = 'bnb';
  b.owner = 'innkeeper';
  b.lodging = { open: true, rate: 0, guests: { [p.id]: { until: w.time + 60, stock: {} } } };
  p.roomPantries = { [b.id]: { bread: 100, water: 100 } };
  assert.deepEqual(homeProvisions(w, p), { seconds: 60, limit: 'booking' });
  p.atHome = false;
  assert.equal(homeProvisions(w, p), undefined);
});

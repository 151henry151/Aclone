// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { integrateSeafood, seafoodKitchens, seafoodSpecies } from '../src/shared/seafood';
import { buildings, recipes } from '../src/shared/catalog';
import { feedAtHome } from '../src/shared/lodging';
test('fish prices leave landing, resale and haulage margins without overwriting existing quotes', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  for (const kind of [...seafoodKitchens, 'market', 'starport']) {
    const b = makeBuilding(kind, kind, 100, 100);
    b.buy = { cod: 1 };
    b.sell = { cod: 0 };
    w.buildings.push(b);
  }
  assert.equal(integrateSeafood(w), true);
  assert.equal(integrateSeafood(w), false);
  for (const b of w.buildings.filter((b) => seafoodKitchens.includes(b.kind) && b.id === b.kind)) {
    assert.equal(b.buy.cod, 1);
    assert.equal(b.sell.cod, 0);
    assert.ok(b.buy.tuna > 0);
  }
  for (const id of seafoodSpecies) {
    assert.ok(buildings.boathouse.buy[id] < buildings.boathouse.sell[id]);
    for (const kind of [...seafoodKitchens, 'market', 'starport'])
      assert.ok(buildings[kind].buy[id] > buildings.boathouse.sell[id]);
  }
});
test('cooks consume purchased fish, potatoes and water to make real meals, and menu changes reset partial progress', () => {
  const w = createWorld('test', 'Kitchen', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('seafood', 'kitchen', 60, 60);
  b.owner = p.id;
  b.investment = 100000;
  b.stock = { cod: 1, potatoes: 2, water: 1 };
  w.buildings.push(b);
  Object.assign(p, { x: 60, z: 60, online: true });
  w.settings.ownerOperation = false;
  w.settings.activeWork = false;
  for (const id of ['chef1', 'chef2']) {
    const q = addPlayer(w, id, id);
    q.x = 60;
    q.z = 60;
    q.skills = ['cook'];
    q.job = b.id;
    q.online = true;
    b.employees.push(id);
  }
  act(w, p.id, { type: 'seafoodMenu', building: b.id, menu: 'cod' });
  advance(w, 600);
  assert.equal(b.stock.cod, 0);
  assert.equal(b.stock.potatoes, 0);
  assert.equal(b.stock.water, 0);
  assert.equal(b.stock.meals, 4);
  assert.equal(b.accounts!.consumed.cod, 1);
  assert.equal(b.accounts!.produced.meals, 4);
  b.progress = 0.9;
  act(w, p.id, { type: 'seafoodMenu', building: b.id, menu: 'halibut' });
  assert.equal(b.progress, 0);
  assert.equal(b.recipe, 'seafood_halibut');
  assert.throws(
    () => act(w, 'chef1', { type: 'seafoodMenu', building: b.id, menu: 'tuna' }),
    /owner/,
  );
  act(w, p.id, { type: 'seafoodMenu', building: b.id, menu: 'standard' });
  assert.equal(b.recipe, 'kitchen');
});
test('all seafood menus have funded ingredient margins, and new fish feed room pantries', () => {
  for (const id of seafoodSpecies) {
    const r = recipes['seafood_' + id],
      b = buildings.kitchen;
    const cost = Object.entries(r.inputs).reduce((s, [k, n]) => s + n * b.buy[k], 0) + b.wage * 2;
    assert.ok(r.outputs.meals * b.sell.meals > cost);
  }
  const w = createWorld('test', 'Rooms', 'server'),
    p = addPlayer(w, 'p', 'Guest');
  p.hunger = 40000;
  p.thirst = 0;
  const pantry = { cod: 1, water: 1 };
  feedAtHome(p, pantry, 1, 0, 0, w);
  assert.equal(pantry.cod, 0);
  assert.ok(p.hunger < 30000);
});

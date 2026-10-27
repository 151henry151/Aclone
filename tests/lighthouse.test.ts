// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { shelter } from '../src/shared/lodging';
import { ensurePuddlewickLighthouses } from '../src/server/puddlewick-lighthouses';
import { hiringLimit } from '../src/shared/staffing';
function setup() {
  const w = createWorld('keeper', 'Keeper', 'server');
  w.buildings = [];
  w.settings.activeWork = false;
  const p = addPlayer(w, 'keeper', 'Keeper'),
    owner = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('light', 'lighthouse', p.x, p.z);
  b.owner = owner.id;
  w.buildings.push(b);
  return { w, p, owner, b };
}
test('unqualified keeper gets private housing without owning or paying; only one keeper', () => {
  const { w, p, owner, b } = setup();
  p.skills = [];
  p.cash = 0;
  assert.doesNotThrow(() => act(w, p.id, { type: 'job', building: b.id }));
  assert.equal(p.cash, 0);
  assert.doesNotThrow(() => act(w, p.id, { type: 'home', building: b.id }));
  assert.ok(shelter(w, p));
  Object.assign(owner, { x: p.x, z: p.z });
  assert.throws(() => act(w, owner.id, { type: 'home', building: b.id }));
  b.hiringLimit = 99;
  assert.equal(hiringLimit(w, b), 1);
  assert.throws(() => act(w, owner.id, { type: 'job', building: b.id }));
  p.inventory.bread = 4;
  assert.doesNotThrow(() =>
    act(w, p.id, {
      type: 'lodging',
      building: b.id,
      operation: 'store',
      direction: 'deposit',
      item: 'bread',
      quantity: 4,
    }),
  );
  assert.doesNotThrow(() => act(w, p.id, { type: 'quit' }));
  assert.equal(shelter(w, p), undefined);
  assert.throws(() => act(w, p.id, { type: 'home', building: b.id }));
  assert.doesNotThrow(() =>
    act(w, p.id, {
      type: 'lodging',
      building: b.id,
      operation: 'store',
      direction: 'withdraw',
      item: 'bread',
      quantity: 4,
    }),
  );
  assert.doesNotThrow(() => act(w, owner.id, { type: 'job', building: b.id }));
  assert.doesNotThrow(() => act(w, owner.id, { type: 'home', building: b.id }));
});
test('public lighthouse pays one modest daily wage without working capital; private allowance is small', () => {
  const { w, p, b } = setup();
  w.settings.wageTax = 0;
  w.towns = [];
  assert.doesNotThrow(() => act(w, p.id, { type: 'job', building: b.id }));
  const cash = p.cash;
  advance(w, w.settings.dayLength);
  assert.equal(p.cash - cash, 800);
  assert.equal(b.investment, 400);
  b.owner = 'treasury';
  const before = p.cash;
  advance(w, w.settings.dayLength);
  assert.equal(p.cash - before, 800);
  assert.equal(b.investment, 400);
});
test('Puddlewick gets three distinct unobstructed coastal lights once', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(ensurePuddlewickLighthouses(w), true);
  const lights = w.buildings.filter((b) => b.kind === 'lighthouse');
  assert.equal(lights.length, 3);
  assert.equal(w.lighthouseVersion, 1);
  assert.equal(ensurePuddlewickLighthouses(w), false);
  assert.ok(lights.some((b) => b.x < -1000 && b.z > 3000));
  assert.ok(lights.some((b) => b.x > 1000 && b.z > 3000));
  assert.ok(lights.some((b) => Math.hypot(b.x, b.z) < 450));
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { buildings } from '../src/shared/catalog.ts';
import { constructionTerms } from '../src/shared/civics.ts';
import { drySite } from './civics-helpers.ts';

function setup() {
  const w = createWorld('build', 'Build', 'owner');
  w.buildings = w.buildings.filter((b) => b.kind === 'town');
  w.zones = [];
  const p = addPlayer(w, 'p', 'Builder');
  p.cash = 10_000_000;
  return { w, p, town: w.towns[0] };
}
const home = buildings.home.price;

test('town construction tax is paid into the town treasury', () => {
  const { w, p, town } = setup();
  town.tax = 0.1;
  Object.assign(p, { x: 40, z: 60 });
  act(w, p.id, { type: 'construct', kind: 'home' });
  assert.equal(p.cash, 10_000_000 - Math.round(home * 1.1));
  assert.equal(town.treasury, Math.round(home * 0.1));
  const entry = w.ledger.find((e) => e.reason === 'construction tax')!;
  assert.equal(entry.kind, 'transfer');
  assert.equal(entry.to, 'town:puddlewick');
});

test('building outside every border is untaxed, refused, or under the nearest town', () => {
  const { w, p, town } = setup();
  town.tax = 0.2;
  Object.assign(p, drySite(w, 800));
  assert.deepEqual(constructionTerms(w, p, 'home', p), { tax: 0, rate: 0 });
  w.townCharter = { outside: 'forbid' };
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /inside a town/);
  w.townCharter = { outside: 'nearest' };
  town.zoning = { north: ['industrial'], south: ['industrial'] };
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /Puddlewick/);
  act(w, p.id, { type: 'construct', kind: 'sawmill' });
  assert.equal(town.treasury, Math.round(buildings.sawmill.price * 0.2));
});

test('district zoning applies different categories north and south of the plinth', () => {
  const { w, p, town } = setup();
  town.zoning = { north: ['residential'], south: ['industrial'] };
  Object.assign(p, { x: 40, z: -60 });
  assert.throws(
    () => act(w, p.id, { type: 'construct', kind: 'sawmill' }),
    /Only residential buildings may be built here in Puddlewick/,
  );
  act(w, p.id, { type: 'construct', kind: 'home' });
  Object.assign(p, { x: 40, z: 60 });
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /industrial/);
  act(w, p.id, { type: 'construct', kind: 'sawmill' });
  assert.equal(w.buildings.length, 3);
});

test('town permissions separate residents from guests', () => {
  const { w, p, town } = setup();
  town.permissions.guests.build = false;
  Object.assign(p, { x: 40, z: 60 });
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /residents/);
  const plinth = w.buildings.find((b) => b.id === town.plinth)!;
  Object.assign(p, { x: plinth.x, z: plinth.z + 5 });
  act(w, p.id, { type: 'town', building: plinth.id, operation: 'join' });
  Object.assign(p, { x: 40, z: 60 });
  act(w, p.id, { type: 'construct', kind: 'home' });
  town.permissions.residents.build = false;
  Object.assign(p, { x: -60, z: 60 });
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home' }), /does not allow/);
});

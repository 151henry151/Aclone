// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { townAt } from '../src/shared/civics.ts';
import { founder } from './civics-helpers.ts';

test('a player founds a town at their position, paying the charter cost', () => {
  const w = createWorld('found', 'Found', 'owner');
  const p = founder(w);
  const cash = p.cash;
  act(w, p.id, { type: 'foundTown', name: 'New Bristol' });
  const town = w.towns.at(-1)!;
  assert.equal(w.towns.length, 2);
  assert.equal(town.id, 'new-bristol');
  assert.equal(town.name, 'New Bristol');
  assert.deepEqual([town.x, town.z], [p.x, p.z]);
  assert.equal(town.radius, 150);
  assert.equal(town.founder, p.id);
  assert.equal(town.mayor, p.id);
  assert.deepEqual(town.residents, [p.id]);
  assert.equal(p.town, town.id);
  assert.equal(p.cash, cash - 50000);
  const plinth = w.buildings.find((b) => b.id === town.plinth)!;
  assert.equal(plinth.kind, 'town');
  assert.equal(plinth.name, 'New Bristol');
  assert.ok(plinth.government);
  assert.equal(townAt(w, p.x + 100, p.z)?.id, town.id);
});

test('founding respects the charter switch, skill, spacing, limit and unique names', () => {
  const w = createWorld('rules', 'Rules', 'owner');
  const p = founder(w);
  w.townCharter = { founding: false };
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'A' }), /disabled/);
  w.townCharter = { foundingSkill: 'mayor' };
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'A' }), /mayor/);
  p.skills.push('mayor');
  w.townCharter = { foundingSkill: 'mayor', minSpacing: 5000 };
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'A' }), /from another town/);
  w.townCharter = { maxTowns: 1 };
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'A' }), /limit/);
  w.townCharter = {};
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'puddlewick' }), /name/);
  const inside = addPlayer(w, 'inside', 'Inside');
  inside.cash = 10_000_000;
  assert.throws(() => act(w, inside.id, { type: 'foundTown', name: 'B' }), /from another town/);
  p.cash = 10;
  assert.throws(() => act(w, p.id, { type: 'foundTown', name: 'A' }), /cash/);
  assert.equal(w.towns.length, 1);
});

test('direct democracies start without a mayor', () => {
  const w = createWorld('direct', 'Direct', 'owner');
  w.townCharter = { governance: ['direct'] };
  const p = founder(w);
  act(w, p.id, { type: 'foundTown', name: 'Commons' });
  assert.equal(w.towns.at(-1)!.governance, 'direct');
  assert.equal(w.towns.at(-1)!.mayor, undefined);
});

test('players hold one home town at a time and can leave it', () => {
  const w = createWorld('home', 'Home', 'owner');
  const p = founder(w);
  act(w, p.id, { type: 'foundTown', name: 'Elsewhere' });
  const elsewhere = w.towns[1],
    puddlewick = w.towns[0];
  const r = addPlayer(w, 'r', 'Resident');
  const plinth = w.buildings.find((b) => b.id === puddlewick.plinth)!;
  Object.assign(r, { x: plinth.x, z: plinth.z + 5 });
  act(w, r.id, { type: 'town', building: plinth.id, operation: 'join' });
  assert.deepEqual(puddlewick.residents, [r.id]);
  assert.equal(r.town, 'puddlewick');
  Object.assign(r, { x: elsewhere.x, z: elsewhere.z + 5 });
  act(w, r.id, { type: 'town', building: elsewhere.plinth, operation: 'join' });
  assert.deepEqual(puddlewick.residents, []);
  assert.deepEqual(elsewhere.residents, [p.id, r.id]);
  assert.equal(r.town, elsewhere.id);
  act(w, r.id, { type: 'town', building: elsewhere.plinth, operation: 'leave' });
  assert.deepEqual(elsewhere.residents, [p.id]);
  assert.equal(r.town, undefined);
});

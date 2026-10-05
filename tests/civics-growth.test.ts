// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { siteAt } from './civics-helpers.ts';

function setup() {
  const w = createWorld('grow', 'Grow', 'owner');
  w.zones = [];
  const p = addPlayer(w, 'p', 'Builder');
  p.cash = 100_000_000;
  w.settings.maxBuildings = w.settings.maxHomes = 50;
  return { w, p, town: w.towns[0] };
}
const build = (w: ReturnType<typeof setup>['w'], id: string, at: { x: number; z: number }) => {
  Object.assign(w.players[id], at);
  act(w, id, { type: 'construct', kind: 'home' });
};

test('building on the outskirts pushes the border out; building in the middle does not', () => {
  const { w, p, town } = setup();
  build(w, p.id, siteAt(w, 120));
  assert.equal(town.radius, 300);
  const edge = siteAt(w, 280);
  build(w, p.id, edge);
  assert.equal(town.radius, 310);
  const beyond = siteAt(w, 335);
  build(w, p.id, beyond);
  assert.equal(town.radius, Math.round(Math.hypot(beyond.x, beyond.z)) + 10);
});

test('growth can be disabled and never exceeds the charter maximum', () => {
  const { w, p, town } = setup();
  w.townCharter = { growth: false };
  build(w, p.id, siteAt(w, 290));
  assert.equal(town.radius, 300);
  w.townCharter = { maxRadius: 305 };
  build(w, p.id, siteAt(w, 295));
  assert.equal(town.radius, 305);
});

test('a border stops short of a neighbouring town', () => {
  const { w, p, town } = setup();
  w.towns.push({ ...structuredClone(town), id: 'n', name: 'N', x: 0, z: 0, radius: 0 });
  const site = siteAt(w, 290);
  const n = w.towns[1];
  Object.assign(n, { x: site.x * (600 / 290), z: site.z * (600 / 290), radius: 295 });
  build(w, p.id, site);
  assert.ok(town.radius <= 305, `radius ${town.radius} overlaps the neighbour`);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, makeBuilding } from '../src/shared/simulation.ts';
function setup() {
  const w = createWorld('puddlewick', 'Test', 'owner');
  w.buildings = [];
  const p = addPlayer(w, 'p', 'Pilot');
  p.online = false;
  return { w, p };
}
test('offline hunger and thirst rise outdoors and health falls once starving', () => {
  const { w, p } = setup();
  p.hunger = 49000;
  p.thirst = 1000;
  p.health = 40000;
  advance(w, 1000);
  assert.equal(p.hunger, 50000);
  assert.equal(p.thirst, 3500);
  assert.ok(p.health < 40000);
  assert.equal(p.online, false);
});
test('offline starvation causes ordinary death and estate consequences', () => {
  const { w, p } = setup();
  p.hunger = 50000;
  p.health = 30;
  p.skills = ['miller'];
  const b = makeBuilding('home', 'home', 0, 20);
  b.owner = p.id;
  w.buildings.push(b);
  advance(w, 10);
  assert.equal(p.deaths, 1);
  assert.deepEqual(p.skills, []);
  assert.equal(b.owner, undefined);
  assert.equal(p.online, false);
});
test('stocked homes feed offline residents; long catch-up matches short ticks across stock exhaustion and death', () => {
  const { w, p } = setup();
  const b = makeBuilding('home', 'home', 0, 20);
  b.owner = p.id;
  b.stock = { bread: 2, water: 2 };
  w.buildings.push(b);
  p.home = b.id;
  p.atHome = true;
  const slow = structuredClone(w);
  advance(w, 86400);
  for (let i = 0; i < 1440; i++) advance(slow, 60);
  const q = slow.players.p;
  assert.equal(p.deaths, q.deaths);
  assert.ok(p.deaths > 0);
  assert.ok(Math.abs(p.health - q.health) < 0.001);
  assert.ok(Math.abs(p.hunger - q.hunger) < 0.001);
  assert.ok(Math.abs(p.thirst - q.thirst) < 0.001);
});
test('a booked room stops protecting an offline guest at expiry, with deterministic catch-up', () => {
  const { w, p } = setup();
  const b = makeBuilding('inn', 'bnb', 0, 20);
  b.owner = 'keeper';
  b.lodging = {
    open: true,
    rate: 600,
    guests: { p: { until: 3600, stock: { bread: 20, water: 20 } } },
  };
  w.buildings.push(b);
  p.home = b.id;
  p.atHome = true;
  const slow = structuredClone(w);
  advance(w, 18000);
  for (let i = 0; i < 300; i++) advance(slow, 60);
  assert.equal(p.atHome, false);
  assert.equal(p.deaths, slow.players.p.deaths);
  assert.ok(Math.abs(p.health - slow.players.p.health) < 0.001);
  assert.ok(Math.abs(p.thirst - slow.players.p.thirst) < 0.001);
});

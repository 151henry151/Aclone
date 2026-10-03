// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  act,
  addPlayer,
  advance,
  createWorld,
  makeBuilding,
  move,
} from '../src/shared/simulation.ts';
import { alcoholLevel, impairment, drinkAlcohol } from '../src/shared/intoxication.ts';
import { feedShelterNow } from '../src/shared/nutrition.ts';
import { carePlan } from '../src/server/npc/care.ts';

test('beer and wine accumulate, water does not cure, and save/load plus offline time preserve recovery', () => {
  const w = createWorld('drink', 'Drink', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  p.inventory = { beer: 8, wine: 1, water: 1 };
  act(w, p.id, { type: 'use', item: 'beer' });
  assert.equal(impairment(p, w.time), 0);
  act(w, p.id, { type: 'use', item: 'beer' });
  assert.ok(impairment(p, w.time) > 0);
  const level = alcoholLevel(p, w.time);
  act(w, p.id, { type: 'use', item: 'water' });
  assert.equal(alcoholLevel(p, w.time), level);
  act(w, p.id, { type: 'use', item: 'wine' });
  assert.equal(alcoholLevel(p, w.time), level + 28);
  for (let i = 0; i < 6; i++) act(w, p.id, { type: 'use', item: 'beer' });
  assert.equal(alcoholLevel(p, w.time), 100);
  const saved = JSON.parse(JSON.stringify(w));
  advance(saved, 1200);
  assert.equal(alcoholLevel(saved.players.p, saved.time), 0);
  assert.equal(impairment(saved.players.p, saved.time), 0);
  p.online = true;
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(alcoholLevel(p, w.time), 0);
});

test('steering weaves while moving, remains unchanged sober, and never turns a parked tractor', () => {
  const w = createWorld('weave', 'Weave', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  w.buildings = [];
  p.x = 0;
  p.z = 0;
  p.speed = 3;
  p.engine = true;
  const sober = structuredClone(p),
    tipsy = structuredClone(p);
  drinkAlcohol(tipsy, 'wine', w.time, 4);
  const input = { throttle: 1, steer: 0, boost: false };
  for (let i = 0; i < 60; i++) {
    w.time += 0.05;
    move(w, sober, input, 0.05);
    move(w, tipsy, input, 0.05);
  }
  assert.equal(sober.heading, p.heading);
  assert.ok(Math.abs(tipsy.heading - sober.heading) > 0.03);
  assert.ok(Math.abs(tipsy.x - sober.x) > 0.1);
  tipsy.speed = 0;
  const heading = tipsy.heading;
  move(w, tipsy, { ...input, throttle: 0 }, 0.1);
  assert.equal(tipsy.heading, heading);
});

test('homes and NPC self-care prefer nonalcoholic drinks, but beer-only pantry still counts', () => {
  const w = createWorld('pantry', 'Pantry', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  p.thirst = 30000;
  p.inventory = { beer: 2, water: 2 };
  assert.deepEqual(carePlan(w, p), [{ kind: 'act', action: { type: 'use', item: 'water' } }]);
  const stock = { beer: 20, water: 20 };
  feedShelterNow(w, p, stock);
  assert.equal(stock.beer, 20);
  assert.equal(alcoholLevel(p, w.time), 0);
  p.thirst = 30000;
  feedShelterNow(w, p, { beer: 20 }, 50);
  assert.ok(alcoholLevel(p, 50) > 0);
});

test('offline pantry drinking has the same decay timing as live ticks', () => {
  const w = createWorld('pub-home', 'Home', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  const b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  b.stock = { beer: 1000, bread: 1000 };
  w.buildings = [b];
  p.home = b.id;
  p.atHome = true;
  p.thirst = 29950;
  const ticks = structuredClone(w);
  advance(w, 3000);
  for (let i = 0; i < 300; i++) advance(ticks, 10);
  assert.ok(Math.abs(alcoholLevel(p, w.time) - alcoholLevel(ticks.players.p, ticks.time)) < 1e-5);
  assert.deepEqual(w.buildings[0].stock, ticks.buildings[0].stock);
});

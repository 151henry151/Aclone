// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { maximumHealth, nutritionEffects } from '../src/shared/nutrition.ts';
import { catalogueSchema } from '../src/shared/world-catalogue.ts';
test('food health and maximum health are bounded, visible effects and reset on death', () => {
  const w = createWorld('diet', 'Diet', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  w.catalogue = catalogueSchema.parse({
    items: {
      'custom:meal': {
        name: 'Balanced meal',
        weight: 1,
        price: 100,
        food: 10000,
        health: 1200,
        maxHealth: 100,
      },
    },
  });
  p.health = 50000;
  p.inventory['custom:meal'] = 1;
  act(w, p.id, { type: 'use', item: 'custom:meal' });
  assert.equal(p.health, 51200);
  assert.equal(maximumHealth(p), 60100);
  nutritionEffects(p, w.catalogue.items['custom:meal'], 100000);
  assert.equal(maximumHealth(p), 66000);
  assert.equal(p.health, 66000);
  p.online = true;
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(maximumHealth(p), 60000);
});
test('sheltered nutrition catches up identically across pantry exhaustion and death', () => {
  const w = createWorld('home-diet', 'Diet', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  w.buildings = [];
  w.catalogue = catalogueSchema.parse({
    items: {
      'custom:supper': {
        name: 'Supper',
        weight: 1,
        price: 100,
        food: 12000,
        drink: 8000,
        health: 600,
        maxHealth: 100,
      },
    },
  });
  const b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  b.stock = { 'custom:supper': 12, water: 15 };
  w.buildings.push(b);
  p.home = b.id;
  p.atHome = true;
  p.health = 20000;
  p.hunger = 29950;
  p.thirst = 29950;
  const ticks = structuredClone(w);
  advance(w, 90000);
  for (let i = 0; i < 1500; i++) advance(ticks, 60);
  const q = ticks.players.p;
  assert.equal(p.deaths, q.deaths);
  assert.ok(Math.abs(p.health - q.health) < 0.001);
  assert.ok(Math.abs(p.hunger - q.hunger) < 0.001);
  assert.ok(Math.abs(p.thirst - q.thirst) < 0.001);
  assert.deepEqual(w.buildings[0].stock, ticks.buildings[0].stock);
});
test('custom nutrition participates in NPC urgent self-care without a model call', async () => {
  const { carePlan } = await import('../src/server/npc/care.ts');
  const { lifeBriefing } = await import('../src/server/npc/strategy.ts');
  const w = createWorld('custom-care', 'Care', 'owner'),
    p = addPlayer(w, 'p', 'Pilot');
  w.catalogue = catalogueSchema.parse({
    items: {
      'custom:drink': { name: 'Spring cordial', weight: 1, price: 100, drink: 25000, health: 100 },
    },
  });
  p.inventory = { 'custom:drink': 1 };
  p.thirst = 35000;
  assert.deepEqual(carePlan(w, p), [
    { kind: 'act', action: { type: 'use', item: 'custom:drink' } },
  ]);
  assert.equal(lifeBriefing(w, p).survival.carried[0].nextDrink, 25000);
});

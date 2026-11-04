// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation';
import { maximumHealth, nutritionEffects, feedShelterNow } from '../src/shared/nutrition';
import { survivalRules } from '../src/shared/survival-rules';
import { catalogueSchema } from '../src/shared/world-catalogue';
import { homeProvisions } from '../src/shared/home-provisions';
import { combatSpawn } from '../src/shared/combat';
import { lifeBriefing, nextNutrition, secondsToDamage } from '../src/server/npc/strategy';
const defaults = {
  needsAutoFeedThreshold: 30000,
  needsDamageThreshold: 50000,
  baseMaximumHealth: 65000,
  nutritionAdjustmentLimit: 6000,
  repeatServingFrom: 3,
  repeatServingMultiplier: 0.5,
  energyRegeneration: 3000,
};
function fixture() {
  const w = createWorld('needs', 'Needs', 'owner');
  w.script = '';
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'owner', 'Owner');
  p.online = true;
  return { w, p };
}
test('survival defaults and old saves use the approved 65000 health baseline', () => {
  const { w, p } = fixture();
  for (const [key, value] of Object.entries(defaults))
    assert.equal((w.settings as any)[key], value, key);
  assert.equal(p.health, 65000);
  for (const key of Object.keys(defaults)) delete (w.settings as any)[key];
  for (const [key, value] of Object.entries(defaults))
    assert.equal((survivalRules(w.settings) as any)[key], value, key);
  assert.equal(maximumHealth(p, w), 65000);
  p.energy = 0;
  advance(w, 1);
  assert.equal(p.energy, 3000);
});
test('configured health and nutrition ceilings govern meals, regeneration, arena spawn and death', () => {
  const { w, p } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: { baseMaximumHealth: 40000, nutritionAdjustmentLimit: 800 },
  });
  assert.equal(addPlayer(w, 'new', 'New').health, 40000);
  const meal = { name: 'Meal', weight: 1, price: 1, health: 6000, maxHealth: 600 };
  nutritionEffects(p, meal, 100, w);
  assert.equal(p.nutrition, 800);
  assert.equal(p.health, 40800);
  assert.equal(maximumHealth(p, w), 40800);
  nutritionEffects(p, { ...meal, maxHealth: -600 }, 100, w);
  assert.equal(p.nutrition, -800);
  assert.equal(p.health, 39200);
  p.health = 1;
  combatSpawn(w, p);
  assert.equal(p.health, 39200);
  p.nutrition = 800;
  p.health = 40799;
  advance(w, 1);
  assert.equal(p.health, 40800);
  p.age = w.settings.maxAge;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(maximumHealth(p, w), 40000);
  assert.equal(p.health, 40000);
});
test('changed feeding threshold drives actual meals and the pantry exhaustion forecast', () => {
  const { w, p } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: { needsAutoFeedThreshold: 12000, needsDamageThreshold: 20000 },
  });
  const b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  b.stock = { water: 1 };
  w.buildings = [b];
  p.home = b.id;
  p.atHome = true;
  p.thirst = 11900;
  w.settings.thirstRate = 10;
  const estimate = homeProvisions(w, p)!;
  assert.equal(estimate.seconds, 12.5);
  const before = p.thirst;
  feedShelterNow(w, p, b.stock);
  assert.equal(p.thirst, before);
  advance(w, 12.5);
  // A boundary at the exact end is consumed at the next survival update.
  advance(w, 0.01);
  assert.equal(b.stock.water, 0);
  assert.ok(p.thirst < 12000);
  assert.deepEqual(homeProvisions(w, p), { seconds: 0, exhausted: 'drink' });
  p.thirst = 20000;
  const health = p.health;
  advance(w, 2);
  assert.equal(p.health, health - 12);
});
test('custom need boundaries preserve catch-up across empty stores, starvation and death', () => {
  const { w, p } = fixture();
  Object.assign(w.settings, {
    needsAutoFeedThreshold: 11000,
    needsDamageThreshold: 16000,
    baseMaximumHealth: 10000,
    nutritionAdjustmentLimit: 500,
    hungerRate: 20,
    thirstRate: 30,
  });
  w.buildings = [];
  p.online = false;
  p.health = 500;
  p.hunger = p.thirst = 10999;
  const ticks = structuredClone(w);
  advance(w, 600);
  for (let i = 0; i < 600; i++) advance(ticks, 1);
  const q = ticks.players[p.id];
  assert.ok(p.deaths > 0);
  for (const key of ['health', 'hunger', 'thirst', 'deaths'] as const)
    assert.ok(Math.abs(p[key] - q[key]) < 0.0001, key);
});
test('manual repeat penalty and resident predictions share the configured start and multiplier', () => {
  const { w, p } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: { repeatServingFrom: 2, repeatServingMultiplier: 0.25 },
  });
  w.catalogue = catalogueSchema.parse({
    items: { 'custom:meal': { name: 'Meal', weight: 1, price: 1, food: 1000 } },
  });
  p.inventory['custom:meal'] = 3;
  p.hunger = 10000;
  act(w, p.id, { type: 'use', item: 'custom:meal' });
  assert.equal(p.hunger, 9000);
  assert.equal(nextNutrition(p, 'custom:meal', w).food, 250);
  act(w, p.id, { type: 'use', item: 'custom:meal' });
  assert.equal(p.hunger, 8750);
  act(w, p.id, { type: 'settings', patch: { repeatServingFrom: 1, repeatServingMultiplier: 0 } });
  p.lastFood = '';
  assert.equal(nextNutrition(p, 'custom:meal', w).food, 0);
  act(w, p.id, { type: 'use', item: 'custom:meal' });
  assert.equal(p.hunger, 8750);
});
test('energy regeneration can change or stop and resident survival text uses live thresholds', () => {
  const { w, p } = fixture();
  act(w, p.id, {
    type: 'settings',
    patch: {
      energyRegeneration: 123,
      needsDamageThreshold: 40000,
      needsAutoFeedThreshold: 20000,
      baseMaximumHealth: 70000,
    },
  });
  p.energy = 0;
  advance(w, 2);
  assert.equal(p.energy, 246);
  act(w, p.id, { type: 'settings', patch: { energyRegeneration: 0 } });
  advance(w, 2);
  assert.equal(p.energy, 246);
  w.settings.thirstRate = 10;
  p.thirst = 39900;
  assert.equal(secondsToDamage(w, p), 10);
  const brief = lifeBriefing(w, p).survival;
  assert.match(brief.forecast, /40000/);
  assert.match(brief.forecast, /20000/);
  assert.match(brief.healthRule, /70000/);
});
test('need rules validate whole pairs atomically and survive editor, summary and design transfer', async () => {
  const { w, p } = fixture();
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const html = settingsFields(w.settings);
  for (const key of Object.keys(defaults)) assert.ok(html.includes(`name="${key}"`), key);
  for (const patch of [
    { needsAutoFeedThreshold: 50000 },
    { needsDamageThreshold: 25000 },
    { baseMaximumHealth: 0 },
    { nutritionAdjustmentLimit: 65000 },
    { repeatServingFrom: 1.5 },
    { repeatServingMultiplier: 1.1 },
    { energyRegeneration: -1 },
  ]) {
    const before = structuredClone(w.settings);
    assert.throws(() =>
      act(w, p.id, { type: 'settings', patch: { schoolFirstPrice: 1, ...patch } }),
    );
    assert.deepEqual(w.settings, before);
  }
  act(w, p.id, {
    type: 'settings',
    patch: {
      needsDamageThreshold: 19000,
      needsAutoFeedThreshold: 18000,
      baseMaximumHealth: 45678,
      nutritionAdjustmentLimit: 500,
      repeatServingFrom: 4,
      repeatServingMultiplier: 0.2,
      energyRegeneration: 77,
    },
  });
  const summary = rulesSummary(w);
  for (const value of ['18000', '19000', '45678', '500', '4', '0.2', '77'])
    assert.ok(summary.includes(value), value);
  const dest = createWorld('dest', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  for (const key of Object.keys(defaults))
    assert.equal((dest.settings as any)[key], (w.settings as any)[key]);
});

test('caretaker health and need meters use the same configured limits', async () => {
  const { w, p } = fixture();
  Object.assign(w.settings, {
    baseMaximumHealth: 40000,
    needsDamageThreshold: 20000,
    needsAutoFeedThreshold: 12000,
  });
  Object.assign(p, { health: 20000, hunger: 10000, thirst: 10000 });
  const { caretakerView } = await import('../src/shared/caretaker');
  const { caretakerBody } = await import('../src/client/caretaker');
  const view = caretakerView(w);
  const html = caretakerBody(view, { tab: 'Residents', query: '', selected: p.id }, 100);
  assert.match(html, /class="health" style="width:50%"/);
  assert.match(html, /class="hunger" style="width:50%"/);
  assert.match(html, /class="thirst" style="width:50%"/);
});

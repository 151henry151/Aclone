// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { surveySprings, prepareWaterSources } from '../src/shared/springs';
import { terrainHeight } from '../src/shared/terrain';
import { waterSourceRules } from '../src/shared/water-source-rules';

test('the frozen public spring survey is deterministic, upland biased and includes every river head', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  expandPuddlewickIsland(w);
  const springs = surveySprings(w);
  assert.deepEqual(surveySprings(w), springs);
  assert.ok(
    springs.length >= 25 && springs.length <= 35,
    `expected 25–35 springs, got ${springs.length}`,
  );
  for (const river of w.northernIsland!.rivers) {
    const head = springs.find((s) => s.river === river.id);
    assert.ok(head, `spring at ${river.id}`);
    assert.equal(head.x, river.points[0].x);
    assert.equal(head.z, river.points[0].z);
    assert.equal(head.flow, waterSourceRules(w.settings).springHeadwaterFlow);
  }
  const ordinary = springs.filter((s) => !s.river);
  assert.ok(
    ordinary.filter((s) => terrainHeight(w, s.x, s.z) - w.settings.seaLevel > 100).length >
      ordinary.length / 2,
  );
  for (let i = 0; i < ordinary.length; i++)
    for (const other of springs)
      if (other.id !== ordinary[i].id)
        assert.ok(
          Math.hypot(other.x - ordinary[i].x, other.z - ordinary[i].z) >=
            waterSourceRules(w.settings).springSpacing,
        );
  assert.equal(prepareWaterSources(w), true);
  const frozen = structuredClone(w.springs);
  w.terrain.push({ x: 0, z: 0, radius: 100, height: 100 });
  assert.equal(prepareWaterSources(w), false);
  assert.deepEqual(w.springs, frozen);
});

import { addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { constructionSiteReason } from '../src/shared/construction-site';
test('the survey and ordinary construction share the configurable existing foundation-rise limit', () => {
  const w = createWorld('rise', 'Rise', 'owner');
  w.buildings = [];
  Object.assign(w.settings, { seaLevel: -20, mapSize: 500 });
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => (i % 33) * 0.5),
  };
  const p = addPlayer(w, 'owner', 'Builder'),
    b = makeBuilding('test', 'waterworks', 150, 0);
  assert.equal(constructionSiteReason(w, b), undefined);
  act(w, p.id, { type: 'settings', patch: { constructionMaximumRise: 0.2 } });
  assert.match(constructionSiteReason(w, b) ?? '', /0\.2 metres/);
});

import { Store } from '../src/server/store';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { worldItems } from '../src/shared/world-catalogue';
test('spring identities, author edits and legacy intakes survive saves and portable designs', () => {
  const w = createWorld('custom-source', 'Custom sources', 'owner');
  w.buildings = [];
  Object.assign(w.settings, {
    mapSize: 5000,
    springLowChance: 1,
    springHighChance: 1,
    springTargetCount: 6,
  });
  w.terrainMapSize = 5000;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(30),
  };
  const old = makeBuilding('old', 'waterworks', 100, 100);
  old.stock = { fuel: 9, water: 42 };
  old.owner = 'private';
  w.buildings.push(old);
  assert.equal(prepareWaterSources(w), true);
  assert.equal(w.springs!.length, 6);
  assert.equal(old.legacyWaterIntake, true);
  const original = structuredClone(w.springs);
  w.springs!.pop();
  w.springs!.push({ id: 'spring-hand-authored', x: 500, z: 500, flow: 0.9 });
  const edited = structuredClone(w.springs),
    store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.deepEqual(loaded.springs, edited);
    assert.equal(prepareWaterSources(loaded), false);
    assert.deepEqual(loaded.buildings[0], old);
  } finally {
    store.close();
  }
  const design = exportDesign(w),
    other = createWorld('other-source', 'Other', 'other');
  applyDesign(other, design);
  assert.deepEqual(other.springs, edited);
  assert.equal(prepareWaterSources(other), false);
  assert.equal(other.buildings[0].legacyWaterIntake, true);
  assert.notDeepEqual(original, edited);
});
test('a disabled first survey stays empty and ordinary surveys obey configured geography', () => {
  const w = createWorld('disabled-source', 'Disabled', 'owner');
  w.settings.springsEnabled = false;
  assert.deepEqual(surveySprings(w), []);
  prepareWaterSources(w);
  assert.deepEqual(w.springs, []);
  w.settings.springsEnabled = true;
  assert.equal(prepareWaterSources(w), false);
  assert.deepEqual(w.springs, []);
});
test('spring drinking applies one world Water relief with no item and a persistent cooldown', () => {
  const w = createWorld('drink-source', 'Spring', 'owner'),
    p = addPlayer(w, 'owner', 'Hiker');
  w.springs = [{ id: 'spring-test', x: 100, z: 0, flow: 1 }];
  w.waterSourcesVersion = 1;
  Object.assign(p, { vehicle: 5, x: 100, z: 0, thirst: 10000 });
  const before = structuredClone(p.inventory),
    relief = worldItems(w).water.drink!;
  act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' });
  assert.equal(p.thirst, Math.max(0, 10000 - relief));
  assert.deepEqual(p.inventory, before);
  assert.throws(
    () => act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' }),
    /20|wait|cooldown/i,
  );
  w.time += 20;
  p.vehicle = 0;
  assert.throws(() => act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' }), /foot/i);
  p.vehicle = 5;
  p.x += 4;
  assert.throws(
    () => act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' }),
    /near|reach|3 m/i,
  );
  p.x = 100;
  w.settings.springDrinkingEnabled = false;
  assert.throws(() => act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' }), /disabled/i);
  w.settings.springDrinkingEnabled = true;
  w.settings.springsEnabled = false;
  assert.throws(() => act(w, p.id, { type: 'drinkSpring', spring: 'spring-test' }), /disabled/i);
});

import { settingsFields, creatorPanel } from '../src/client/creator-editor';
import { springPanel } from '../src/client/spring-panel';
import { mapIcon } from '../src/client/map-icons';
import { waterSourceRuleFields } from '../src/shared/water-source-rules';
test('world builders edit and delete frozen springs with validated coordinates and portable rules', () => {
  const w = createWorld('author-springs', 'Springs', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.springs = [];
  prepareWaterSources(w);
  act(w, p.id, {
    type: 'spring',
    operation: 'save',
    id: 'spring-handmade',
    x: 100,
    z: 100,
    flow: 0.8,
  });
  assert.deepEqual(
    w.springs?.find((s) => s.id === 'spring-handmade'),
    { id: 'spring-handmade', x: 100, z: 100, flow: 0.8 },
  );
  const before = JSON.stringify(w);
  assert.throws(() =>
    act(w, p.id, { type: 'spring', operation: 'save', id: 'bad', x: Infinity, z: 100, flow: 99 }),
  );
  assert.equal(JSON.stringify(w), before);
  const stranger = addPlayer(w, 'visitor', 'Visitor');
  assert.throws(() =>
    act(w, stranger.id, { type: 'spring', operation: 'delete', id: 'spring-handmade' }),
  );
  const html = creatorPanel(w, p, 'Springs');
  assert.match(html, /spring-handmade/);
  assert.match(html, /Delete spring/);
  const fields = settingsFields(w.settings);
  for (const key of Object.keys(waterSourceRuleFields))
    assert.equal(fields.split(`name="${key}"`).length - 1, 1, key);
  act(w, p.id, { type: 'spring', operation: 'delete', id: 'spring-handmade' });
  assert.ok(!w.springs?.some((s) => s.id === 'spring-handmade'));
  assert.match(creatorPanel(w, p, 'Springs'), /No springs/);
});
test('spring inventory UI explains empty, disabled, out-of-range and cooldown states with distinct map symbols', () => {
  const w = createWorld('spring-ui', 'UI', 'owner'),
    p = addPlayer(w, 'owner', 'Hiker');
  w.springs = [];
  assert.match(springPanel(w, p), /No springs/);
  w.settings.springsEnabled = false;
  assert.match(springPanel(w, p), /disabled/);
  w.settings.springsEnabled = true;
  w.springs = [{ id: 'spring-ui', x: 100, z: 100, flow: 1 }];
  Object.assign(p, { x: 100, z: 100, vehicle: 5, thirst: 30000 });
  assert.match(springPanel(w, p), /Drink from the spring/);
  act(w, p.id, { type: 'drinkSpring', spring: 'spring-ui' });
  assert.match(springPanel(w, p), /20 seconds/);
  p.x = 110;
  assert.match(springPanel(w, p), /within 3/);
  assert.notEqual(mapIcon('spring'), mapIcon('waterworks'));
  assert.notEqual(mapIcon('pumpHouse'), mapIcon('waterworks'));
});

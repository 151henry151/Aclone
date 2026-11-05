// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation';
import {
  calendar,
  seasonAt,
  weatherAt,
  DAY_SECONDS,
  advanceClimate,
} from '../src/shared/environment';
import { celestialAt, solarDirectionAt } from '../src/shared/astronomy';
import { oceanWeather, waterLevel } from '../src/shared/ocean';
import { winterDeadline, cropStatus, expireFarmCrops } from '../src/shared/farming';
import defaults from '../data/settings.json';
import { Store } from '../src/server/store';
const normal = {
  calendarYearDays: 365,
  calendarSpringDay: 59,
  calendarSpringDays: 92,
  calendarSummerDays: 92,
  calendarAutumnDays: 91,
};
const custom = {
  calendarYearDays: 120,
  calendarSpringDay: 10,
  calendarSpringDays: 30,
  calendarSummerDays: 40,
  calendarAutumnDays: 30,
};
function setup() {
  const w = createWorld('calendar-baseline', 'Calendar workshop', 'owner');
  w.script = '';
  const p = addPlayer(w, 'owner', 'Owner');
  return { w, p };
}
const patch = (w: ReturnType<typeof setup>['w'], values: Record<string, number>) =>
  act(w, 'owner', { type: 'settings', patch: values });
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('default and missing year fields reproduce the recorded calendar, weather and sky exactly', () => {
  const { w } = setup();
  for (const [key, value] of Object.entries(normal))
    assert.equal((w.settings as any)[key], value, key);
  const fingerprints = {
    calendar: hash(
      Array.from({ length: 740 }, (_, i) => calendar({ time: i * DAY_SECONDS + 0.125 })),
    ),
    seasons: hash(Array.from({ length: 740 }, (_, i) => seasonAt(i - 10))),
    weather: hash(
      Array.from({ length: 740 }, (_, i) =>
        [0.1, 0.5, 0.9].map((f) => weatherAt('calendar-baseline', i, f)),
      ),
    ),
    sky: hash(
      Array.from({ length: 23 }, (_, i) => [3600, 43200, 72000].map((t) => celestialAt(i * 17, t))),
    ),
  };
  assert.deepEqual(fingerprints, {
    calendar: 'f73f49903e2cabb4378eff07897eb9dd265e045cf0a4006c4a1979bfe3dd3c3d',
    seasons: '763f68d39bafb9f62a206c38d5f588d79bbc385b650b656b7ce59857ae1f1162',
    weather: 'af65e9d3c5a0d8f3fc1e7ee8354e0062665f609639484fdb8ed232e242548d48',
    sky: '9066c589798c0b11c25e6c3b10b3b1736237f02c53e1eeb62cf416a684f60bd6',
  });
  for (const key of Object.keys(normal)) delete (w.settings as any)[key];
  for (const time of [0, 600, 365 * 600, 800 * 600]) {
    w.time = time;
    assert.deepEqual(calendar(w), calendar({ time }));
  }
});

test('custom seasons wrap, begin new worlds in spring and reject impossible calendars atomically', () => {
  const { w, p } = setup();
  const beforePlayer = structuredClone(p);
  patch(w, custom);
  assert.deepEqual(p, beforePlayer);
  assert.equal(w.time, 0);
  for (const [day, season] of [
    [-1, 'Winter'],
    [0, 'Winter'],
    [9, 'Winter'],
    [10, 'Spring'],
    [39, 'Spring'],
    [40, 'Summer'],
    [79, 'Summer'],
    [80, 'Autumn'],
    [109, 'Autumn'],
    [110, 'Winter'],
    [119, 'Winter'],
    [120, 'Winter'],
    [130, 'Spring'],
  ] as const)
    assert.equal(seasonAt(day, w.settings), season, String(day));
  assert.deepEqual(calendar(w), { absoluteDay: 10, dayOfYear: 10, year: 1, season: 'Spring' });
  w.time = 120 * DAY_SECONDS;
  assert.deepEqual(calendar(w), { absoluteDay: 130, dayOfYear: 10, year: 2, season: 'Spring' });
  for (const values of [
    { calendarYearDays: 3 },
    { calendarYearDays: 3651 },
    { calendarYearDays: 100 },
    { calendarSpringDay: 21 },
    { calendarSpringDays: 0 },
    { calendarSummerDays: 1.5 },
    { calendarAutumnDays: Infinity },
    { calendarYearDays: NaN },
  ] as Record<string, number>[]) {
    const before = structuredClone(w);
    assert.throws(() => patch(w, values));
    assert.deepEqual(w, before);
  }
});

test('season lengths govern crop winter deadlines and preserve snow/time on edits', () => {
  const { w } = setup();
  w.climate = { snow: 0, wetness: 0.3, snowDepth: 0.2, snowModel: 1 };
  const snow = structuredClone(w.climate);
  patch(w, custom);
  assert.deepEqual(w.climate, snow);
  assert.equal(w.time, 0);
  const deadline = winterDeadline(0, w.settings),
    expected = (110 - 10 - defaults.time / 86400) * DAY_SECONDS;
  assert.ok(Math.abs(deadline - expected) < 1e-8);
  assert.equal(calendar({ time: deadline - 0.001, settings: w.settings }).season, 'Autumn');
  assert.equal(calendar({ time: deadline, settings: w.settings }).season, 'Winter');
  assert.equal(winterDeadline(100 * DAY_SECONDS, w.settings), 100 * DAY_SECONDS);
  assert.ok(
    Math.abs(winterDeadline(120 * DAY_SECONDS, w.settings) - deadline - 120 * DAY_SECONDS) < 1e-8,
  );
  const farm = makeBuilding('test-farm', 'farm', 60, 60);
  farm.plots = [];
  assert.equal(cropStatus(w, farm, 0).state, 'empty');
  farm.plots = [{ crop: 'wheat', planted: 0, ready: 1, water: 0, fertilized: false }];
  w.time = deadline - 0.01;
  assert.equal(cropStatus(w, farm, 0).state, 'ripe');
  w.time = deadline + 1;
  assert.equal(cropStatus(w, farm, 0).state, 'withered');
  expireFarmCrops(w, farm);
  assert.equal(farm.plots[0].crop, undefined);
  assert.equal(farm.plots[0].winterLoss, 'wheat');
});

test('custom seasons align daylight and weather while lunar timing and tides stay independent', () => {
  const { w } = setup();
  w.settings.tidalRange = 2;
  const tide = waterLevel(w);
  const noon = 43200,
    offset = defaults.time / 86400;
  const original = celestialAt(59 + offset - noon / 86400, noon, w.settings);
  patch(w, custom);
  const edited = celestialAt(10 + offset - noon / 86400, noon, w.settings);
  for (let i = 0; i < 2; i++)
    assert.ok(Math.abs(original.moons[i].illuminated - edited.moons[i].illuminated) < 1e-12);
  assert.equal(waterLevel(w), tide);
  assert.ok(solarDirectionAt(60, noon, w.settings)[1] > solarDirectionAt(115, noon, w.settings)[1]);
  assert.equal(weatherAt(w.id, 60, 0.5, w.settings).season, 'Summer');
  assert.equal(weatherAt(w.id, 115, 0.5, w.settings).season, 'Winter');
  const before = structuredClone(w.climate),
    time = w.time;
  patch(w, { calendarSummerDays: 35 });
  assert.deepEqual(w.climate, before);
  assert.equal(w.time, time);
});

test('calendar edits invalidate ocean weather immediately and custom snow catch-up remains additive', () => {
  const { w } = setup();
  patch(w, { climateSpringWetChance: 0, climateSummerWetChance: 1 });
  w.time = 30 * DAY_SECONDS;
  const before = oceanWeather(w);
  patch(w, custom);
  const after = oceanWeather(w);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, oceanWeather(structuredClone(w)));
  assert.equal(oceanWeather(w), after, 'unchanged cache inputs reuse the result');
  const a = setup().w;
  patch(a, custom);
  a.settings.dayLength = 0;
  a.settings.time = 43200;
  const b = structuredClone(a),
    end = 130 * DAY_SECONDS;
  advanceClimate(a, 0, end);
  advanceClimate(b, 0, 50 * DAY_SECONDS);
  advanceClimate(b, 50 * DAY_SECONDS, end);
  assert.ok(Math.abs(a.climate!.snowDepth! - b.climate!.snowDepth!) < 1e-8);
  assert.ok(Math.abs(a.climate!.wetness - b.climate!.wetness) < 1e-8);
});

test('year rules survive creation, editor, summary, observations, saved worlds and design imports', async () => {
  const { w, p } = setup();
  patch(w, custom);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign, configureRules } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  for (const [key, value] of Object.entries(custom))
    assert.match(settingsFields(w.settings), new RegExp(`name="${key}"[^>]*value="${value}"`));
  assert.match(settingsFields(w.settings), /Winter[^<]*20|20[^<]*winter/i);
  assert.match(rulesSummary(w), /120.*30.*40.*30.*20/);
  const dest = createWorld('copy', 'Copy', 'other');
  applyDesign(dest, exportDesign(w));
  const fresh = createWorld('new', 'New', 'other');
  configureRules(fresh, custom);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const observed = observe(
      w,
      p,
      { plan: [], index: 0 } as any,
      new NpcMemory(store),
      'resident',
    ).worldRules;
    for (const values of [dest.settings, fresh.settings, loaded.settings, observed])
      for (const [key, value] of Object.entries(custom))
        assert.equal((values as any)[key], value, key);
    const bad = exportDesign(w);
    bad.settings.calendarYearDays = 100;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});

test('future ageing and online building wear follow the year without rewriting ages', () => {
  const { w, p } = setup();
  patch(w, custom);
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  const home = makeBuilding('home', 'home', 60, 60);
  home.owner = p.id;
  home.condition = 100;
  w.buildings = [home];
  p.online = true;
  p.age = 20;
  const age = p.age;
  advance(w, DAY_SECONDS);
  assert.ok(Math.abs(p.age - age - 1 / 120) < 1e-10);
  assert.ok(Math.abs(home.condition - (100 - 100 / (160 * 120))) < 1e-9);
  const currentAge = p.age;
  patch(w, { calendarYearDays: 240 });
  assert.equal(p.age, currentAge);
  advance(w, DAY_SECONDS);
  assert.ok(Math.abs(p.age - currentAge - 1 / 240) < 1e-10);
});

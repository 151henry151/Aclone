// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance } from '../src/shared/simulation.ts';
import { calendar, weatherAt, sunAt } from '../src/shared/environment.ts';
test('calendar preserves ten-minute days and a 365-day year with a spring start', () => {
  const w = createWorld('t', 'Weather', 'o');
  assert.equal(calendar(w).season, 'Spring');
  const start = calendar(w).absoluteDay;
  advance(w, 600);
  assert.equal(calendar(w).absoluteDay, start + 1);
  advance(w, 365 * 600);
  assert.equal(calendar(w).year, 2);
});
test('seasons and deterministic weather span winter snow and warmer rain', () => {
  assert.equal(weatherAt('t', 0).season, 'Winter');
  assert.equal(weatherAt('t', 70).season, 'Spring');
  assert.equal(weatherAt('t', 180).season, 'Summer');
  assert.equal(weatherAt('t', 280).season, 'Autumn');
  assert.deepEqual(weatherAt('t', 180), weatherAt('t', 180));
  assert.ok(weatherAt('t', 0).snowCover > 0.5);
  assert.equal(weatherAt('t', 180).snowCover, 0);
  const year = Array.from({ length: 365 }, (_, day) => weatherAt('t', day));
  assert.ok(year.some((d) => d.precipitation === 'snow'));
  assert.ok(year.some((d) => d.precipitation === 'rain'));
  assert.ok(year.some((d) => d.precipitation === 'clear'));
});
test('sun rises in the east, sets in the west, and gives winter shorter daylight', () => {
  const dawn = sunAt(21600, 80),
    noon = sunAt(43200, 80),
    dusk = sunAt(64800, 80),
    night = sunAt(0, 80);
  assert.ok(dawn.direction[0] > 0);
  assert.ok(dusk.direction[0] < 0);
  assert.ok(noon.daylight > 0.8);
  assert.equal(night.daylight, 0);
  assert.ok(sunAt(25200, 0).daylight < sunAt(25200, 180).daylight);
});
test('midnight has no second winter twilight and calendar dates roll over at midnight', () => {
  for (let day = 0; day < 365; day++) {
    assert.equal(sunAt(0, day).daylight, 0);
    assert.equal(sunAt(0, day).twilight, 0);
  }
  const w = createWorld('clock', 'Clock', 'o');
  const start = calendar(w).absoluteDay;
  const untilMidnight = ((86400 - w.settings.time) / 86400) * 600;
  advance(w, untilMidnight + 0.01);
  assert.equal(calendar(w).absoluteDay, start + 1);
  assert.ok(w.settings.time < 10);
});

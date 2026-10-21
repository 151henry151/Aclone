// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation.ts';
import { defaults } from '../src/shared/catalog.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import {
  advanceClimate,
  weatherAt,
  worldWeather,
  snowDepth,
  DAY_SECONDS,
  WINTER_BASE_SNOW,
  NORMAL_STORM_SNOW,
} from '../src/shared/environment.ts';

const offset = 59 + defaults.time / 86400;
function world(day = 375, weather = 'clear') {
  const w = createWorld('snow-test', 'Snow', 'owner');
  w.time = (day - offset) * DAY_SECONDS;
  w.settings.time = 0;
  w.settings.dayLength = DAY_SECONDS;
  w.creator = creatorSchema.parse({ weather });
  return w;
}
function run(w: ReturnType<typeof world>, seconds: number) {
  advanceClimate(w, w.time, w.time + seconds);
  w.time += seconds;
  if (w.settings.dayLength > 0)
    w.settings.time = (w.settings.time + (seconds / w.settings.dayLength) * 86400) % 86400;
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
test('winter alone creates no snow; snowfall accumulates gradually and stacks across storms', () => {
  const w = world();
  run(w, 600);
  assert.equal(w.climate!.snowDepth, 0);
  w.creator!.weather = 'snowstorm';
  run(w, 1);
  const dust = snowDepth(w.climate);
  assert.ok(dust > 0 && dust < 0.002);
  assert.ok(w.climate!.snow > 0 && w.climate!.snow < 1);
  run(w, 149);
  near(snowDepth(w.climate), 0.12);
  run(w, 300);
  near(snowDepth(w.climate), 0.36);
  run(w, 1800);
  assert.ok(snowDepth(w.climate) > 1, 'consecutive storms exceed the old coverage cap');
});
test('one full sunny day removes one normal storm; winter base survives unlimited sun', () => {
  const w = world();
  w.climate = {
    snow: 1,
    wetness: 0,
    snowDepth: WINTER_BASE_SNOW + 3 * NORMAL_STORM_SNOW,
    winterBase: WINTER_BASE_SNOW,
  };
  run(w, 600);
  near(snowDepth(w.climate), WINTER_BASE_SNOW + 2 * NORMAL_STORM_SNOW);
  run(w, 600);
  near(snowDepth(w.climate), WINTER_BASE_SNOW + NORMAL_STORM_SNOW);
  run(w, 600);
  near(snowDepth(w.climate), WINTER_BASE_SNOW);
  run(w, 20 * 600);
  near(snowDepth(w.climate), WINTER_BASE_SNOW);
});
test('night, overcast days and rain never melt snow; frozen or slowed sky clocks are respected', () => {
  const w = world();
  w.climate = { snow: 1, wetness: 0, snowDepth: 0.4, winterBase: 0.04 };
  run(w, 80); // winter early morning, before sunrise
  near(snowDepth(w.climate), 0.4);
  w.creator!.weather = 'rain';
  run(w, 1200);
  near(snowDepth(w.climate), 0.4);
  w.creator!.weather = 'natural';
  const day = Array.from({ length: 50 }, (_, i) => 370 + i).find(
    (d) => weatherAt(w.id, d).clouds >= 0.6 && weatherAt(w.id, d).precipitation === 'clear',
  )!;
  assert.ok(day);
  w.time = (day - offset) * 600;
  w.settings.time = 43200;
  run(w, 1); // cloudy noon, between the day's storm boundaries
  assert.ok(snowDepth(w.climate) >= 0.4);
  w.creator!.weather = 'clear';
  w.settings.dayLength = 0;
  w.settings.time = 0;
  run(w, 600);
  const nightDepth = snowDepth(w.climate);
  near(nightDepth, 0.4);
  w.settings.time = 43200;
  run(w, 30);
  assert.ok(snowDepth(w.climate) < nightDepth);
});
test('winter base only thaws in spring and never vanishes at a season boundary', () => {
  const w = world(423); // February 28, then spring at day 424
  w.climate = { snow: 1, wetness: 0, snowDepth: 0.04, winterBase: 0.04 };
  run(w, 600);
  near(snowDepth(w.climate), 0.04);
  run(w, 60); // spring midnight remains dark
  near(snowDepth(w.climate), 0.04);
  assert.equal(w.climate!.winterBase, 0);
  run(w, 540);
  near(snowDepth(w.climate), 0);
});
test('offline integration, irregular live ticks and a JSON restart agree across seasons', () => {
  const a = world(690, 'natural'),
    b = structuredClone(a);
  const elapsed = 110 * 600;
  run(a, elapsed);
  let left = elapsed,
    i = 0;
  while (left > 0) {
    const dt = Math.min(left, [0.17, 9.3, 151.1, 599.9][i++ % 4]);
    run(b, dt);
    left -= dt;
    if (i === 150) Object.assign(b, JSON.parse(JSON.stringify(b)));
  }
  near(snowDepth(a.climate), snowDepth(b.climate));
  near(a.climate!.wetness, b.climate!.wetness);
  near(a.climate!.winterBase!, b.climate!.winterBase!);
  assert.deepEqual(worldWeather(a, 800), worldWeather(b, 800));
});
test('old saves keep their existing thin cover without conjuring deep drifts', () => {
  const w = world();
  w.climate = { snow: 0.5, wetness: 0.2 };
  near(snowDepth(w.climate), 0.02);
  run(w, 600);
  near(snowDepth(w.climate), 0.02);
  assert.equal(w.climate!.winterBase, 0.02);
});
test('seeded weather varies by winter and world; long/heavy storms are rarer and not rerolled', () => {
  const counts: number[] = [],
    depths: number[] = [];
  for (let year = 1; year <= 30; year++) {
    let snowy = 0;
    for (let day = year * 365 - 31; day < year * 365 + 59; day++) {
      for (let step = 0; step < 8; step++) {
        const v = weatherAt('random-winter', day, step / 8);
        assert.deepEqual(v, weatherAt('random-winter', day, step / 8));
        if (v.precipitation === 'snow') {
          snowy++;
          depths.push(v.snowfallPerDay);
        }
      }
    }
    counts.push(snowy);
  }
  assert.ok(Math.max(...counts) > Math.min(...counts) * 1.6);
  assert.ok(depths.filter((d) => d < 0.3).length > depths.filter((d) => d > 0.5).length * 2);
  assert.notDeepEqual(weatherAt('one-world', 375), weatherAt('another-world', 375));
});

test('nonstandard sky-clock speeds preserve offline/live thaw equivalence', () => {
  for (const dayLength of [240, 1800, 0]) {
    const a = world(450),
      b = structuredClone(a);
    for (const w of [a, b]) {
      w.settings.dayLength = dayLength;
      w.settings.time = 21600;
      w.climate = { snow: 1, snowDepth: 0.2, winterBase: 0, wetness: 1 };
    }
    run(a, 1500);
    for (let i = 0; i < 150; i++) run(b, 10);
    near(snowDepth(a.climate), snowDepth(b.climate));
    near(a.climate!.wetness, b.climate!.wetness);
  }
});

test('new storm timing retains the previous rain share for farm seasons', () => {
  for (const [first, last, low, high] of [
    [151, 243, 0.31, 0.46],
    [243, 320, 0.46, 0.62],
  ]) {
    let wet = 0,
      total = 0;
    for (let year = 0; year < 12; year++)
      for (let day = first; day < last; day++)
        for (let s = 0; s < 8; s++) {
          const weather = weatherAt('crop-rainfall', year * 365 + day, s / 8);
          total++;
          if (weather.precipitation === 'rain') wet++;
        }
    assert.ok(wet / total > low && wet / total < high, `${wet / total} outside ${low}–${high}`);
  }
});

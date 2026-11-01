// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alpineWeather, permanentSnowCover } from '../src/shared/alpine-weather';
import { createWorld } from '../src/shared/simulation';
import { worldWeather } from '../src/shared/environment';
import { defaultCreator } from '../src/shared/creator';
import type { NorthernIsland } from '../src/shared/northern-island';
const w = createWorld('puddlewick', 'Puddlewick', 'server');
w.northernIsland = { version: 1 } as NorthernIsland;
w.creator = defaultCreator();
test('summer rain becomes summit snow while lowlands retain their weather', () => {
  w.creator!.weather = 'rain';
  const base = worldWeather(w, 190);
  assert.equal(base.precipitation, 'rain');
  assert.equal(alpineWeather(w, base, w.settings.seaLevel + 100), base);
  const top = alpineWeather(w, base, w.settings.seaLevel + 1400);
  assert.equal(top.precipitation, 'snow');
  assert.ok(top.temperature < 0);
  assert.equal(top.intensity, base.intensity);
  assert.equal(top.storm, base.storm);
  assert.ok(top.snowfallPerDay > 0);
});
test('summit cover remains through every season and clear weather does not create snowfall', () => {
  for (const day of [10, 100, 190, 290]) {
    w.creator!.weather = 'clear';
    assert.equal(
      alpineWeather(w, worldWeather(w, day), w.settings.seaLevel + 1424).precipitation,
      'clear',
    );
    assert.equal(permanentSnowCover(w, w.settings.seaLevel + 1424), 1);
    assert.equal(permanentSnowCover(w, w.settings.seaLevel + 900), 0);
  }
});
test('alpine transition is gradual, uses sea datum, and leaves other worlds unchanged', () => {
  w.creator!.weather = 'thunderstorm';
  const weather = worldWeather(w, 190);
  let previous = weather.temperature;
  for (let height = 450; height <= 1450; height++) {
    const next = alpineWeather(w, weather, w.settings.seaLevel + height).temperature;
    assert.ok(next <= previous + 1e-9);
    assert.ok(previous - next < 0.2);
    previous = next;
  }
  const other = { ...w, northernIsland: undefined };
  assert.equal(alpineWeather(other, weather, 5000), weather);
  assert.equal(permanentSnowCover(other, 5000), 0);
  const raised = { ...w, settings: { ...w.settings, seaLevel: 300 } };
  assert.deepEqual(
    alpineWeather(raised, weather, 1700),
    alpineWeather(w, weather, w.settings.seaLevel + 1400),
  );
});

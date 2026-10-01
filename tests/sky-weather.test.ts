// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celestialAt } from '../src/shared/astronomy.ts';
import { cloudOpacity, nightIllumination } from '../src/client/sky-weather.ts';
test('clouds suppress ground starlight and moonlight; daylight and set moons do not add night light', () => {
  const full = celestialAt(9, 0);
  const clear = nightIllumination(full, 0, 0),
    covered = nightIllumination(full, 1, 0);
  assert.ok(clear.moonlight > 0.1);
  assert.ok(clear.ambient > 0.01);
  assert.ok(covered.moonlight < clear.moonlight * 0.01);
  assert.ok(covered.ambient < clear.ambient * 0.1);
  const day = nightIllumination(celestialAt(80, 43200), 0, 0);
  assert.equal(day.moonlight, 0);
  assert.equal(day.ambient, 0);
  const below = {
    ...full,
    moons: full.moons.map((m) => ({ ...m, direction: [0, -1, 0] as [number, number, number] })),
  };
  assert.equal(nightIllumination(below, 0, 0).moonlight, 0);
  assert.ok(nightIllumination(below, 0, 0).ambient > 0); // Starlight remains.
});
test('a drifting cloud crossing the moons attenuates their directional light', () => {
  const sky = celestialAt(9, 0);
  const samples = Array.from({ length: 100 }, (_, i) => {
    const drift = i * 0.13;
    return {
      cover: cloudOpacity(sky.moons[0].direction, 0.6, drift),
      light: nightIllumination(sky, 0.6, drift).moonlight,
    };
  });
  const open = samples.filter((s) => s.cover < 0.1),
    blocked = samples.filter((s) => s.cover > 0.9);
  assert.ok(open.length > 0 && blocked.length > 0);
  assert.ok(Math.max(...blocked.map((s) => s.light)) < Math.min(...open.map((s) => s.light)));
});

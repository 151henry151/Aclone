// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celestialAt } from '../src/shared/astronomy.ts';
import { cloudCoordinates, cloudOpacity, nightIllumination } from '../src/client/sky-weather.ts';
test('cloud projection keeps horizon perspective instead of stretching a frozen texture column', () => {
  const ray = (h: number): [number, number, number] => [Math.sqrt(1 - h * h), h, 0];
  // Even below the former 0.08 cutoff, successive elevations cross different
  // parts of the layer. A clamped plane barely changes texture coordinates here.
  assert.ok(cloudCoordinates(ray(0.02), 0)[0] - cloudCoordinates(ray(0.06), 0)[0] > 2);
  let previous = cloudCoordinates(ray(0), 0)[0];
  for (let h = 0.001; h <= 1; h += 0.001) {
    const [u, v] = cloudCoordinates(ray(h), 0);
    assert.ok(Number.isFinite(u) && Number.isFinite(v));
    assert.ok(u < previous, 'clouds foreshorten continuously toward the horizon');
    assert.ok(previous - u < 0.2, 'no projection seam or abrupt horizon cutoff');
    previous = u;
    const alpha = cloudOpacity(ray(h), 0.5, 0.3);
    assert.ok(alpha >= 0 && alpha <= 1);
  }
  const d: [number, number, number] = [0.6, 0, 0.8];
  const still = cloudCoordinates(d, 0),
    moving = cloudCoordinates(d, 0.75);
  assert.equal(moving[0] - still[0], 0.75);
  assert.equal(moving[1], still[1]);
  assert.equal(cloudOpacity(d, 1, 0), 0, 'horizon haze smoothly hides the layer');
  assert.equal(cloudOpacity([0, -1, 0], 1, 0), 0);
});
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celestialAt, solarDirectionAt } from '../src/shared/astronomy.ts';
const dot = (a: number[], b: number[]) => a.reduce((n, x, i) => n + x * b[i], 0);
test('changing the decorative clock rotates the sky without resetting the saved lunar phase', () => {
  const savedDate = 83.37;
  const midnight = celestialAt(savedDate, 0);
  const noon = celestialAt(savedDate - 0.5, 43200);
  midnight.moons.forEach((moon, i) => {
    assert.ok(Math.abs(moon.illuminated - noon.moons[i].illuminated) < 1e-12);
    assert.ok(dot(moon.direction, noon.moons[i].direction) < 0.5);
  });
});
test('sky rotation is continuous at midnight and shifts over a season', () => {
  const before = celestialAt(80, 86400 - 0.01),
    after = celestialAt(81, 0);
  before.skyRotation.forEach((n, i) => assert.ok(Math.abs(n - after.skyRotation[i]) < 0.00001));
  const winter = celestialAt(0, 0),
    summer = celestialAt(182.5, 0);
  assert.ok(winter.skyRotation.some((n, i) => Math.abs(n - summer.skyRotation[i]) > 1));
  const evening = celestialAt(80, 72000),
    morning = celestialAt(81, 14400);
  assert.ok(evening.skyRotation.some((n, i) => Math.abs(n - morning.skyRotation[i]) > 0.5));
});
test('two unequal moons stay close, wax and wane together, and do not reset at new year', () => {
  const phases: number[] = [];
  for (let day = 0; day < 365; day++) {
    const { moons, sun } = celestialAt(day, 0);
    const separation = Math.acos(Math.min(1, dot(moons[0].direction, moons[1].direction)));
    assert.ok(separation > 0.025 && separation < 0.12);
    assert.ok(moons[0].radius > moons[1].radius);
    for (const moon of moons) {
      assert.ok(Math.abs(dot(moon.direction, moon.direction) - 1) < 1e-10);
      assert.ok(Math.abs(moon.illuminated - (1 - dot(moon.direction, sun)) / 2) < 1e-10);
    }
    phases.push(moons[0].illuminated);
  }
  assert.ok(Math.min(...phases) < 0.01);
  assert.ok(Math.max(...phases) > 0.99);
  assert.ok(Math.abs(phases[0] - celestialAt(365, 0).moons[0].illuminated) > 0.01);
  const a = celestialAt(364, 86399.99),
    b = celestialAt(365, 0);
  assert.ok(dot(a.moons[0].direction, b.moons[0].direction) > 0.999999);
});
test('sun and moons rise in the east and travel west; summer has a higher sun', () => {
  assert.ok(solarDirectionAt(80, 21600)[0] > 0);
  assert.ok(solarDirectionAt(80, 64800)[0] < 0);
  assert.ok(solarDirectionAt(172, 43200)[1] > solarDirectionAt(355, 43200)[1]);
  const day = 9; // Near full moon: evening rise, midnight transit, morning set.
  assert.ok(celestialAt(day, 64800).moons[0].direction[0] > 0);
  assert.ok(celestialAt(day + 1, 21600).moons[0].direction[0] < 0);
});

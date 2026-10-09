// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaseOffset, lookPitchFromDrag } from '../src/client/camera-look.ts';

test('vertical drag tilts chase and first-person cameras, not the overhead view', () => {
  assert.equal(lookPitchFromDrag(0, 10, 0), 0.04);
  assert.equal(lookPitchFromDrag(0, 10, 1), 0.04);
  assert.equal(lookPitchFromDrag(0, 10, 2), 0);
  assert.equal(lookPitchFromDrag(1.4, 50, 0), 1.4);
  assert.equal(lookPitchFromDrag(-1.1, -50, 0), -1.1);
});

test('chase camera keeps its default seat and orbits up or down with look pitch', () => {
  const rest = chaseOffset(0, 1, false, 0);
  assert.ok(Math.abs(rest.x) < 1e-12);
  assert.equal(rest.y, 8.5);
  assert.equal(rest.z, -21);
  const walk = chaseOffset(0, 1, true, 0);
  assert.equal(walk.y, 3);
  assert.equal(walk.z, -6);
  const up = chaseOffset(0, 1, false, 0.4);
  assert.ok(up.y < rest.y, 'looking up lowers the chase camera toward the horizon');
  assert.ok(Math.abs(up.z) > Math.abs(rest.z), 'looking up moves the camera farther behind');
  const down = chaseOffset(0, 1, false, -0.4);
  assert.ok(down.y > rest.y, 'looking down raises the chase camera');
  const side = chaseOffset(Math.PI / 2, 1, false, 0);
  assert.ok(Math.abs(side.x + 21) < 1e-9);
  assert.ok(Math.abs(side.z) < 1e-9);
});

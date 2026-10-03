// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { twilightAt } from '../src/client/sky-weather.ts';
test('twilight leaves full night/day lighting intact and softens with cloud cover', () => {
  for (const height of [-1, -0.21, 0.3, 1]) {
    assert.equal(twilightAt(height, 0.2).glow, 0);
    assert.equal(twilightAt(height, 0.2).ambient, 0);
  }
  assert.ok(twilightAt(0, 0.1).glow > 0.9);
  assert.ok(twilightAt(0, 0.95).glow < twilightAt(0, 0.1).glow);
  for (let h = -1; h <= 1; h += 0.001) {
    const a = twilightAt(h, 0.3),
      b = twilightAt(h + 0.001, 0.3);
    assert.ok(a.glow >= 0 && a.glow <= 1 && a.ambient >= 0 && a.ambient <= 0.16);
    assert.ok(Math.abs(a.glow - b.glow) < 0.015, 'no abrupt horizon lighting switch');
  }
});

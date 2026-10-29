// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lighthouseLocalLight,
  lighthouseRange,
  lighthouseFlash,
} from '../src/shared/lighthouse-optics';
test('local lighthouse illumination stays dark inland in all weather, and faint offshore at night', () => {
  for (const mist of [0, 0.4, 1]) {
    assert.deepEqual(lighthouseLocalLight(0, mist, false), { surface: 0, shaft: 0 });
    assert.equal(lighthouseLocalLight(1, mist, true).surface, 0);
  }
  assert.equal(lighthouseLocalLight(0, 0, true).shaft, 0);
  assert.equal(lighthouseLocalLight(0, 0, true).surface, 0.45);
  assert.ok(lighthouseLocalLight(0, 1, true).shaft > 0);
  assert.ok(lighthouseLocalLight(0, 1, true).shaft < 0.2);
  // The local light budget must not shorten the independent navigational signal.
  assert.equal(lighthouseRange(50, 4), 16 * 1852);
  assert.equal(lighthouseFlash(0, 0, 0), 1);
  assert.ok(lighthouseFlash(0, Math.PI, 0) < 0.001);
});

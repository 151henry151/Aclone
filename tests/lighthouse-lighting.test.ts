// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lighthouseLocalLight,
  lighthouseRange,
  lighthouseFlash,
  lighthouseSignal,
} from '../src/shared/lighthouse-optics';
test('local lighthouse illumination stays dark inland in all weather, and offshore in all weather', () => {
  for (const mist of [0, 0.4, 1]) {
    assert.deepEqual(lighthouseLocalLight(0, mist, false), { surface: 0, shaft: 0 });
    assert.equal(lighthouseLocalLight(1, mist, true).surface, 0);
  }
  assert.equal(lighthouseLocalLight(0, 0, true).shaft, 0);
  assert.equal(lighthouseLocalLight(0, 0, true).surface, 0);
  assert.equal(lighthouseLocalLight(0, 1, true).shaft, 0);
  assert.ok(lighthouseLocalLight(0, 1, true).shaft < 0.2);
  // The local light budget must not shorten the independent navigational signal.
  assert.equal(lighthouseRange(50, 4), 30000);
  assert.equal(lighthouseFlash(0, 0, 0), 1);
  assert.ok(lighthouseFlash(0, Math.PI, 0) < 0.001);
});

test('a dim beacon remains between resolvable flashes at one kilometre and thirty kilometres', () => {
  for (const distance of [1000, 30000]) {
    const dim = lighthouseSignal(0, distance, 0, 0),
      peak = lighthouseSignal(1, distance, 0, 0);
    assert.ok(dim > 0.02 && peak > dim * 10);
  }
  let frames = 0;
  for (let t = -1; t <= 1; t += 1 / 15)
    if (lighthouseFlash((t * Math.PI) / 8, 0, 0) > 0.5) frames++;
  assert.ok(frames >= 5, 'even 15 FPS sees several bright frames each rotation');
  assert.ok(lighthouseSignal(1, 30000, 0, 1) < 0.001, 'storm visibility is not magical');
});

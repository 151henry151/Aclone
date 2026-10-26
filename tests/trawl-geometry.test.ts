// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trawlSection } from '../src/client/trawl-rig';

test('trawl opens toward the boat and tapers to a closed catch bag at the trailing end', () => {
  assert.equal(trawlSection(0, 0).width, 5);
  assert.ok(trawlSection(0, 0).width > trawlSection(0.5, 0).width);
  assert.deepEqual(trawlSection(1, 4), { width: 0, height: 0 });
  assert.deepEqual(trawlSection(0, 0), trawlSection(0, 4));
  assert.ok(trawlSection(0.83, 4).width > trawlSection(0.83, 1).width);
  for (let i = 0; i <= 100; i++) {
    const { width, height } = trawlSection(i / 100, 4);
    assert.ok(Number.isFinite(width) && width >= 0 && width <= 5);
    assert.ok(Number.isFinite(height) && height >= 0 && height <= 1.35);
  }
});

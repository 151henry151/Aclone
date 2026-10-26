// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapWaterPath, mapTerrainPaths } from '../src/client/map-water';

test('diagonal coastline interpolates sea-level crossings instead of snapping to square cells', () => {
  const d = mapWaterPath(6, 6, (x, y) => x + y - 5);
  assert.match(d, /L5 0/);
  assert.match(d, /2\.5 2\.5/);
  assert.match(d, /0 5/);
  assert.equal(
    mapWaterPath(6, 6, () => 0),
    '',
  );
  assert.equal(
    mapWaterPath(6, 6, () => 1),
    '',
  );
  assert.equal(
    mapWaterPath(7, 5, () => -1),
    'M0 0H7V5H0Z',
  );
});
test('terrain samples are shared by coastlines and contours; heights and labels stay above sea level', () => {
  let samples = 0;
  const terrain = mapTerrainPaths(240, 180, (x) => {
    samples++;
    return x - 30;
  });
  assert.equal(samples, 41 * 31);
  assert.ok(terrain.water && terrain.major && terrain.minor);
  // Heights 50, 100, 150 and 200 intersect this plane at x=80,130,180,230.
  for (const x of [80, 130, 180, 230]) assert.match(terrain.major, new RegExp(`M${x} `));
  assert.doesNotMatch(terrain.major, /M30 /);
  assert.ok(terrain.labels.length > 0);
  assert.ok(
    terrain.labels.every(
      (p) => p.height > 0 && p.height % 50 === 0 && Math.abs(p.x - (p.height + 30)) < 0.001,
    ),
  );
  const hidden = mapTerrainPaths(240, 180, (x) => x - 30, false);
  assert.equal(hidden.water, terrain.water);
  assert.equal(hidden.minor, '');
  assert.equal(hidden.major, '');
  assert.deepEqual(hidden.labels, []);
  const sea = mapTerrainPaths(240, 180, () => -30);
  assert.equal(sea.minor + sea.major, '');
});

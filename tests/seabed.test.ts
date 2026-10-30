// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { seabedHeight, depthFishingMultiplier } from '../src/shared/seabed';
import { terrainHeight } from '../src/shared/terrain';
import { waterDepth } from '../src/shared/fishing-water';
import { mapTerrainPaths } from '../src/client/map-water';

test('bathymetry preserves shores and land, varies bay and ocean floors, and has smooth trenches', () => {
  for (const h of [-8, -3, 0, 4, 90])
    for (const [x, z] of [
      [0, 200],
      [0, 4000],
      [5000, 6500],
    ])
      assert.equal(seabedHeight(h, 0, x, z, 6250, 42), h);
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  const bay = [1000, 2000, 3000].map((z) => waterDepth(w, { x: 0, z }));
  const offshore = [6200, 6800, 7400, 8500].map((z) => waterDepth(w, { x: 0, z }));
  assert.ok(
    bay.every((d) => d > 15 && d < 100),
    JSON.stringify(bay),
  );
  assert.ok(
    offshore.every((d) => d > 300),
    JSON.stringify(offshore),
  );
  assert.ok(Math.max(...offshore) - Math.min(...offshore) > 250);
  const transverse = Array.from({ length: 31 }, (_, i) =>
    waterDepth(w, { x: -3000 + i * 200, z: 6800 }),
  );
  assert.ok(Math.max(...transverse) - Math.min(...transverse) > 300, 'trench is not a flat shelf');
  for (let z = 200; z < 9000; z += 20)
    assert.ok(
      Math.abs(terrainHeight(w, 0, z + 1) - terrainHeight(w, 0, z)) < 12,
      'no seabed steps',
    );
  const saved = JSON.parse(JSON.stringify(w));
  assert.equal(terrainHeight(w, 0, 6800), terrainHeight(saved, 0, 6800));
});
test('depth bonus is modest, monotonic and bounded, leaving poor trips possible', () => {
  const rates = [0, 20, 100, 300, 700, 2000].map(depthFishingMultiplier);
  assert.equal(rates[0], 0.96);
  assert.equal(rates.at(-1), 1.04);
  assert.ok(rates.every((v, i) => !i || v >= rates[i - 1]));
  assert.ok(rates.at(-1)! / rates[0] < 1.2);
});
test('deep-water map tint follows measured seabed and stays off land', () => {
  const dry = mapTerrainPaths(40, 40, () => 20, false);
  const bay = mapTerrainPaths(40, 40, () => -40, false);
  const ocean = mapTerrainPaths(40, 40, () => -800, false);
  assert.equal(dry.water, '');
  assert.equal(dry.deepWater, '');
  assert.notEqual(bay.water, '');
  assert.equal(bay.deepWater, '');
  assert.equal(ocean.deepWater, ocean.water);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { evergreenGeometry } from '../src/client/evergreen.ts';
import { seasonalMaterial } from '../src/client/materials.ts';

test('evergreen variants stay finite and within the woodland geometry budget in both quality modes', () => {
  for (let variant = 0; variant < 3; variant++) {
    const detailed = evergreenGeometry(variant, false),
      low = evergreenGeometry(variant, true);
    const triangles = (model: typeof low) =>
      Object.values(model).reduce(
        (n, g) => n + (g.index?.count ?? g.attributes.position.count) / 3,
        0,
      );
    assert.ok(triangles(detailed) < 11000);
    assert.ok(triangles(low) < triangles(detailed) * 0.8);
    for (const model of [detailed, low])
      for (const g of Object.values(model)) {
        assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
        assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));
        g.computeBoundingBox();
        assert.ok(g.boundingBox!.min.y > -0.15);
        assert.ok(g.boundingBox!.max.y < 11);
        assert.ok(g.boundingBox!.max.x - g.boundingBox!.min.x < 9);
      }
    // Dropping extra sprays must not reroll the tree or make its branches jump on a quality change.
    const positions = new Set<string>();
    const high = detailed.needles.attributes.position,
      coarse = low.needles.attributes.position;
    for (let i = 0; i < high.count; i++)
      positions.add([high.getX(i), high.getY(i), high.getZ(i)].join(','));
    for (let i = 0; i < coarse.count; i++)
      assert.ok(positions.has([coarse.getX(i), coarse.getY(i), coarse.getZ(i)].join(',')));
    for (const g of [...Object.values(detailed), ...Object.values(low)]) g.dispose();
  }
});

test('seasonal shader decoration preserves distinct foliage shader programs', () => {
  const needles = new T.MeshLambertMaterial(),
    ordinary = new T.MeshLambertMaterial();
  needles.customProgramCacheKey = () => 'needle-light-transmission';
  seasonalMaterial(needles);
  seasonalMaterial(ordinary);
  assert.notEqual(needles.customProgramCacheKey(), ordinary.customProgramCacheKey());
  needles.dispose();
  ordinary.dispose();
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildingArchitectures } from '../src/shared/building-architecture';
import { buildingPlan, buildingBounds } from '../src/shared/building-shapes';
import { makeBuilding } from '../src/shared/simulation';
import { buildingModel } from '../src/client/buildings';
import { butcherRamp } from '../src/shared/butcher';
test('five butcher premises have distinct working layouts and a visible ramp inside their planned bounds', () => {
  const variants = buildingArchitectures('butcher');
  assert.equal(variants.length, 5);
  assert.deepEqual(
    variants.map((v) => v.name),
    [
      'Stone slaughterhouse and cold room',
      'Timber village butcher',
      'Brick abattoir and loading ramp',
      'Whitewashed tiled butcher',
      'Long low meat works',
    ],
  );
  const shapes = new Set<string>();
  for (const model of variants) {
    const b = { ...makeBuilding('butcher-model', 'butcher', 0, 0), architecture: model.id };
    const plan = buildingPlan(b),
      bounds = buildingBounds(plan),
      ramp = plan.waterfront![0];
    shapes.add(JSON.stringify(plan.volumes));
    assert.ok(ramp.z + ramp.depth / 2 <= bounds.maxZ);
    const root = buildingModel(b, (mesh) => mesh);
    assert.ok(root.getObjectByName('Livestock loading ramp'), model.name);
    const box = new T.Box3().setFromObject(root);
    const entrance = butcherRamp(b);
    assert.ok(box.max.z >= entrance.z + ramp.depth / 2 - 0.1);
    root.traverse((object) => {
      if (object instanceof T.Mesh) {
        assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite));
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          material.dispose();
      }
    });
  }
  assert.equal(shapes.size, 5);
});

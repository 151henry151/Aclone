// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { springGeometry } from '../src/client/spring-scenery';
import { waterSourceRules } from '../src/shared/water-source-rules';
import { buildingArchitectures } from '../src/shared/building-architecture';
import { buildingPlan } from '../src/shared/building-shapes';
test('natural spring geometry follows world dimensions and supplies the animated river attributes', () => {
  const w = createWorld('spring-model', 'Model', 'owner');
  Object.assign(w.settings, { mapSize: 500 });
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(30),
  };
  const spring = { id: 'spring-model', x: 100, z: 100, flow: 1 };
  const g = springGeometry(w, spring),
    rules = waterSourceRules(w.settings);
  assert.equal(rules.springBasinDiameter, 3);
  assert.equal(rules.springDampDiameter, 6);
  for (const part of Object.values(g)) {
    assert.ok(part.attributes.position.count > 0);
    for (const n of part.attributes.position.array) assert.ok(Number.isFinite(n));
  }
  g.damp.computeBoundingBox();
  assert.ok(Math.abs(g.damp.boundingBox!.max.x - g.damp.boundingBox!.min.x - 6) < 0.01);
  assert.equal(
    g.damp.attributes.color?.itemSize,
    4,
    'damp edges must blend into the ground, not form an opaque disc',
  );
  assert.equal(
    g.moss.attributes.color?.itemSize,
    4,
    'moss must feather into natural ground rather than form a solid circular paving ring',
  );
  assert.ok(g.water.attributes.riverDepth);
  assert.ok(g.water.attributes.riverSlope);
  w.settings.springDampDiameter = 10;
  const wide = springGeometry(w, spring);
  wide.damp.computeBoundingBox();
  assert.ok(Math.abs(wide.damp.boundingBox!.max.x - wide.damp.boundingBox!.min.x - 10) < 0.01);
  for (const part of [...Object.values(g), ...Object.values(wide)]) part.dispose();
});
test('pump-houses have five distinct works models and desalination models keep their IDs', () => {
  const models = buildingArchitectures('pumpHouse');
  assert.equal(models.length, 5);
  assert.deepEqual(
    models.map((m) => m.name),
    [
      'Spring house',
      'Well house and pump room',
      'Riverside pump station',
      'Stone spring chamber',
      'Pump tower and header tank',
    ],
  );
  const plans = models.map((m) =>
    buildingPlan({ ...makeBuilding('model', 'pumpHouse', 0, 0), architecture: m.id }),
  );
  assert.equal(new Set(plans.map((p) => JSON.stringify(p.volumes))).size, 5);
  assert.equal(buildingArchitectures('waterworks')[0].name, 'Desalination house');
  assert.equal(buildingArchitectures('waterworks')[0].id, 'model-1');
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { waterfrontPreview } from '../src/client/waterfront-preview';
import { buildingPlan } from '../src/shared/building-shapes';
import { dockPoint } from '../src/shared/boathouse';

test('waterfront compass points toward the rear, and every rotated waterfront corner stays in the plan', () => {
  const w = createWorld('preview', 'Preview', 'owner');
  const b = makeBuilding('draft', 'boathouse', 100, 100);
  for (const [degrees, direction] of [
    [0, 'north'],
    [90, 'west'],
    [180, 'south'],
    [270, 'east'],
  ] as const) {
    b.rotation = (degrees * Math.PI) / 180;
    const preview = waterfrontPreview(w, b, b)!;
    assert.ok(preview.help.includes(`water to the ${direction}`));
  }
  for (let degrees = 0; degrees < 360; degrees++) {
    b.rotation = (degrees * Math.PI) / 180;
    const preview = waterfrontPreview(w, b, b)!;
    const plan = buildingPlan(b);
    for (const v of [...plan.volumes, ...(plan.fixtures ?? []), ...(plan.waterfront ?? [])])
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          const p = dockPoint(b, v.x + (x * v.width) / 2, v.z + (z * v.depth) / 2);
          assert.ok(Math.abs((p.x - b.x) * preview.scale) < 204);
          assert.ok(Math.abs((p.z - b.z) * preview.scale) < 68);
        }
  }
});
test('intake guidance follows custom world rules, and ordinary buildings have no waterfront overlay', () => {
  const w = createWorld('preview', 'Preview', 'owner');
  Object.assign(w.settings, {
    pumpIntakeMinReach: 9,
    pumpIntakeMaxReach: 17,
    pumpIntakeDepth: 1.2,
    pumpFreeboard: 0.8,
    desalinationRequiresOcean: false,
  });
  const b = makeBuilding('draft', 'pumpHouse', 100, 100);
  const preview = waterfrontPreview(w, b, b)!;
  assert.match(preview.help, /9–17 m/);
  assert.match(preview.help, /1.2 m/);
  assert.match(preview.help, /0.8 m/);
  b.kind = 'waterworks';
  assert.match(waterfrontPreview(w, b, b)!.help, /permits enclosed water/);
  b.kind = 'home';
  assert.equal(waterfrontPreview(w, b, b), undefined);
});

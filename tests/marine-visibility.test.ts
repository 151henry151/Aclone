// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geographicRange, earthDrop } from '../src/shared/marine-visibility';
import { horizonGeometry } from '../src/client/horizon-land';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
test('low shore disappears before hills, with observer height extending the horizon', () => {
  assert.ok(geographicRange(0, 4) > 7500 && geographicRange(0, 4) < 8000);
  assert.ok(geographicRange(100, 4) > 45000);
  assert.ok(geographicRange(50, 10) > geographicRange(50, 2));
  assert.ok(earthDrop(1000) < 0.1);
  assert.ok(earthDrop(30000) > 60);
});
test('island fallback samples real terrain and refines land under buildings before detailed tiles load', () => {
  const w = createWorld('island', 'Island', 'server');
  w.settings.mapSize = 2500;
  const b = makeBuilding('tower', 'lighthouse', 576, 576);
  w.buildings = [b];
  w.coastalBluffs = [
    { id: 'cliff', x: 576, z: 576, angle: 0, width: 100, inland: 140, height: 35, seed: 3 },
  ];
  const job = horizonGeometry(w);
  let result = job.next(),
    yields = 0;
  while (!result.done) {
    yields++;
    result = job.next();
  }
  const g = result.value,
    p = g.attributes.position;
  assert.ok(yields > 100, 'construction yields rather than blocking a frame');
  assert.ok(p.count < 100000, 'silhouette has a bounded geometry budget');
  let near = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(p.getY(i) - terrainHeight(w, p.getX(i), p.getZ(i))) < 0.0001);
    if (Math.abs(p.getX(i) - 576) < 32 && Math.abs(p.getZ(i) - 576) < 32) near++;
  }
  assert.ok(near > 25, 'tower has detailed supporting cliff samples');
  for (let i = 0; i < g.index!.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => g.index!.getX(i + j));
    assert.ok(
      (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)) -
        (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) >
        0,
    );
  }
  g.dispose();
});

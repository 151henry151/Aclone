// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld } from '../src/shared/simulation.ts';
import { terrainHeight } from '../src/shared/terrain.ts';
import { townRoads, roadSurfaceDistance } from '../src/shared/town.ts';
import { groundGeometrySteps } from '../src/client/ground-geometry.ts';
import { snowProfile, prepareSnowSurfaceSteps } from '../src/client/snow-surface.ts';

const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
test('local snow queries match the full road network at cell boundaries, wide roads and long diagonals', () => {
  const w = createWorld('puddlewick', 'Test', 'server');
  w.roads = [
    { a: { x: -20000, z: -20000 }, b: { x: 20000, z: 20000 }, width: 12 },
    { a: { x: -128, z: 60 }, b: { x: 256, z: 68 }, width: 18 },
    { a: { x: -64, z: -64 }, b: { x: -64, z: -64 }, width: 24 },
    ...Array.from({ length: 450 }, (_, i) => ({
      a: { x: i * 23 - 2000, z: i * 11 - 1000 },
      b: { x: i * 23 - 1985, z: i * 11 - 995 },
      width: 5,
    })),
  ];
  for (const roadsEnabled of [true, false]) {
    w.creator = { ...w.creator!, roads: roadsEnabled };
    const profile = snowProfile(w),
      roads = townRoads(w);
    for (let x = -260; x <= 260; x += 7.99)
      for (let z = -130; z <= 130; z += 7.99) {
        const y = 3;
        const expected =
          smooth(roadSurfaceDistance(w, roads, x, z) / 3) *
          smooth((y - w.settings.seaLevel) / 0.5) *
          (1 + 0.12 * Math.sin(x * 0.38 + Math.sin(z * 0.13)) * Math.cos(z * 0.31));
        assert.ok(Math.abs(profile(x, z, y) - expected) < 1e-12, `snow at ${x},${z}`);
      }
  }
});
test('streamed cliff geometry yields in small batches, then publishes complete terrain and snow attributes', () => {
  const w = createWorld('puddlewick', 'Test', 'server');
  w.coastalBluffs = [
    { id: 'natural-test', x: 500, z: 500, angle: 0, width: 100, inland: 140, height: 35, seed: 3 },
  ];
  const job = groundGeometrySteps(w, 512, 512, true);
  let step = job.next(),
    yields = 0;
  while (!step.done) {
    yields++;
    step = job.next();
  }
  const g = step.value,
    p = g.getAttribute('position');
  assert.ok(yields >= 60, 'dense tile must yield before all vertices are sampled');
  for (let i = 0; i < p.count; i++)
    assert.ok(Math.abs(p.getY(i) - terrainHeight(w, 512 + p.getX(i), 512 + p.getZ(i))) < 0.00001);
  const snow = prepareSnowSurfaceSteps(g, w, 512, 512);
  assert.equal(snow.next().done, false);
  assert.equal(g.getAttribute('snowLift'), undefined, 'do not publish a partial snow surface');
  for (const _ of snow) {
    /* finish */
  }
  assert.equal(g.getAttribute('snowLift').count, p.count);
  assert.ok(Array.from(g.getAttribute('snowLift').array).every(Number.isFinite));
  g.dispose();
});
test('cancelling a partial terrain job disposes its geometry', () => {
  const w = createWorld('puddlewick', 'Test', 'server');
  const original = T.BufferGeometry.prototype.dispose;
  let disposed = 0;
  T.BufferGeometry.prototype.dispose = function () {
    disposed++;
    original.call(this);
  };
  try {
    const job = groundGeometrySteps(w, 512, 512, true);
    assert.equal(job.next().done, false);
    job.return(undefined as never);
    assert.equal(disposed, 1);
  } finally {
    T.BufferGeometry.prototype.dispose = original;
  }
});

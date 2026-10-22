// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import {
  prepareSnowSurface,
  snowProfile,
  snowTrackHeight,
  liftSnowShadow,
} from '../src/client/snow-surface';
import { terrainHeight } from '../src/shared/terrain';

const world = () => {
  const w = createWorld('snow-mesh', 'Snow', 'owner');
  w.creator = creatorSchema.parse({ roads: false });
  w.roads = [{ a: { x: 0, z: -100 }, b: { x: 0, z: 100 }, width: 6 }];
  return w;
};
test('snow raises existing ground vertices, clears roads and water, and agrees at tile seams', () => {
  const w = world(),
    profile = snowProfile(w);
  assert.equal(profile(0, 0), 0);
  assert.equal(profile(20, 0, w.settings.seaLevel - 1), 0);
  assert.ok(profile(20, 0) > 0.88 && profile(20, 0) < 1.12);
  const tiles = [0, 128].map((cx) => {
    const g = new T.PlaneGeometry(128, 128, 32, 32);
    g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(w, cx + p.getX(i), p.getZ(i)));
    const count = p.count;
    prepareSnowSurface(g, w, cx, 0);
    assert.equal(g.getAttribute('position').count, count, 'no extra terrain polygons');
    return g;
  });
  for (let row = 0; row <= 32; row++) {
    const a = tiles[0].getAttribute('snowLift'),
      b = tiles[1].getAttribute('snowLift');
    assert.deepEqual(
      [a.getX(row * 33 + 32), a.getY(row * 33 + 32), a.getZ(row * 33 + 32)],
      [b.getX(row * 33), b.getY(row * 33), b.getZ(row * 33)],
    );
  }
  for (const g of tiles) g.dispose();
});
test('tracks follow the displaced triangle surface at vertices and between them', () => {
  const w = world();
  w.settings.mapSize = 4000;
  w.climate = { snow: 1, snowDepth: 0.15, wetness: 1 };
  const profile = snowProfile(w),
    height = snowTrackHeight(w);
  const vertex = (x: number, z: number) => terrainHeight(w, x, z) + 0.15 * profile(x, z);
  assert.ok(Math.abs(height(20, 0) - vertex(20, 0)) < 1e-8);
  assert.ok(
    Math.abs(height(21, 1) - (vertex(20, 0) * 0.5 + vertex(24, 0) * 0.25 + vertex(20, 4) * 0.25)) <
      1e-8,
  );
  assert.ok(
    Math.abs(height(23, 3) - (vertex(24, 4) * 0.5 + vertex(24, 0) * 0.25 + vertex(20, 4) * 0.25)) <
      1e-8,
  );
  assert.equal(height(0, 0), terrainHeight(w, 0, 0));
});

test('tractor contact shadows rise with snow and return to their original height after thaw', () => {
  const tractor = new T.Group(),
    shade = new T.Object3D();
  shade.position.y = 0.03;
  tractor.userData.snowShadow = shade;
  liftSnowShadow(tractor, 0.15);
  assert.equal(shade.position.y, 0.18);
  liftSnowShadow(tractor, 0.04);
  assert.equal(shade.position.y, 0.07);
  liftSnowShadow(tractor, -0.01);
  assert.equal(shade.position.y, 0.03);
});

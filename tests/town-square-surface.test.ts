// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import {
  townRoads,
  roadDistance,
  roadSurfaceDistance,
  townSquare,
  roadKey,
} from '../src/shared/town';
import { creatorSchema } from '../src/shared/creator';
import { drivingSurface } from '../src/shared/driving-surface';
import { roadConditions } from '../src/shared/environment';
import { snowProfile } from '../src/client/snow-surface';
import { SnowAccumulation } from '../src/client/snow-accumulation';

test('the painted town square has road traction and no snow, including gaps between lanes', () => {
  const w = createWorld('square', 'Square', 'owner');
  w.climate = { snow: 1, snowDepth: 0.04, wetness: 0 };
  const roads = townRoads(w),
    profile = snowProfile(w);
  let gaps = 0;
  for (let z = -12; z <= 12; z++) {
    for (let x = -12; x <= 12; x++) {
      if (Math.hypot(x, z) > 13) continue;
      if (roadDistance(roads, x, z) > 2) gaps++;
      assert.ok(roadSurfaceDistance(w, roads, x, z) <= 0);
      assert.deepEqual(drivingSurface(w, x, z), roadConditions(w));
      assert.equal(profile(x, z), 0);
    }
  }
  assert.ok(gaps > 0, 'covers gravel that is not already part of a lane');
  const snow = new SnowAccumulation(w);
  snow.mound(0, 0, 1);
  assert.equal(snow.finish().children.length, 0, 'no ground snow mound on the square');
});

test('the square has a smooth verge and disappears when starter roads are disabled', () => {
  const w = createWorld('square-edge', 'Square edge', 'owner');
  // Isolate the square from the surrounding road network.
  w.retiredRoads = townRoads(w).map(roadKey);
  w.climate = { snow: 1, snowDepth: 0.11, wetness: 0 };
  assert.deepEqual(townSquare(w), { x: 0, z: 0, radius: 13 });
  const profile = snowProfile(w);
  assert.equal(profile(13, 0), 0);
  assert.ok(profile(14, 0) > 0 && profile(14, 0) < profile(16, 0));
  assert.equal(drivingSurface(w, 13, 0).speed, roadConditions(w).speed);
  assert.ok(drivingSurface(w, 14, 0).speed < drivingSurface(w, 13, 0).speed);
  assert.ok(drivingSurface(w, 14, 0).speed > drivingSurface(w, 16, 0).speed);
  w.creator = creatorSchema.parse({ roads: false });
  assert.equal(townSquare(w), undefined);
  assert.equal(roadSurfaceDistance(w, townRoads(w), 0, 0), Infinity);
  assert.ok(snowProfile(w)(0, 0) > 0);
  assert.ok(drivingSurface(w, 0, 0).speed < roadConditions(w).speed);
});

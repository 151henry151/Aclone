// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { landscapeSchema } from '../src/shared/landscape';
import { countrysideSteps } from '../src/client/scenery';

test('countryside grass does not scan the mature road network for every candidate', (t) => {
  const w = createWorld('grass-work', 'Grass work', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  w.buildings = [];
  w.towns = [];
  delete w.airfield;
  delete w.spaceportSite;
  w.settings.seaLevel = -10;
  let reads = 0;
  w.roads = Array.from({ length: 2000 }, (_, i) => ({
    a: {
      get x() {
        reads++;
        return 300 + i * 6;
      },
      z: 300,
    },
    b: { x: 306 + i * 6, z: 300 },
    width: 5,
  }));
  const work = countrysideSteps(new T.Group(), w, true);
  // Exercise all 2,600 scattered candidates and the start of the roadside pass,
  // before canvas textures are created; all roads lie outside the grass patch.
  for (let i = 0; i < 100; i++) assert.equal(work.next().done, false);
  work.return();
  t.diagnostic(`road coordinate reads: ${reads}`);
  assert.ok(
    reads < 100000,
    `index the roads once, not per grass sample (${reads} coordinate reads)`,
  );
});

test('bounded grass lookups preserve every road-edge decision, including rebuilt geometry', async () => {
  const sampling = await import('../src/client/road-sampling');
  const { roadDistance, roadSurfaceDistance } = await import('../src/shared/town');
  const { nearbyRoadDistance } = sampling;
  assert.equal(typeof nearbyRoadDistance, 'function');
  const roads = [
    { a: { x: -128, z: -64 }, b: { x: 128, z: 64 }, width: 5 },
    { a: { x: -300, z: 60 }, b: { x: 300, z: 60 }, width: 40 },
    { a: { x: 64, z: -64 }, b: { x: 64, z: -64 }, width: 12 },
    { a: { x: -100000, z: -100000 }, b: { x: 100000, z: 100000 }, width: 8 },
  ];
  const w = createWorld('grass-query', 'Query', 'owner');
  w.airfield = {
    x: 150,
    z: 0,
    width: 30,
    length: 200,
    height: 10,
    hangar: 'hangar',
    apronX: 190,
    apronZ: 0,
  };
  w.spaceportSite = { x: -180, z: 0, height: 10, building: 'port', fence: 30, exclusion: 30 };
  const xs = [
    ...Array.from({ length: 171 }, (_, i) => -320 + i * 3.75),
    -64.001,
    -64,
    -63.999,
    0,
    63.999,
    64,
    64.001,
  ];
  const zs = [...Array.from({ length: 36 }, (_, i) => -130 + i * 7.25), -64, 0, 64];

  for (const edit of [false, true]) {
    if (edit) {
      roads[0].a.x += 30;
      roads[1].width = 2;
      roads.pop();
    }
    const near = nearbyRoadDistance(roads, 5),
      surface = sampling.nearbyRoadSurface(w, roads, 5);
    for (const x of xs)
      for (const z of zs) {
        const expected = roadDistance(roads, x, z),
          actual = near(x, z);
        if (expected <= 5) assert.equal(actual, expected);
        else assert.ok(actual > 5);
        for (const threshold of [0.5, 1, 3.8, 5]) {
          assert.equal(actual < threshold, expected < threshold);
          assert.equal(actual > threshold, expected > threshold);
        }
        const paved = roadSurfaceDistance(w, roads, x, z),
          indexed = surface(x, z);
        if (paved <= 5) assert.equal(indexed, paved);
        else assert.ok(indexed > 5);
      }
  }
  assert.equal(nearbyRoadDistance([], 5)(0, 0), Infinity);
});

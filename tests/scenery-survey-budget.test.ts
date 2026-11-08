// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorld } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { roadSite, roadRouteSteps } from '../src/shared/road-routing';
import { safeNearestSteps } from '../src/shared/road-projects';
import { finishRoadWork, type RoadWork } from '../src/shared/road-work';
import { sceneryChunk } from '../src/shared/scenery-obstacles';
import type { World } from '../src/shared/types';
function fixture(id: string) {
  const w = createWorld(id, 'Scenery', 'owner');
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: true });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, { mapSize: 4000, seaLevel: -10 });
  return w;
}
function measured<T>(w: World, work: RoadWork<T>) {
  const terrain = w.terrain;
  let reads = 0,
    maximum = 0,
    total = 0,
    steps = 0;
  Object.defineProperty(w, 'terrain', {
    configurable: true,
    get() {
      reads++;
      return terrain;
    },
  });
  for (;;) {
    reads = 0;
    const next = work.next();
    maximum = Math.max(maximum, reads);
    total += reads;
    assert.ok(++steps < 1000000, 'bounded survey must finish');
    if (next.done) {
      Object.defineProperty(w, 'terrain', { configurable: true, writable: true, value: terrain });
      return { result: next.value, maximum, total };
    }
  }
}
for (const kind of ['segment', 'route', 'nearest'] as const) {
  test(`cold ${kind} survey yields during scenery generation`, (t) => {
    const w = fixture('cold-survey-' + kind),
      site = roadSite(w);
    const a = { x: 580, z: 580 },
      b = { x: 600, z: 590 };
    const work =
      kind === 'segment'
        ? site.segmentSteps(a, b)
        : kind === 'route'
          ? roadRouteSteps(w, a, b)
          : safeNearestSteps([{ a, b, width: 5 }], b, site);
    const result = measured(w, work as RoadWork<unknown>);
    assert.ok(result.total >= 540, 'exercise an uncached, complete scenery region');
    t.diagnostic(`maximum terrain reads per resume: ${result.maximum}; total: ${result.total}`);
    assert.ok(
      result.maximum <= 64,
      `${result.maximum} terrain reads in one uninterrupted survey step`,
    );
  });
}
test('scenery geometry retains the pre-scheduling positions and dimensions', () => {
  const w = fixture('scenery-survey-parity');
  const objects = [
    [2, 2],
    [2, 3],
    [-3, -3],
  ].flatMap(([i, j]) => sceneryChunk(w, i, j));
  assert.equal(objects.length, 462);
  assert.equal(
    createHash('sha256').update(JSON.stringify(objects)).digest('hex'),
    'f31fbd0511d8981c939fb7ca5cf76ad9b18755a4c3eb9d2db9132d9a73d0c5d9',
  );
});
test('interleaved collision queries see complete chunks and cancellation cannot publish partial scenery', async () => {
  const { sceneryChunkSteps } = await import('../src/shared/scenery-obstacles');
  assert.equal(typeof sceneryChunkSteps, 'function');
  const w = fixture('scenery-survey-interleave');
  const work = sceneryChunkSteps(w, 2, 2);
  for (let i = 0; i < 4; i++) assert.equal(work.next().done, false);
  const complete = sceneryChunk(w, 2, 2);
  assert.ok(complete.length > 10);
  assert.deepEqual(finishRoadWork(work), complete);
  const cancelled = sceneryChunkSteps(w, 3, 2);
  cancelled.next();
  cancelled.next();
  cancelled.return([]);
  w.settings.seaLevel = 1000;
  w.revision++;
  assert.deepEqual(
    sceneryChunk(w, 3, 2),
    [],
    'a cancelled dry survey cannot repopulate flooded terrain',
  );
});
test('yielding point and segment checks retain every world collision mode', () => {
  for (const solidScenery of ['off', 'trunks', 'trunks-and-boulders'] as const) {
    const w = fixture('scenery-survey-' + solidScenery);
    w.settings.solidScenery = solidScenery;
    w.additionalResources = [
      {
        id: 'stone-test',
        item: 'stone',
        name: 'Stone',
        x: 600,
        z: 600,
        capacity: 100,
        regrowth: 1,
      },
    ];
    const objects = [
        [2, 2],
        [2, 3],
        [-3, -3],
      ].flatMap(([i, j]) => sceneryChunk(w, i, j)),
      site = roadSite(w);
    assert.ok(objects.some((o) => o.kind === 'tree') && objects.some((o) => o.kind === 'boulder'));
    for (const o of objects) {
      assert.equal(finishRoadWork(site.occupiedSteps(o)), site.occupied(o));
      assert.equal(finishRoadWork(site.clearSteps(o)), site.clear(o));
      const blocked = solidScenery !== 'off' && (solidScenery !== 'trunks' || o.kind === 'tree');
      if (blocked)
        assert.equal(
          finishRoadWork(site.segmentSteps({ x: o.x - 8, z: o.z }, { x: o.x + 8, z: o.z })),
          false,
        );
    }
  }
});
test('cold gathering-ground preparation yields without moving or dropping deposits', async () => {
  const { worldResourcesSteps } = await import('../src/shared/resources');
  assert.equal(typeof worldResourcesSteps, 'function');
  const w = fixture('scenery-survey-parity');
  const result = measured(w, worldResourcesSteps(w));
  assert.ok(result.maximum <= 64, `${result.maximum} terrain reads preparing gathering grounds`);
  assert.equal(result.result.length, 63);
  assert.equal(
    createHash('sha256').update(JSON.stringify(result.result)).digest('hex'),
    '50451af6649547e35fe9c529b7c801390e00d07432fbf1f7196cd3d5e4cfb525',
  );
});

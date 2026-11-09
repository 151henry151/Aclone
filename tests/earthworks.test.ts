// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
import { foundationProfile } from '../src/shared/construction-site';
import { slopeAssessment } from '../src/shared/construction-slope';
import { Store } from '../src/server/store';
import { chartWorld } from '../src/client/map-terrain-job';

// Keep this fixture independent of the new implementation so its first failure
// demonstrates the old terrain function ignoring a completed earthwork.
function hillside() {
  const w = createWorld('earthworks-test', 'Earthworks', 'owner');
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.terrain = [];
  w.roads = [];
  w.airfield = undefined;
  w.spaceportSite = undefined;
  Object.assign(w.settings, { mapSize: 1000, seaLevel: -40 });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) =>
      Math.max(-39, Math.min(39, 10 + 0.25 * (((i % 33) / 32) * 1000 - 580))),
    ),
  };
  return w;
}
const pad = (progress = 1) => ({
  id: 'pad',
  owner: 'owner',
  created: 0,
  x: 80,
  z: 80,
  width: 16,
  depth: 16,
  rotation: 0,
  target: 10,
  shoulder: 12,
  shoulderGrade: 50,
  progress,
  finish: 'bare' as const,
});
function pads(w: ReturnType<typeof hillside>, values: ReturnType<typeof pad>[]) {
  (w as typeof w & { earthworks: typeof values }).earthworks = values;
}

test('completed pads level the footprint and pass the construction grade rule', () => {
  const w = hillside();
  const b = makeBuilding('site', 'home', 80, 80);
  b.creatorBounds = { width: 12, depth: 12, height: 3 };
  assert.ok(slopeAssessment(w, foundationProfile(w, b).surveys).reason);
  pads(w, [pad()]);
  assert.equal(terrainHeight(w, 86, 80), 10);
  assert.equal(terrainHeight(w, 74, 80), 10);
  assert.equal(slopeAssessment(w, foundationProfile(w, b).surveys).reason, undefined);
});

test('progress, replacement and removal update terrain while shoulders join unchanged ground', () => {
  const w = hillside();
  const original = terrainHeight(w, 86, 80),
    boundary = terrainHeight(w, 100, 80);
  pads(w, [pad(0)]);
  assert.equal(terrainHeight(w, 86, 80), original);
  pads(w, [pad(0.5)]);
  assert.equal(terrainHeight(w, 86, 80), (original + 10) / 2);
  pads(w, [pad(1)]);
  assert.equal(terrainHeight(w, 86, 80), 10);
  assert.equal(terrainHeight(w, 100, 80), boundary);
  assert.ok(Math.abs(terrainHeight(w, 99.999, 80) - 15) < 0.001);
  pads(w, []);
  assert.equal(terrainHeight(w, 86, 80), original);
});

test('rotated pad edges and interior use the same coordinate frame', () => {
  const w = hillside(),
    p = { ...pad(), width: 4, depth: 16, rotation: Math.PI / 2 };
  pads(w, [p]);
  assert.equal(terrainHeight(w, 86, 80), 10);
  // The narrow dimension has rotated onto world Z.
  assert.notEqual(terrainHeight(w, 86, 87), 10);
});

test('map-worker payload and database snapshots preserve partial pads', () => {
  let w = hillside();
  const values = [pad(0.5)];
  pads(w, values);
  const sample = terrainHeight(w, 86, 80);
  assert.deepEqual((chartWorld(w) as any).earthworks, values);
  assert.equal(terrainHeight(chartWorld(w) as typeof w, 86, 80), sample);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    w = store.loadWorlds()[0].world;
    assert.deepEqual((w as any).earthworks, values);
    assert.equal(terrainHeight(w, 86, 80), sample);
  } finally {
    store.close();
  }
});

test('later partial works blend over a completed pad and completed regrading supersedes it', () => {
  const w = hillside();
  pads(w, [pad(), { ...pad(0.5), id: 'second', target: 12 }]);
  assert.equal(terrainHeight(w, 86, 80), 11);
  pads(w, [pad(0.5), { ...pad(), id: 'second', target: 12 }]);
  assert.equal(terrainHeight(w, 86, 80), 12);
});

test('indexed pad blending matches a direct survey across rotated shoulders and overlapping works', async () => {
  const { earthworksHeight } = await import('../src/shared/earthworks-ground');
  const reference = (works: ReturnType<typeof pad>[], x: number, z: number, h: number) => {
    for (const p of works) {
      const dx = x - p.x,
        dz = z - p.z,
        c = Math.cos(p.rotation),
        s = Math.sin(p.rotation);
      const a = Math.max(0, Math.abs(dx * c - dz * s) - p.width / 2);
      const b = Math.max(0, Math.abs(dx * s + dz * c) - p.depth / 2);
      const t =
        p.shoulder === 0
          ? a === 0 && b === 0
            ? 0
            : 1
          : Math.min(1, Math.hypot(a, b) / p.shoulder);
      h += (p.target - h) * (1 - t * t * (3 - 2 * t)) * p.progress;
    }
    return h;
  };
  const works = Array.from({ length: 200 }, (_, i) => ({
    ...pad((i % 5) / 4),
    id: 'pad-' + i,
    x: (i % 20) * 32 - 300,
    z: Math.floor(i / 20) * 32 - 160,
    rotation: i * 0.17,
    width: 4 + (i % 20),
    depth: 6 + (i % 16),
    target: (i % 18) - 4,
    shoulder: i % 13,
  }));
  const worlds = [{ earthworks: works }, { earthworks: works.slice().reverse() }];
  for (let i = 0; i < 4000; i++) {
    const w = worlds[i % 2],
      x = ((i * 73) % 800) - 400,
      z = ((i * 67) % 600) - 300;
    assert.ok(
      Math.abs(earthworksHeight(w, x, z, 8) - reference(w.earthworks, x, z, 8)) < 1e-10,
      `sample ${i} at ${x},${z}`,
    );
  }
});

test('fully replacing pads skip base terrain samples while partial pads and shoulders retain them', () => {
  const w = hillside();
  let samples = 0;
  w.landscape!.heightmap = new Proxy(w.landscape!.heightmap!, {
    get(target, key, receiver) {
      if (typeof key === 'string' && /^\d+$/.test(key)) samples++;
      return Reflect.get(target, key, receiver);
    },
  });
  pads(w, [pad()]);
  assert.equal(terrainHeight(w, 86, 80), 10);
  assert.equal(samples, 0, 'a fully replaced surface must not sample its base heightmap');
  pads(w, [pad(0.5)]);
  terrainHeight(w, 86, 80);
  assert.ok(samples > 0, 'partial work still needs natural ground');
  samples = 0;
  pads(w, [pad()]);
  terrainHeight(w, 95, 80);
  assert.ok(samples > 0, 'shoulders still join natural ground');
  samples = 0;
  pads(w, [pad(), { ...pad(0.5), id: 'later', target: 12 }]);
  assert.equal(terrainHeight(w, 86, 80), 11);
  assert.equal(samples, 0, 'later partial work starts from the completed pad');
});

test('worked ground removes its trees and boulders without invalidating distant obstacle chunks', async () => {
  const { sceneryChunk } = await import('../src/shared/scenery-obstacles');
  const w = createWorld('pad-scenery', 'Pads', 'owner');
  w.settings.mapSize = 2500;
  const nearby = sceneryChunk(w, 2, 2),
    far = sceneryChunk(w, -2, -2);
  const tree = nearby.find((o) => o.source === 'woodland');
  assert.ok(tree);
  const work = {
    ...pad(0),
    x: tree.x,
    z: tree.z,
    target: terrainHeight(w, tree.x, tree.z) + 1,
    width: 4,
    depth: 4,
    shoulder: 4,
  };
  w.earthworks = [work];
  assert.ok(
    sceneryChunk(w, 2, 2).some((o) => o.id === tree.id),
    'survey alone keeps trees',
  );
  w.earthworks = [{ ...work, progress: 0.5 }];
  assert.ok(
    !sceneryChunk(w, 2, 2).some((o) => o.id === tree.id),
    'changed ground clears its obstacle',
  );
  assert.equal(sceneryChunk(w, -2, -2), far, 'unrelated chunks retain their cached objects');
});

test('broadcast snapshots retain pad progress without mutating the saved records', async () => {
  const { prepareFrame } = await import('../src/server/snapshots');
  const w = hillside();
  w.earthworks = [pad(0.5)];
  const before = structuredClone(w.earthworks);
  assert.deepEqual(JSON.parse(prepareFrame(w).fields.earthworks), before);
  assert.deepEqual(w.earthworks, before);
  w.earthworks = [pad(1)];
  assert.equal(JSON.parse(prepareFrame(w).fields.earthworks)[0].progress, 1);
});

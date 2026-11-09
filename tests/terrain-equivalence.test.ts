// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
import { terrainHeight as releasedHeight } from './fixtures/terrain-0.138.0';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';

test('terrain optimizations retain released heights at village, coast, river, mountain and heightmap boundaries', () => {
  const old = createWorld('puddlewick', 'Puddlewick', 'server');
  Object.assign(old.settings, { mapSize: 18500 });
  old.terrainMapSize = 12500;
  old.townLayout = 2;
  const expanded = structuredClone(old);
  expandPuddlewickIsland(expanded);
  const custom = structuredClone(expanded);
  custom.landscape = {
    paths: [],
    barriers: [],
    surfaces: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => Math.sin(i) * 30),
  };
  for (const w of [createWorld('small', 'Small', 'owner'), old, expanded, custom]) {
    w.terrain = [
      { x: 340, z: 0, radius: 100, height: 6 },
      { x: 0, z: 150, radius: 40, height: -2 },
    ];
    const coordinates = Array.from({ length: 3000 }, (_, i) => [
      ((i * 179.17) % 18000) - 9000,
      ((i * 337.31) % 31000) - 22000,
    ]);
    for (const edge of [0, 120, 140, 230, 250, 300, 350, 400, 6250, 9250])
      for (const delta of [-1e-5, 0, 1e-5])
        coordinates.push(
          [edge + delta, 0],
          [0, edge + delta],
          [-edge - delta, 0],
          [0, -edge - delta],
        );
    if (w.northernIsland) {
      for (const r of w.northernIsland.rivers)
        for (const p of r.points) coordinates.push([p.x, p.z], [p.x + p.width / 2, p.z]);
      coordinates.push([0, w.northernIsland.preserveZ], [0, w.northernIsland.blendZ]);
    }
    for (const [x, z] of coordinates)
      assert.equal(terrainHeight(w, x, z), releasedHeight(w, x, z), `${w.id} ${x},${z}`);
  }
});

test('coastal index preserves headlands after append, replacement and world switching', async () => {
  const current = await import('../src/shared/coastal-bluffs');
  const reference = await import('./fixtures/coastal-bluffs-0.138.0');
  const a = {
    id: 'natural-a',
    x: 512,
    z: -512,
    angle: 0.4,
    width: 100,
    inland: 140,
    height: 35,
    seed: 3,
  };
  const b = { ...a, id: 'natural-b', x: -512, z: 256, angle: -0.7, seed: 5 };
  const first = [a],
    second = [b];
  const check = () => {
    for (let i = 0; i < 4000; i++) {
      const bluffs = i % 2 ? first : second,
        x = ((i * 31.7) % 1400) - 700,
        z = ((i * 57.3) % 1400) - 700;
      assert.equal(
        current.bluffHeight(bluffs, x, z, 3, 0),
        reference.bluffHeight(bluffs, x, z, 3, 0),
      );
      assert.equal(
        current.coastalRockCover(bluffs, x, z),
        reference.coastalRockCover(bluffs, x, z),
      );
    }
  };
  check();
  first.push(b);
  check();
  second[0] = { ...b, x: 200 };
  // An authored geometry edit replaces the array, as existing callers require.
  const replaced = second.slice();
  for (let x = 100; x < 300; x++)
    assert.equal(
      current.bluffHeight(replaced, x, 250, 3, 0),
      reference.bluffHeight(replaced, x, 250, 3, 0),
    );
});

test('seabed replacement retains exact released heights across coast boundaries and world seeds', async () => {
  const { terrainHeight: baseline } = await import('./fixtures/terrain-0.138.1');
  for (const id of ['puddlewick', 'other-coast', '海岸']) {
    const w = createWorld(id, id, 'owner');
    w.settings.mapSize = 12500;
    for (let i = 0; i < 4000; i++) {
      const angle = i * 0.71;
      const radius = 4500 + (i % 200) * 20;
      const x = Math.cos(angle) * radius,
        z = Math.sin(angle) * radius;
      assert.equal(terrainHeight(w, x, z), baseline(w, x, z), `${id}: ${x},${z}`);
    }
  }
});

test('terrain seeds follow identifier and explicit northern-seed changes', async () => {
  const { terrainSeed } = await import('../src/shared/terrain');
  const { seedOf } = await import('../src/shared/noise');
  const a = createWorld('seed-a', 'A', 'owner');
  const b = createWorld('seed-b', 'B', 'owner');
  for (const w of [a, b, a]) assert.equal(terrainSeed(w), seedOf(w.id));
  a.id = 'renamed-海岸';
  assert.equal(terrainSeed(a), seedOf(a.id));
  const expanded = createWorld('puddlewick', 'P', 'owner');
  expandPuddlewickIsland(expanded);
  a.northernIsland = expanded.northernIsland;
  a.northernIsland!.seed = 42;
  assert.equal(terrainSeed(a), 42);
  a.northernIsland!.seed = 0;
  assert.equal(terrainSeed(a), 0);
  delete a.northernIsland;
  assert.equal(terrainSeed(a), seedOf(a.id));
});

test('indexed river queries preserve released water, banks and terrain through edits', async () => {
  const live = await import('../src/shared/inland-water');
  const old = await import('./fixtures/inland-water-0.138.1');
  const w = createWorld('puddlewick', 'P', 'owner');
  expandPuddlewickIsland(w);
  const check = () => {
    for (const r of w.northernIsland!.rivers)
      for (const p of r.points)
        for (const offset of [-350, -128, -1, 0, 1, 128, 350]) {
          const x = p.x + offset,
            z = p.z - offset * 0.5;
          assert.equal(live.inlandGround(w, x, z, 90), old.inlandGround(w, x, z, 90));
          assert.deepEqual(live.inlandWaterAt(w, x, z), old.inlandWaterAt(w, x, z));
          assert.equal(live.nearInlandWater(w, x, z), old.nearInlandWater(w, x, z));
        }
  };
  check();
  const n = w.northernIsland!;
  n.rivers = n.rivers.map((r) => ({ ...r, points: r.points.map((p) => ({ ...p, x: p.x + 8 })) }));
  n.ponds.push({ id: 'test-pond', x: -100, z: -10000, rx: 40, rz: 30, level: 120, depth: 4 });
  check();
  n.rivers[0].points[0].x += 24;
  live.invalidateInlandWater(w);
  old.invalidateInlandWater(w);
  check();
});

test('northern region exclusion retains released relief, forest and terrain at every region boundary', async () => {
  const live = await import('../src/shared/northern-island');
  const old = await import('./fixtures/northern-island-0.138.1');
  const w = createWorld('puddlewick', 'P', 'owner');
  expandPuddlewickIsland(w);
  const n = w.northernIsland!;
  const points: number[][] = [];
  for (const r of n.regions)
    for (const d of [-0.00001, 0, 0.00001])
      for (let i = 0; i < 32; i++) {
        const angle = (i * Math.PI) / 16;
        points.push([
          r.x + Math.cos(angle) * (r.radius + d),
          r.z + Math.sin(angle) * (r.radius + d),
        ]);
      }
  for (let i = 0; i < 5000; i++)
    points.push([((i * 117.13) % 30000) - 15000, ((i * 331.37) % 35000) - 28000]);
  for (const [x, z] of points) {
    assert.deepEqual(live.northernRegion(n, x, z), old.northernRegion(n, x, z));
    assert.equal(
      live.northernHeight(n, x, z, w.settings.seaLevel),
      old.northernHeight(n, x, z, w.settings.seaLevel),
    );
  }
});

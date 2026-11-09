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

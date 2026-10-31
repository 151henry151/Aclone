// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
import { chartWorld, sampleMapTerrain } from '../src/client/map-terrain-job';
import { mapTerrainPaths } from '../src/client/map-water';

test('worker chart snapshot preserves actual terrain while excluding player and business state', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.settings.mapSize = 20000;
  w.terrainMapSize = 12500;
  w.terrain.push({ x: 500, z: 300, height: 30, radius: 80 });
  addPlayer(w, 'owner', 'Pilot');
  const snapshot = structuredClone(chartWorld(w));
  assert.ok(!('players' in snapshot) && !('buildings' in snapshot));
  for (const x of [-6000, -500, 0, 1000, 6000])
    for (const z of [-6000, 0, 300, 6000])
      assert.equal(terrainHeight(snapshot as typeof w, x, z), terrainHeight(w, x, z));
  const j = {
    id: 1,
    world: snapshot,
    width: 240,
    height: 180,
    x: -8000,
    z: -5000,
    offsetX: 0,
    offsetY: 0,
    scale: 0.02,
    contours: true,
    tide: 0.2,
  };
  assert.deepEqual(
    sampleMapTerrain(j),
    mapTerrainPaths(
      j.width,
      j.height,
      (x, y) => terrainHeight(w, j.x + x / j.scale, j.z + y / j.scale) - w.settings.seaLevel,
      true,
      0.2,
    ),
  );
});

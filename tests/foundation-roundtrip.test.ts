// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, terrainHeight } from '../src/shared/simulation.ts';
import { constructionSiteReason, foundationProfile } from '../src/shared/construction-site.ts';
import { worldResources } from '../src/shared/resources.ts';
import { townRoads } from '../src/shared/town.ts';
import { Store } from '../src/server/store.ts';
test('rotated foundations reject steep ground before construction and keep level on gentle land', () => {
  const w = createWorld('foundation', 'Foundation', 'server');
  w.buildings = [];
  w.zones = [];
  const b = makeBuilding('site', 'home', 65, 0);
  b.rotation = Math.PI / 4;
  assert.equal(constructionSiteReason(w, b), undefined);
  assert.ok(foundationProfile(w, b).rise < 0.1);
  w.terrain = [{ x: 65, z: 0, height: 10, radius: 15 }];
  assert.match(constructionSiteReason(w, b) ?? '', /Ground rises/);
});
test('ten database round trips preserve terrain, roads, resource and rotated building coordinates', () => {
  let w = createWorld('roundtrip', 'Roundtrip', 'server');
  w.terrain = [{ x: 40, z: -30, height: 4, radius: 20 }];
  w.buildings[0].rotation = 0.71;
  w.buildings[0].foundationY = 0.19;
  const sample = () => ({
    height: [
      [-200, 60],
      [0, 0],
      [40, -30],
      [600, -700],
    ].map(([x, z]) => terrainHeight(w, x, z)),
    roads: townRoads(w),
    resources: worldResources(w),
    buildings: w.buildings.map((b) => [b.id, b.x, b.z, b.rotation, b.foundationY]),
  });
  const before = sample(),
    store = new Store(':memory:');
  try {
    for (let i = 0; i < 10; i++) {
      store.saveWorld(w);
      w = store.loadWorlds()[0].world;
      assert.deepEqual(sample(), before);
    }
  } finally {
    store.close();
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance } from '../src/shared/simulation';
import { deepFishingWater } from '../src/shared/fishing-water';
import { deepBoatFishing, fishingCatch, landedFish } from '../src/shared/boat-fishing';
import { trawlWater, trawlAction } from '../src/shared/commercial-fishing';
import { terrainHeight } from '../src/shared/terrain';
import { privatePlayer, prepareFrame } from '../src/server/snapshots';

test('deep-sea catches require offshore clearance as well as depth, consistently for rods and nets', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    p = addPlayer(w, 'p', 'Skipper');
  Object.assign(p, { vehicle: 30, x: 0, z: 230, engine: true, fuel: 100, speed: 2 });
  assert.ok(w.settings.seaLevel - terrainHeight(w, p.x, p.z) > 8);
  assert.equal(trawlWater(w, p), false);
  assert.equal(deepBoatFishing(w, p), false);
  assert.equal(fishingCatch(w, p, 0.999), 'fish');
  assert.throws(() => trawlAction(w, p, 'deploy'), /clear water/);
  p.z = 1400;
  assert.equal(trawlWater(w, p), true);
  assert.equal(deepBoatFishing(w, p), true);
  assert.equal(fishingCatch(w, p, 0.999), 'tuna');
  p.fishCatch = 'tuna';
  p.z = 230;
  assert.equal(landedFish(w, p), 'fish');
});
test('islands and edited coastlines invalidate offshore fishing, including cached results', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    p = { x: 0, z: 1400 };
  assert.equal(deepFishingWater(w, p), true);
  w.terrain.push({ x: 80, z: 1412.5, radius: 60, height: 40 });
  w.revision++;
  assert.equal(deepFishingWater(w, p), false);
  w.terrain = [];
  w.revision++;
  assert.equal(deepFishingWater(w, p), true);
  w.terrain.push({ x: 82, z: 1417, radius: 3, height: 40 });
  w.revision++;
  assert.equal(deepFishingWater(w, p), false, 'tiny islets between grid samples still count');
  w.terrain = [];
  w.revision++;
  w.settings.seaLevel = -30;
  assert.equal(deepFishingWater(w, p), false);
});
test('shore fishing ground remains inside world bounds; compact worlds do not fake offshore distance', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(deepFishingWater(w, { x: 0, z: 7000 }), false);
  w.settings.mapSize = 500;
  assert.equal(deepFishingWater(w, { x: 0, z: 240 }), false);
});
test('encounter clocks are server-only, and world/offline time cannot award trawl fish', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    p = addPlayer(w, 'p', 'Skipper');
  Object.assign(p, { vehicle: 30, x: 0, z: 1400, online: true, engine: true, fuel: 100 });
  trawlAction(w, p, 'deploy');
  p.trawl!.catch = { cod: 2 };
  const privateNet = privatePlayer(w, p).trawl!;
  assert.equal('shoal' in privateNet, false);
  assert.equal('catch' in privateNet, false);
  assert.deepEqual(
    JSON.parse(prepareFrame(w).players[p.id]).trawl,
    JSON.parse(JSON.stringify(privateNet)),
  );
  assert.equal(privateNet.activity, 1);
  const before = structuredClone(p.trawl);
  advance(w, 60);
  assert.deepEqual(p.trawl, before);
});

test('offshore cache survives client snapshot merges without repeating the coastal scan', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  let terrainSamples = 0;
  w.terrain = new Proxy(w.terrain, {
    get(target, key, receiver) {
      if (key === Symbol.iterator) terrainSamples++;
      return Reflect.get(target, key, receiver);
    },
  });
  assert.equal(deepFishingWater(w, { x: 0, z: 1400 }), true);
  assert.ok(terrainSamples > 30);
  const before = terrainSamples;
  const nextSnapshot = { ...w, players: { ...w.players } };
  assert.equal(deepFishingWater(nextSnapshot, { x: 0, z: 1400 }), true);
  assert.ok(terrainSamples - before < 5, 'cached coastline reused across snapshots');
});

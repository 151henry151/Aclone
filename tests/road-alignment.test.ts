// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { landscapeSchema } from '../src/shared/landscape';
import { roadRoute, roadSite, roadSamples, pointDistance } from '../src/shared/road-routing';
import { terrainHeight } from '../src/shared/terrain';
import { townRoads } from '../src/shared/town';
function flat() {
  const w = createWorld('survey', 'Survey', 'server');
  w.buildings = [];
  w.towns = [];
  w.settings.mapSize = 2000;
  w.terrain = [];
  w.landscape = landscapeSchema.parse({ heightmap: Array(33 * 33).fill(10) });
  return w;
}
const length = (path: { x: number; z: number }[]) =>
  path.slice(1).reduce((s, p, i) => s + pointDistance(path[i], p), 0);
test('road surveys favour a gentle route around a hill rather than a straight climb', () => {
  const w = flat();
  w.terrain = [{ x: 0, z: 0, radius: 220, height: 65 }];
  const path = roadRoute(w, { x: -600, z: 0 }, { x: 600, z: 0 });
  assert.ok(path);
  const samples = path.slice(1).flatMap((p, i) => roadSamples({ a: path[i], b: p, width: 5 }, 2));
  assert.ok(
    Math.max(...samples.map((p) => terrainHeight(w, p.x, p.z))) < 30,
    'keeps below the 75m summit',
  );
  assert.ok(length(path) < 1550, 'does not take a wildly circuitous detour');
  assert.ok(path.slice(1).every((p, i) => roadSite(w).segment(path[i], p)));
});
test('long flat lanes have gentle stable bends, without consuming the world RNG', () => {
  const w = flat(),
    before = JSON.stringify(w),
    from = { x: -700, z: 0 },
    to = { x: 700, z: 0 };
  const path = roadRoute(w, from, to)!;
  assert.ok(path.length > 4);
  const deviation = Math.max(...path.map((p) => Math.abs(p.z)));
  assert.ok(deviation > 1 && deviation < 40, `gentle deviation ${deviation}`);
  assert.ok(length(path) < 1450);
  assert.deepEqual(path[0], from);
  assert.deepEqual(path.at(-1), to);
  assert.equal(JSON.stringify(w), before);
  assert.deepEqual(roadRoute(JSON.parse(before), from, to), path);
});
test('kilometre-scale surveys reach both cape approaches without crossing the bay', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.buildings = [];
  w.towns = [];
  for (const side of [-1, 1]) {
    const path = roadRoute(w, { x: side * 600, z: 600 }, { x: side * 3300, z: 5000 });
    assert.ok(path, `cape ${side}`);
    assert.ok(length(path) < 7000);
    const site = roadSite(w);
    assert.ok(path.slice(1).every((p, i) => site.segment(path[i], p)));
  }
});
test('legacy runway pavement cannot satisfy a road connection and new routes avoid it', () => {
  const w = flat();
  w.airfield = {
    x: 0,
    z: 0,
    width: 30,
    length: 300,
    height: 10,
    hangar: 'hangar',
    apronX: 80,
    apronZ: 0,
  };
  const runway = { a: { x: 0, z: -150 }, b: { x: 0, z: 150 }, width: 30 };
  w.roads = [runway];
  assert.ok(!townRoads(w).includes(runway));
  const path = roadRoute(w, { x: 0, z: -200 }, { x: 0, z: 200 });
  assert.ok(path);
  assert.ok(path.slice(1).every((p, i) => roadSite(w).segment(path[i], p)));
  assert.ok(Math.max(...path.map((p) => Math.abs(p.x))) > 28, 'travels beside the runway');
});

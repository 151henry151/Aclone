// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { defaultCreator } from '../src/shared/creator';
import { landscapeSchema } from '../src/shared/landscape';
import { roadKey, townRoads } from '../src/shared/town';
const road = (x: number) => ({ a: { x, z: 300 }, b: { x: x + 6, z: 300 }, width: 5 });
function fixture() {
  const w = createWorld('query', 'Query', 'owner');
  w.creator = defaultCreator();
  w.creator.roads = false;
  w.roads = [road(300), road(306)];
  return w;
}

test('mature road queries reuse geometry across ticks and client snapshots without key formatting', (t) => {
  const w = fixture();
  w.roads = Array.from({ length: 2003 }, (_, i) => road(300 + i * 6));
  w.retiredRoads = w.roads.slice(0, 83).map(roadKey);
  const before = JSON.stringify(w),
    first = townRoads(w);
  assert.equal(first.length, 1920);
  const original = Number.prototype.toFixed;
  let formats = 0;
  t.mock.method(Number.prototype, 'toFixed', function (this: number, digits?: number) {
    formats++;
    return original.call(this, digits);
  });
  for (let i = 0; i < 100; i++) {
    const snapshot = { ...w, time: w.time + i, settings: { ...w.settings, time: i } };
    assert.ok(townRoads(snapshot) === first, 'unchanged snapshot must reuse the filtered network');
  }
  assert.equal(formats, 0, 'queries must not repeatedly format thousands of road keys');
  assert.equal(JSON.stringify(w), before, 'cache must not change saved world data');
});

test('road edits and retired-list edits invalidate immediately, including same-length changes', () => {
  const w = fixture(),
    first = w.roads![0];
  assert.deepEqual(townRoads(w), w.roads);
  w.retiredRoads = [roadKey(first)];
  assert.deepEqual(townRoads(w), [w.roads![1]]);
  first.a.x += 1;
  assert.deepEqual(townRoads(w), w.roads, 'edited segment no longer matches retired key');
  w.retiredRoads[0] = roadKey(first);
  assert.deepEqual(townRoads(w), [w.roads![1]]);
  first.width++;
  assert.deepEqual(townRoads(w), w.roads);
  w.roads![1] = road(400);
  assert.ok(townRoads(w).includes(w.roads![1]), 'replacement preserves current object identity');
  w.roads!.push(road(500));
  assert.deepEqual(townRoads(w), w.roads);
  w.roads!.splice(0, 1);
  assert.deepEqual(townRoads(w), w.roads);
  w.roads!.reverse();
  assert.deepEqual(townRoads(w), w.roads);
  w.roads = [];
  assert.deepEqual(townRoads(w), []);
});

test('runway geometry and starter-road settings do not leave stale filtered roads', () => {
  const w = fixture();
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
  assert.deepEqual(townRoads(w), []);
  w.airfield.x = 10;
  assert.deepEqual(townRoads(w), [runway]);
  w.airfield.x = 0;
  assert.deepEqual(townRoads(w), []);
  delete w.airfield;
  assert.deepEqual(townRoads(w), [runway]);
  w.creator!.roads = true;
  assert.ok(townRoads(w).length > 1);
  const expanded = townRoads(w);
  w.townLayout = 1;
  assert.notDeepEqual(townRoads(w), expanded);
  w.creator!.roads = false;
  assert.deepEqual(townRoads(w), [runway]);
});

test('landscape replacements and worlds sharing road arrays retain their own layouts', () => {
  const w = fixture();
  w.roads = [];
  assert.deepEqual(townRoads(w), []);
  w.landscape = landscapeSchema.parse({
    paths: [
      {
        id: 'lane',
        points: [
          { x: 10, z: 10 },
          { x: 40, z: 10 },
        ],
        width: 5,
        curved: false,
      },
    ],
  });
  assert.deepEqual(townRoads(w), [{ a: { x: 10, z: 10 }, b: { x: 40, z: 10 }, width: 5 }]);
  const other = { ...w, landscape: undefined };
  assert.deepEqual(townRoads(other), []);
  assert.equal(townRoads(w).length, 1);
  w.landscape = landscapeSchema.parse({ paths: [] });
  assert.deepEqual(townRoads(w), []);
});

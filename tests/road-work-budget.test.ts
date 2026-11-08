// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { Store } from '../src/server/store';
import { growRoads, grownRoads, roadGrowthPerDay } from '../src/shared/roads';

test('daily road work yields, survives restart, and spends exactly the missed-day allowance', (t) => {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.buildings.push(makeBuilding('far', 'home', -330, -80));
  const start = w.time,
    end = start + w.settings.dayLength * 4;
  let clock = 0;
  const time = t.mock.method(performance, 'now', () => (clock += 10));
  growRoads(w, start, end);
  time.mock.restore();
  assert.ok(
    (w.roadGrowthDue ?? 0) > (w.roadGrowth ?? 0),
    'unfinished daily work must remain pending after the slice',
  );
  assert.equal(grownRoads(w).length, 0, 'no construction before the full route is validated');
  const store = new Store(':memory:');
  store.saveWorld(w);
  const restored = store.loadWorlds()[0].world;
  store.close();
  restored.time = end;
  let maximum = 0;
  for (let i = 0; i < 10000 && restored.roadGrowthDue !== undefined; i++) {
    const at = performance.now();
    growRoads(restored, end, end);
    maximum = Math.max(maximum, performance.now() - at);
  }
  assert.equal(restored.roadGrowthDue, undefined, 'pending growth completes after restart');
  assert.ok(maximum < 100, `road work slice ${maximum.toFixed(1)} ms`);
  const length = grownRoads(restored).reduce(
    (n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z),
    0,
  );
  assert.ok(Math.abs(length - 4 * roadGrowthPerDay) < 1e-6, 'keep four complete daily allowances');
});

test('an edit while surveying discards the unfinished plan before any road is laid', (t) => {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.buildings.push(makeBuilding('far', 'home', 340, -110));
  const end = w.time + w.settings.dayLength;
  let clock = 0;
  const time = t.mock.method(performance, 'now', () => (clock += 10));
  growRoads(w, w.time, end);
  time.mock.restore();
  w.settings.seaLevel = 1000;
  for (let i = 0; i < 10000 && w.roadGrowthDue !== undefined; i++) growRoads(w, end, end);
  assert.equal(w.roadGrowthDue, undefined);
  assert.equal(grownRoads(w).length, 0, 'never lay the old dry route after flooding');
});

test('survey geometry tracks scenery zones while ignoring clock and stock changes', async () => {
  const { roadGeometryKey } = await import('../src/shared/road-work');
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  const original = roadGeometryKey(w);
  w.time += 1;
  w.settings.time += 60;
  w.buildings[0].stock.potatoes = (w.buildings[0].stock.potatoes ?? 0) + 1;
  assert.equal(roadGeometryKey(w), original, 'ordinary simulation ticks must not restart work');
  w.zones.push({ id: 'clearing', x: 0, z: 0, radius: 50, kind: 'spawn' });
  assert.notEqual(roadGeometryKey(w), original, 'scenery edits invalidate the survey');
});

test('survey keys do not serialize thousands of unchanged resource records every tick', async () => {
  const { roadGeometryKey } = await import('../src/shared/road-work');
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  w.additionalResources = Array.from({ length: 5000 }, (_, i) => ({
    id: 'wood-' + i,
    item: 'logs',
    name: 'Trees',
    x: i * 3.7,
    z: 500.1,
    capacity: 100,
    regrowth: 1,
  }));
  const key = roadGeometryKey(w);
  assert.ok(key.length < 30000, 'large resource arrays must use a compact geometry stamp');
  assert.equal(roadGeometryKey(w), key);
  w.additionalResources[2500].x++;
  const moved = roadGeometryKey(w);
  assert.notEqual(moved, key, 'in-place resource moves invalidate even without a revision bump');
  w.additionalResources[2500].item = 'stone';
  assert.notEqual(roadGeometryKey(w), moved, 'resource kind changes update collision geometry');
});

test('mature survey keys stay compact while tracking in-place road and river edits', async () => {
  const { roadGeometryKey } = await import('../src/shared/road-work');
  const w = createWorld('compact-survey', 'Survey', 'owner');
  w.roads = Array.from({ length: 2003 }, (_, i) => ({
    a: { x: i, z: 300 },
    b: { x: i + 1, z: 300 },
    width: 5,
  }));
  w.northernIsland = {
    version: 1,
    seed: 123,
    radius: 10000,
    centreZ: -10000,
    preserveZ: -500,
    blendZ: -1000,
    mountain: { x: 0, z: -10000, height: 1000, radius: 2000 },
    regions: [],
    ponds: [],
    resources: [],
    previousArea: 1000,
    area: 65000,
    rivers: [
      {
        id: 'river',
        name: 'River',
        points: Array.from({ length: 2500 }, (_, i) => ({
          x: i * 1.3,
          z: -10000 + i,
          level: 1000 - i / 3,
          width: 3,
          depth: 0.3,
        })),
      },
    ],
  };
  const key = roadGeometryKey(w);
  assert.ok(key.length < 30000, `unchanged geometry key is ${key.length} characters`);
  assert.equal(roadGeometryKey(w), key);
  w.roads[1000].width++;
  let changed = roadGeometryKey(w);
  assert.notEqual(changed, key);
  for (const field of ['x', 'z', 'level', 'width', 'depth'] as const) {
    w.northernIsland.rivers[0].points[10][field]++;
    const next = roadGeometryKey(w);
    assert.notEqual(next, changed, `${field} edits invalidate the river survey`);
    changed = next;
  }
  w.roads.reverse();
  assert.notEqual(roadGeometryKey(w), changed, 'road ordering changes invalidate');
});

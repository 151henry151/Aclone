// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, advance, makeBuilding, terrainHeight } from '../src/shared/simulation.ts';
import { townRoads, roadDistance } from '../src/shared/town.ts';
import { roadGrowthPerDay, roadConnected, grownRoads } from '../src/shared/roads.ts';
import { blocksBuilding } from '../src/shared/building-shapes.ts';

function day(w: ReturnType<typeof createWorld>) {
  return w.settings.dayLength;
}

test('the starter parish is already served by lanes, so no roads grow', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  for (const b of w.buildings) assert.ok(roadConnected(w, b), `${b.id} is on the lane network`);
  const before = townRoads(w).length;
  advance(w, day(w) * 5);
  assert.equal(grownRoads(w).length, 0);
  assert.equal(townRoads(w).length, before);
});

test('a lane grows a few tractor lengths a day toward an isolated building, then stops', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const b = makeBuilding('far', 'home', 320, 60);
  b.owner = 'p';
  w.buildings.push(b);
  assert.equal(roadConnected(w, b), false);
  const start = roadDistance(townRoads(w), b.x, b.z);
  assert.ok(start > 100, `${start}`);
  const revision = w.revision;
  // Growth only happens at the game-day boundary, not continuously.
  advance(w, day(w) * 0.5);
  assert.equal(grownRoads(w).length, 0);
  advance(w, day(w) * 0.5);
  const first = grownRoads(w);
  assert.equal(first.length, 1);
  assert.ok(w.revision > revision, 'clients rebuild the ground');
  const length = Math.hypot(first[0].b.x - first[0].a.x, first[0].b.z - first[0].a.z);
  assert.ok(Math.abs(length - roadGrowthPerDay) < 0.01, `${length}`);
  assert.ok(roadGrowthPerDay >= 9 && roadGrowthPerDay <= 14, 'two or three tractor lengths');
  // Narrower than the lane it branches from, so the edge-to-edge gain is a touch under a stretch.
  assert.ok(roadDistance(townRoads(w), b.x, b.z) < start - roadGrowthPerDay + 2, 'drew nearer');
  // The new stretch starts on the existing network (a junction, not a floating stub).
  const legacy = townRoads({ ...w, roads: [] });
  assert.ok(roadDistance(legacy, first[0].a.x, first[0].a.z) <= 0.01);
  // Keep advancing: eventually connected, and then growth ceases for good.
  for (let d = 0; d < 40 && !roadConnected(w, b); d++) advance(w, day(w));
  assert.ok(roadConnected(w, b), 'connected within forty days');
  const built = grownRoads(w).length;
  const expected = Math.ceil((start - 12) / roadGrowthPerDay);
  assert.ok(Math.abs(built - expected) <= 1, `${built} stretches for ${start.toFixed(0)} m`);
  for (const r of grownRoads(w)) {
    assert.equal(r.width, 5);
    // Never pave over the destination or any neighbour.
    for (const other of w.buildings)
      for (const t of [0, 0.5, 1])
        assert.ok(
          !blocksBuilding(other, r.a.x + (r.b.x - r.a.x) * t, r.a.z + (r.b.z - r.a.z) * t, 0, 1),
          `stretch crosses ${other.id}`,
        );
  }
  advance(w, day(w) * 3);
  assert.equal(grownRoads(w).length, built, 'no growth without an unconnected building');
});

test('growth skirts buildings in the way and stays on dry land', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const target = makeBuilding('t', 'home', -300, -130);
  w.buildings.push(target);
  advance(w, day(w));
  // Drop a warehouse squarely across the lane's current heading.
  const tip = grownRoads(w)[0].b,
    heading = Math.atan2(target.x - tip.x, target.z - tip.z);
  const wall = makeBuilding(
    'wall',
    'warehouse',
    tip.x + Math.sin(heading) * 30,
    tip.z + Math.cos(heading) * 30,
  );
  w.buildings.push(wall);
  for (let d = 0; d < 60 && !roadConnected(w, target); d++) advance(w, day(w));
  assert.ok(roadConnected(w, target));
  for (const r of grownRoads(w))
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const x = r.a.x + (r.b.x - r.a.x) * t,
        z = r.a.z + (r.b.z - r.a.z) * t;
      assert.ok(!blocksBuilding(wall, x, z, 0, 1), 'went round the warehouse');
      assert.ok(terrainHeight(w, x, z) > w.settings.seaLevel, 'stayed out of the water');
    }
});

test('catch-up after a long server outage grows one stretch per missed day', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.buildings.push(makeBuilding('far', 'home', -330, -80));
  advance(w, day(w) * 4 + 1);
  assert.equal(grownRoads(w).length, 4);
});

test('a parish with no lanes at all has nothing to grow from', () => {
  const w = createWorld('blank', 'Blank', 'owner', 'playground');
  w.creator = { ...(w.creator ?? ({} as never)), roads: false } as never;
  w.buildings.push(makeBuilding('lonely', 'home', 100, 100));
  advance(w, day(w) * 3);
  assert.equal(grownRoads(w).length, 0);
});

test('grown lanes are part of the road network everyone else reads', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.buildings.push(makeBuilding('far', 'home', 320, 60));
  advance(w, day(w) * 2);
  const roads = townRoads(w);
  assert.equal(grownRoads(w).length, 2);
  assert.ok(grownRoads(w).every((g) => roads.includes(g)));
});

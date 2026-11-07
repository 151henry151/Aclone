// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadComponents, roadsTouch } from '../src/shared/road-routing';
import type { Road } from '../src/shared/town';

function exhaustive(roads: readonly Road[]) {
  const groups: Road[][] = [],
    remaining = new Set(roads);
  while (remaining.size) {
    const group = [remaining.values().next().value!];
    remaining.delete(group[0]);
    for (let i = 0; i < group.length; i++)
      for (const r of remaining)
        if (roadsTouch(group[i], r)) {
          group.push(r);
          remaining.delete(r);
        }
    groups.push(group);
  }
  return groups;
}

test('mature separated road networks do not perform exact distance checks for every pair', () => {
  const roads = Array.from({ length: 2003 }, (_, i) => ({
    a: { x: i * 30, z: 0 },
    b: { x: i * 30 + 6, z: 0 },
    width: 5,
  }));
  const hypot = Math.hypot;
  let distances = 0;
  Math.hypot = (...values: number[]) => {
    distances++;
    return hypot(...values);
  };
  try {
    const groups = roadComponents(roads);
    assert.equal(groups.length, roads.length);
    assert.ok(
      distances < roads.length * 10,
      `avoid quadratic exact checks (${distances} distances)`,
    );
  } finally {
    Math.hypot = hypot;
  }
});

test('component broad phase retains exhaustive connectivity and deterministic traversal order', () => {
  const roads: Road[] = [
    { a: { x: -1000, z: -1000 }, b: { x: 1000, z: 1000 }, width: 5 },
    { a: { x: -1000, z: 1000 }, b: { x: 1000, z: -1000 }, width: 5 },
    { a: { x: 2000, z: 2000 }, b: { x: 2000, z: 2000 }, width: 10 },
    { a: { x: 2007.05, z: 2000 }, b: { x: 2017, z: 2000 }, width: 4 },
    { a: { x: -20, z: -10 }, b: { x: -20, z: 10 }, width: 30 },
  ];
  for (let i = 0; i < 150; i++)
    roads.push({
      a: { x: ((i * 37) % 503) - 251, z: ((i * 79) % 401) - 200 },
      b: { x: ((i * 59) % 503) - 251, z: ((i * 97) % 401) - 200 },
      width: 1 + (i % 9),
    });
  roads.push(roads[0]);
  assert.deepEqual(roadComponents(roads), exhaustive(roads));
  roads[2].width = 0;
  roads[3].a.x += 1;
  assert.deepEqual(roadComponents(roads), exhaustive(roads), 'in-place edits must take effect');
  assert.deepEqual(roadComponents([]), []);
});

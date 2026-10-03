// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Waypoints, readWaypoint, waypointGuidance } from '../src/client/waypoint.ts';
test('waypoints validate saved coordinates and isolate worlds', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
    removeItem: (k: string) => {
      data.delete(k);
    },
  };
  const a = new Waypoints(storage);
  a.selectWorld('puddlewick');
  a.set({ x: 12, z: 34, name: 'Mill' });
  a.selectWorld('other');
  assert.equal(a.point, undefined);
  a.selectWorld('puddlewick');
  assert.deepEqual(a.point, { x: 12, z: 34, name: 'Mill' });
  const b = new Waypoints(storage);
  b.selectWorld('puddlewick');
  assert.deepEqual(b.point, a.point);
  b.set();
  const c = new Waypoints(storage);
  c.selectWorld('puddlewick');
  assert.equal(c.point, undefined);
  for (const raw of [
    'bad',
    '{}',
    '{"x":251,"z":0,"name":"x"}',
    '{"x":"2","z":0,"name":"x"}',
    '{"x":1e999,"z":0,"name":"x"}',
  ])
    assert.equal(readWaypoint(raw), undefined);
});
test('guidance follows tractor heading with correct left/right and distance', () => {
  const p = { x: 0, z: 0, heading: 0 };
  assert.deepEqual(waypointGuidance(p, { x: 0, z: 50, name: 'Ahead' }), { metres: 50, degrees: 0 });
  assert.equal(waypointGuidance(p, { x: 50, z: 0, name: 'Right' }).degrees, 90);
  assert.equal(waypointGuidance(p, { x: -50, z: 0, name: 'Left' }).degrees, -90);
  assert.equal(
    waypointGuidance({ ...p, heading: Math.PI / 2 }, { x: 50, z: 0, name: 'Ahead' }).degrees,
    0,
  );
  assert.equal(waypointGuidance(p, { x: 3, z: 4, name: 'Near' }).metres, 5);
});

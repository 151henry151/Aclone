// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
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
test('guidance matches the rendered camera left/right, ahead and behind', () => {
  const p = { x: 0, z: 0 };
  assert.deepEqual(waypointGuidance(p, { x: 0, z: 50, name: 'Ahead' }, 0), {
    metres: 50,
    degrees: 0,
  });
  // Looking along +z, the renderer puts positive world x on the LEFT.
  assert.equal(waypointGuidance(p, { x: 50, z: 0, name: 'Left' }, 0).degrees, -90);
  assert.equal(waypointGuidance(p, { x: -50, z: 0, name: 'Right' }, 0).degrees, 90);
  assert.equal(Math.abs(waypointGuidance(p, { x: 0, z: -50, name: 'Behind' }, 0).degrees), 180);
  assert.equal(waypointGuidance(p, { x: 50, z: 0, name: 'Ahead' }, Math.PI / 2).degrees, 0);
  assert.equal(waypointGuidance(p, { x: 3, z: 4, name: 'Near' }, 0).metres, 5);
  // Orbiting reverses screen sides without moving or turning the player.
  assert.equal(waypointGuidance(p, { x: 50, z: 0, name: 'Right' }, Math.PI).degrees, 90);
});
test('waypoints accept the whole configured map, not just the old village square', () => {
  assert.equal(readWaypoint('{"x":2600,"z":-4100,"name":"Far farm"}'), undefined);
  assert.deepEqual(readWaypoint('{"x":2600,"z":-4100,"name":"Far farm"}', 6250), {
    x: 2600,
    z: -4100,
    name: 'Far farm',
  });
  assert.equal(readWaypoint('{"x":6251,"z":0,"name":"x"}', 6250), undefined);
  const data = new Map<string, string>();
  const w = new Waypoints({
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  w.selectWorld('puddlewick', 6250);
  w.set({ x: 2600, z: -4100, name: 'Far farm' });
  assert.equal(w.point?.x, 2600);
  const again = new Waypoints({
    getItem: (k: string) => data.get(k) ?? null,
    setItem: () => {},
    removeItem: () => {},
  });
  again.selectWorld('puddlewick', 6250);
  assert.equal(again.point?.z, -4100);
  again.selectWorld('arena', 250);
  again.set({ x: 400, z: 0, name: 'Out of bounds' });
  assert.equal(again.point, undefined);
});

test('arrow sides agree with Three.js projection across chase, first-person and overhead views', () => {
  const p = { x: 5, z: 7 };
  for (const [x, y, z] of [
    [5, 9, -14],
    [-16, 9, 7],
    [5, 1.8, 7],
    [5, 65, 10],
  ]) {
    const camera = new PerspectiveCamera(53, 1.6, 0.1, 950);
    camera.position.set(x, y, z);
    camera.lookAt(5, 0, x === 5 && z === 7 ? 40 : 7);
    camera.updateMatrixWorld(true);
    const facing = camera.getWorldDirection(new Vector3());
    const heading = Math.atan2(facing.x, facing.z);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    for (const side of [-1, 1]) {
      const target = new Vector3(p.x, 0, p.z)
        .addScaledVector(facing, 40)
        .addScaledVector(right, side * 15);
      target.y = 0;
      const screen = target.clone().project(camera);
      const origin = new Vector3(p.x, 0, p.z).addScaledVector(facing, 40);
      origin.y = 0;
      origin.project(camera);
      const guidance = waypointGuidance(p, { x: target.x, z: target.z, name: 'Target' }, heading);
      assert.equal(
        Math.sign(Math.sin((guidance.degrees * Math.PI) / 180)),
        Math.sign(screen.x - origin.x),
      );
    }
  }
});

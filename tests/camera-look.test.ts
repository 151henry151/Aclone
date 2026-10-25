// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { vehicleGround } from '../src/client/vehicle-ground';
import {
  cabView,
  chaseOffset,
  lookPitchFromDrag,
  cameraSurfaceFloor,
} from '../src/client/camera-look.ts';

test('vertical drag tilts chase and first-person cameras, not the overhead view', () => {
  assert.equal(lookPitchFromDrag(0, 10, 0), 0.04);
  assert.equal(lookPitchFromDrag(0, 10, 1), 0.04);
  assert.equal(lookPitchFromDrag(0, 10, 2), 0);
  assert.equal(lookPitchFromDrag(1.4, 50, 0), 1.4);
  assert.equal(lookPitchFromDrag(-1.1, -50, 0), -1.1);
});

test('chase camera keeps its default seat and orbits up or down with look pitch', () => {
  const rest = chaseOffset(0, 1, false, 0);
  assert.ok(Math.abs(rest.x) < 1e-12);
  assert.equal(rest.y, 8.5);
  assert.equal(rest.z, -21);
  const walk = chaseOffset(0, 1, true, 0);
  assert.equal(walk.y, 3);
  assert.equal(walk.z, -6);
  const up = chaseOffset(0, 1, false, 0.4);
  assert.ok(up.y < rest.y, 'looking up lowers the chase camera toward the horizon');
  assert.ok(Math.abs(up.z) > Math.abs(rest.z), 'looking up moves the camera farther behind');
  const down = chaseOffset(0, 1, false, -0.4);
  assert.ok(down.y > rest.y, 'looking down raises the chase camera');
  const side = chaseOffset(Math.PI / 2, 1, false, 0);
  assert.ok(Math.abs(side.x + 21) < 1e-9);
  assert.ok(Math.abs(side.z) < 1e-9);
});

test('cab camera inherits uphill, downhill and side slopes while retaining local mouse look', () => {
  for (const [dx, dz] of [
    [0, 0],
    [0, 0.4],
    [0, -0.4],
    [0.35, 0],
    [-0.35, 0.25],
  ]) {
    for (const heading of [0, 0.7, Math.PI / 2, Math.PI]) {
      const ground = vehicleGround(20, 30, heading, (x, z) => dx * x + dz * z);
      const attitude = new Quaternion().setFromEuler(ground.rotation);
      for (const [yaw, pitch] of [
        [0, 0],
        [0, -0.12],
        [0.8, 0.5],
        [-0.6, -0.4],
      ]) {
        const view = cabView(attitude, yaw, pitch);
        const camera = new PerspectiveCamera();
        camera.position.set(0, 0, 0);
        camera.up.copy(view.up);
        camera.lookAt(view.direction);
        const localForward = camera
          .getWorldDirection(new Vector3())
          .applyQuaternion(attitude.clone().invert());
        const expected = new Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        );
        assert.ok(
          localForward.distanceTo(expected) < 1e-9,
          'look remains relative to the tilted cab',
        );
        const localRight = new Vector3(1, 0, 0)
          .applyQuaternion(camera.quaternion)
          .applyQuaternion(attitude.clone().invert());
        assert.ok(
          Math.abs(localRight.y) < 1e-9,
          'dashboard stays level relative to the seated camera',
        );
        const normal = new Vector3(-dx, 1, -dz).normalize();
        assert.ok(
          view.up.distanceTo(normal) < 1e-9,
          'camera up follows the ground-aligned tractor',
        );
      }
    }
  }
});

test('camera orbit stays above deep water at every heading, zoom and sea level', () => {
  for (const sea of [-12, 0, 35])
    for (const heading of [0, 1, 3, 5])
      for (const zoom of [0.5, 1, 3]) {
        const orbit = chaseOffset(heading, zoom, false, 1.4);
        assert.ok(orbit.y < 0, 'fixture exercises the underwater orbit');
        assert.equal(Math.max(sea + orbit.y, cameraSurfaceFloor(sea - 500, sea, 0.6)), sea + 0.6);
        assert.equal(cameraSurfaceFloor(sea + 20, sea, 0.6), sea + 20 + 0.6);
      }
});

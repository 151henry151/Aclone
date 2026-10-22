// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Quaternion } from 'three';
import { vehicleGround } from '../src/client/vehicle-ground.ts';

test('tractor tyres meet uphill, downhill and cross slopes at any heading', () => {
  for (const [dx, dz] of [
    [0, 0],
    [0, 0.4],
    [0, -0.4],
    [0.3, 0.2],
    [-0.3, 0.2],
  ]) {
    const sample = (x: number, z: number) => 15 + dx * x + dz * z;
    for (const heading of [0, 0.7, Math.PI / 2, Math.PI, 5]) {
      const pose = vehicleGround(24, -12, heading, sample);
      const q = new Quaternion().setFromEuler(pose.rotation);
      for (const x of [-1.22 * 0.82, 1.22 * 0.82])
        for (const z of [-1.15 * 0.82, 1.37 * 0.82]) {
          const tyre = new Vector3(x, 0, z).applyQuaternion(q).add(new Vector3(24, pose.y, -12));
          assert.ok(
            Math.abs(tyre.y - sample(tyre.x, tyre.z)) < 1e-7,
            `tyre grounded on ${dx},${dz} at heading ${heading}`,
          );
        }
      assert.equal(pose.rotation.y, heading, 'steering heading preserved');
    }
  }
});
test('pitch reverses when a tractor turns around on the same slope', () => {
  const slope = (_x: number, z: number) => z * 0.5;
  assert.ok(vehicleGround(0, 0, 0, slope).rotation.x < 0);
  assert.ok(vehicleGround(0, 0, Math.PI, slope).rotation.x > 0);
  assert.ok(vehicleGround(0, 0, Math.PI / 2, slope).rotation.z < 0);
});

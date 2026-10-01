// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Vector3 } from 'three';
import { freezeScenery } from '../src/client/static-scene.ts';
test('static scenery skips matrix recomputation while a mill and its blade children still animate', () => {
  const scene = new Group(),
    town = new Group(),
    house = new Object3D(),
    rotor = new Group(),
    blade = new Object3D();
  scene.add(town);
  town.add(house, rotor);
  rotor.add(blade);
  house.position.set(10, 2, 3);
  rotor.position.set(4, 5, 6);
  blade.position.x = 2;
  freezeScenery(town, [rotor]);
  const original = house.matrixWorld.clone();
  let staticUpdates = 0;
  house.matrixWorld.multiplyMatrices = () => {
    staticUpdates++;
    return house.matrixWorld;
  };
  for (let i = 0; i < 10; i++) {
    rotor.rotation.z += Math.PI / 20;
    scene.updateMatrixWorld();
  }
  assert.equal(staticUpdates, 0);
  assert.deepEqual(house.matrixWorld.elements, original.elements);
  const at = blade.getWorldPosition(new Vector3());
  assert.ok(at.distanceTo(new Vector3(4, 7, 6)) < 1e-8);
});

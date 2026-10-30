// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Object3D, Vector3, Mesh, BoxGeometry, MeshStandardMaterial, Box3 } from 'three';
import { batchStaticScenery, freezeScenery } from '../src/client/static-scene.ts';
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

test('gate arms remain attached and visibly lift after the production batching and freeze passes', () => {
  const world = new Group(),
    site = new Group(),
    hinge = new Group();
  world.add(site);
  site.position.set(100, 10, 200);
  site.rotation.y = Math.PI / 4;
  const fixed = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial());
  const arm = new Mesh(new BoxGeometry(7.5, 0.22, 0.18), new MeshStandardMaterial());
  arm.position.x = 3.75;
  hinge.position.y = 1.45;
  hinge.userData.spaceportGate = -1;
  site.add(fixed, hinge);
  hinge.add(arm);
  batchStaticScenery(world);
  assert.equal(fixed.parent, null, 'ordinary scenery still batches');
  assert.equal(arm.parent, hinge, 'visible arm stays attached to moving hinge');
  freezeScenery(world, [hinge]);
  const closed = new Box3().setFromObject(hinge).getSize(new Vector3());
  hinge.rotation.z = Math.PI * 0.47;
  world.updateMatrixWorld();
  const raised = new Box3().setFromObject(hinge).getSize(new Vector3());
  assert.ok(closed.y < 0.3);
  assert.ok(raised.y > 7.4, 'actual rendered geometry rises, not just an empty pivot');
  hinge.rotation.z = 0;
  world.updateMatrixWorld();
  assert.ok(new Box3().setFromObject(hinge).getSize(new Vector3()).distanceTo(closed) < 1e-8);
});

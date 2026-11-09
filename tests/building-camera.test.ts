// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { BuildingCamera } from '../src/client/building-camera';

function obstructed(target: T.Vector3, position: T.Vector3, box: T.Box3) {
  const offset = position.clone().sub(target),
    length = offset.length();
  const hit = new T.Ray(target, offset.normalize()).intersectBox(box, new T.Vector3());
  return !!hit && target.distanceTo(hit) < length;
}
test('a highway chase view clears a factory wall and roof without clipping into its driver', () => {
  const building = new T.Group();
  const bounds = new T.Box3(new T.Vector3(-18, 20, -15), new T.Vector3(18, 38, 15));
  building.userData.cameraVolumes = [bounds];
  const solver = new BuildingCamera();
  for (const z of [19, 22, 30, 40]) {
    const target = new T.Vector3(5, 21.6, z);
    const camera = { position: new T.Vector3(5, 28.5, z - 21), near: 0.1 };
    solver.clear(target, camera, [building]);
    assert.equal(obstructed(target, camera.position, bounds), false, 'Clear the entire sight line');
    assert.ok(camera.position.distanceTo(target) >= 10, 'Retain a useful exterior camera distance');
    assert.ok(camera.position.y >= 28.5, 'Do not lower the lens into the ground');
  }
});
test('cached building camera bounds remain unchanged and clear or interior views are left alone', () => {
  const building = new T.Group();
  const bounds = new T.Box3(new T.Vector3(-18, 20, -15), new T.Vector3(18, 38, 15));
  building.userData.cameraVolumes = [bounds];
  const before = bounds.clone(),
    solver = new BuildingCamera();
  for (const target of [new T.Vector3(0, 22, 0), new T.Vector3(60, 22, 60)]) {
    const position = target.clone().add(new T.Vector3(0, 7, -21));
    const expected = position.clone();
    solver.clear(target, { position, near: 0.1 }, [building]);
    assert.deepEqual(position, expected);
  }
  assert.deepEqual(bounds, before);
});

test('a rotated assembly hall clears the view from the empty corner beside its office annex', () => {
  for (const angle of [0, Math.PI / 2]) {
    const building = new T.Group();
    building.position.set(100, 20, 200);
    building.rotation.y = angle;
    const volumes = [
      new T.Box3(new T.Vector3(-15, 0, -12), new T.Vector3(15, 10.4, 12)),
      new T.Box3(new T.Vector3(-14, 0, 12), new T.Vector3(-6, 3.6, 18)),
    ];
    building.userData.cameraVolumes = volumes;
    const target = building.localToWorld(new T.Vector3(5, 1.6, 17));
    const position = building.localToWorld(new T.Vector3(5, 8.5, -4));
    const camera = { position, near: 0.1 };
    new BuildingCamera().clear(target, camera, [building]);
    for (const volume of volumes)
      assert.equal(
        obstructed(target, position, volume.clone().applyMatrix4(building.matrix)),
        false,
      );
  }
});

test('the factory roof cannot hide the truck chassis while the chase camera clears the cab', () => {
  const building = new T.Group();
  const bounds = new T.Box3(new T.Vector3(-15, 20, -12), new T.Vector3(15, 30.4, 12));
  building.userData.cameraVolumes = [bounds];
  const solver = new BuildingCamera();
  for (const z of [17, 20, 24, 28, 32, 36]) {
    const target = new T.Vector3(5, 21.6, z);
    const camera = { position: new T.Vector3(5, 28.5, z - 21), near: 0.1 };
    solver.clear(target, camera, [building], Math.hypot(6.4, 2.55) / 2);
    for (const x of [-1.275, 1.275])
      for (const dz of [-3.2, 3.2])
        assert.equal(
          obstructed(new T.Vector3(5 + x, 20.3, z + dz), camera.position, bounds),
          false,
          `Keep the chassis visible at distance ${z}`,
        );
  }
});

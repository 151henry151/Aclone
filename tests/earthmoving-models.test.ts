// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld } from '../src/shared/simulation';
import { vehicleDef } from '../src/shared/vehicle-config';

test('earthmovers have bounded detailed geometry, real operator scale and independent implement joints', async () => {
  const { createEarthmover } = await import('../src/client/earthmoving-model');
  const w = createWorld('plant-model', 'Plant', 'p');
  for (const slot of [38, 39]) {
    const g = createEarthmover(w, slot),
      v = vehicleDef(w, slot);
    let triangles = 0,
      meshes = 0;
    g.traverse((o) => {
      if (o instanceof T.Mesh) {
        meshes++;
        triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
        assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
      }
    });
    assert.ok(triangles < 16000, `${triangles} triangles`);
    assert.ok(meshes < 65, `${meshes} meshes`);
    const b = new T.Box3().setFromObject(g);
    assert.ok(b.max.y >= v.height! - 0.15 && b.max.y < v.height! + 0.2);
    assert.ok(b.max.x - b.min.x <= v.width! + 0.1);
    assert.ok(b.max.z - b.min.z <= v.length! + 0.2);
    assert.equal(g.userData.driver.scale.y, 1);
    assert.ok(g.getObjectByName('cab-interior'));
    assert.ok(g.getObjectByName('exhaust'));
    assert.ok(g.userData.eye.y > 2);
    const blade = g.getObjectByName(slot === 38 ? 'blade' : 'loader')!;
    assert.ok(blade);
    const before = blade.position.y;
    g.userData.earthmovingAnimate(true, 1, 1, 0.25);
    assert.notEqual(blade.position.y, before, 'implement lifts separately');
    if (slot === 38) {
      const track = g.getObjectByName('track-plates')!;
      assert.ok(track instanceof T.InstancedMesh);
      assert.ok(g.userData.tyreFootprints.every((p: any) => p.width > 0.5));
      const matrix = track.instanceMatrix.array.slice();
      g.userData.earthmovingAnimate(true, 1, 1, 0.25);
      assert.notDeepEqual(track.instanceMatrix.array, matrix, 'plates move around tracks');
    } else {
      assert.equal(g.userData.wheels.length, 4);
      for (const n of ['boom', 'stick', 'digging-bucket', 'stabilisers'])
        assert.ok(g.getObjectByName(n));
      const boom = g.getObjectByName('boom')!;
      const angle = boom.rotation.x;
      g.userData.earthmovingAnimate(true, 1, 1, 0.25);
      assert.notEqual(boom.rotation.x, angle);
    }
  }
});

test('tracked machines print straight plates rather than chevron tyre bars', async () => {
  const { platePrintTexture } = await import('../src/client/ground-tracks');
  const t = platePrintTexture(),
    { width, height, data } = t.image;
  const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
  let bars = 0,
    gaps = 0;
  for (let y = 12; y < height - 12; y++) {
    assert.equal(alpha(Math.floor(width * 0.3), y), alpha(Math.floor(width * 0.7), y));
    if (alpha(width / 2, y) > 150) bars++;
    else gaps++;
  }
  assert.ok(bars > 0 && gaps > 0, 'separate transverse track plates');
});

test('vehicle visual configuration retains model-specific track contacts by default', async () => {
  const { createEarthmover } = await import('../src/client/earthmoving-model');
  const { configureVehicleVisual } = await import('../src/client/vehicle-custom');
  const w = createWorld('plant-prints', 'Plant', 'p'),
    g = createEarthmover(w, 38);
  const before = g.userData.tyreFootprints;
  configureVehicleVisual(g, w, 38);
  assert.deepEqual(g.userData.tyreFootprints, before);
  w.vehicleTuning = { 38: { tracks: false } };
  configureVehicleVisual(g, w, 38);
  assert.deepEqual(g.userData.tyreFootprints, []);
});

test('idle bulldozers do not upload stationary track matrices every frame', async () => {
  const { createEarthmover } = await import('../src/client/earthmoving-model');
  const g = createEarthmover(createWorld('idle-plant', 'Plant', 'p'), 38);
  const plates = g.getObjectByName('track-plates') as T.InstancedMesh;
  const version = plates.instanceMatrix.version;
  for (let i = 0; i < 60; i++) g.userData.earthmovingAnimate(false, 0, 0, 1 / 60);
  assert.equal(plates.instanceMatrix.version, version);
});

test('earthmover lamp lenses emit only while the lighting switch is on', async () => {
  const { createEarthmover } = await import('../src/client/earthmoving-model');
  const { updateVehicleLamps } = await import('../src/client/vehicle-lights');
  const g = createEarthmover(createWorld('plant-lamps', 'Plant', 'p'), 38);
  updateVehicleLamps(g, true);
  const lamps = g.userData.switchableLamps as T.MeshStandardMaterial[];
  assert.ok(lamps.length >= 2);
  assert.ok(lamps.every((m) => m.emissiveIntensity > 0 && m.emissive.getHex() !== 0));
  updateVehicleLamps(g, false);
  assert.ok(lamps.every((m) => m.emissiveIntensity === 0));
});

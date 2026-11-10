// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { buildingModel } from '../src/client/buildings';
import { ConstructionGhost } from '../src/client/construction-ghost';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { foundationProfile } from '../src/shared/construction-site';
test('construction ghost uses real design/site, caches geometry, and cleans up its private scene and camera', () => {
  const w = createWorld('ghost', 'Ghost', 'owner');
  w.buildings = [];
  const b = makeBuilding('preview', 'warehouse', 80, 40);
  Object.assign(b, {
    architecture: 'model-3',
    style: 'metal-panel',
    size: 'large',
    rotation: Math.PI / 2,
  });
  b.foundationY = foundationProfile(w, b).level;
  const before = JSON.stringify(w),
    scene = new T.Scene(),
    camera = new T.PerspectiveCamera(50, 1.6, 0.1, 10000);
  camera.position.set(1, 2, 3);
  const position = camera.position.clone(),
    rotation = camera.quaternion.clone();
  const ghost = new ConstructionGhost(scene, camera, (b) => buildingModel(b, (m) => m));
  ghost.show(b, w, '');
  const group = ghost.group!;
  assert.ok(scene.children.includes(group));
  assert.deepEqual(group.position.toArray(), [b.x, b.foundationY, b.z]);
  assert.equal(group.rotation.y, b.rotation);
  const box = new T.Box3().setFromObject(group);
  assert.ok(box.getSize(new T.Vector3()).length() > 15);
  let meshes = 0;
  group.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        assert.ok(m.transparent && m.opacity > 0 && m.opacity < 1);
        assert.equal(m.depthWrite, false);
      }
    }
  });
  assert.ok(meshes > 0);
  ghost.frame(1440, 900);
  assert.notDeepEqual(camera.position.toArray(), position.toArray());
  const sample = group.children.find((o) => o instanceof T.Mesh) as T.Mesh<
    T.BufferGeometry,
    T.MeshBasicMaterial
  >;
  const validColor = sample.material.color.getHex();
  ghost.show(b, w, 'Too close to another building');
  assert.notEqual(sample.material.color.getHex(), validColor);
  assert.equal(ghost.group, group, 'status updates reuse geometry');
  assert.equal(JSON.stringify(w), before, 'preview does not mutate shared world');
  let disposed = false;
  const mesh = group.children.find((o) => o instanceof T.Mesh) as T.Mesh;
  mesh.geometry.addEventListener('dispose', () => (disposed = true));
  ghost.clear();
  assert.equal(ghost.group, undefined);
  assert.equal(scene.children.length, 0);
  assert.ok(disposed);
  assert.deepEqual(camera.position.toArray(), position.toArray());
  assert.deepEqual(camera.quaternion.toArray(), rotation.toArray());
  assert.ok(!camera.view?.enabled);
  ghost.frame(430, 932);
  assert.deepEqual(camera.position.toArray(), position.toArray());
});

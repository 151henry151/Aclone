// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HorizonLand, horizonGeometry } from '../src/client/horizon-land';
import { GroundTiles } from '../src/client/ground';
import { createWorld } from '../src/shared/simulation';
import { earthDrop } from '../src/shared/marine-visibility';
function fixture() {
  const w = createWorld('horizon-culling', 'Horizon', 'owner');
  w.settings.mapSize = 2500;
  w.buildings = [];
  w.coastalBluffs = [
    { id: 'cliff', x: 576, z: 576, angle: 0, width: 100, inland: 140, height: 35, seed: 3 },
  ];
  return w;
}
function finish(h: HorizonLand) {
  let resumes = 0;
  while (h.prepare(0)) resumes++;
  return resumes;
}
function land(h: HorizonLand) {
  return h.group.children.filter(
    (m): m is T.Mesh<T.BufferGeometry, T.MeshLambertMaterial> =>
      m instanceof T.Mesh && m.material instanceof T.MeshLambertMaterial,
  );
}
function triangles(geometries: T.BufferGeometry[]) {
  const result: string[] = [];
  for (const g of geometries) {
    const p = g.getAttribute('position'),
      n = g.getAttribute('normal');
    for (let i = 0; i < g.index!.count; i += 3) {
      const triangle: number[] = [];
      for (let j = 0; j < 3; j++) {
        const k = g.index!.getX(i + j);
        triangle.push(p.getX(k), p.getY(k), p.getZ(k), n.getX(k), n.getY(k), n.getZ(k));
      }
      result.push(triangle.join(','));
    }
  }
  return result.sort();
}
test('distant land partitions the original terrain without changing triangles or normals', () => {
  const w = fixture(),
    h = new HorizonLand();
  h.reset(w);
  assert.ok(finish(h) > 100, 'preparation must yield');
  const parts = land(h);
  assert.ok(parts.length > 1, 'offscreen island sections must be independently culled');
  const job = horizonGeometry(w);
  let step = job.next();
  while (!step.done) step = job.next();
  assert.deepEqual(triangles(parts.map((m) => m.geometry)), triangles([step.value]));
  step.value.dispose();
  assert.equal(
    h.group.children.filter((m) => m instanceof T.Mesh && m.material instanceof T.MeshBasicMaterial)
      .length,
    1,
    'retain one curved sea',
  );
});
test('culling bounds contain curvature-displaced terrain from nearby, high and offshore cameras', () => {
  const w = fixture(),
    h = new HorizonLand();
  h.reset(w);
  finish(h);
  const camera = new T.PerspectiveCamera(),
    ground = new GroundTiles();
  for (const position of [
    [0, 4, 0],
    [1000, 1200, 500],
    [30000, 4, -30000],
  ]) {
    camera.position.set(position[0], position[1], position[2]);
    h.update(w, camera, ground, w.settings.seaLevel, 1);
    for (const mesh of land(h)) {
      assert.equal(mesh.frustumCulled, true, 'terrain sections must use the camera frustum');
      const p = mesh.geometry.getAttribute('position'),
        sphere = mesh.geometry.boundingSphere!;
      assert.ok(sphere);
      for (let i = 0; i < p.count; i++) {
        const v = new T.Vector3().fromBufferAttribute(p, i);
        v.y -= earthDrop(Math.hypot(v.x - camera.position.x, v.z - camera.position.z));
        assert.ok(
          sphere.center.distanceTo(v) <= sphere.radius + 1e-5,
          'curved vertex must remain inside its culling bound',
        );
      }
    }
  }
});
test('reset cancels partially prepared sections and retires each shared material once', () => {
  const w = fixture(),
    h = new HorizonLand();
  h.reset(w);
  const indexed: T.BufferGeometry[] = [];
  const original = T.BufferGeometry.prototype.setIndex;
  T.BufferGeometry.prototype.setIndex = function (index) {
    indexed.push(this);
    return original.call(this, index);
  };
  try {
    // The complete source is indexed first, then individual copied sections.
    while (indexed.length < 2) assert.equal(h.prepare(0), true);
  } finally {
    T.BufferGeometry.prototype.setIndex = original;
  }
  const disposals = new Map<T.BufferGeometry, number>();
  for (const geometry of indexed) {
    disposals.set(geometry, 0);
    geometry.addEventListener('dispose', () =>
      disposals.set(geometry, disposals.get(geometry)! + 1),
    );
  }
  h.reset(w);
  for (const count of disposals.values()) assert.equal(count, 1);
  finish(h);
  const parts = land(h),
    material = parts[0].material;
  let retired = 0;
  material.addEventListener('dispose', () => retired++);
  h.reset(w);
  assert.equal(retired, 1, 'one shared land material is retired once');
  const empty = createWorld('empty', 'Empty', 'owner');
  empty.settings.mapSize = 500;
  h.reset(empty);
  finish(h);
  assert.ok(land(h).length > 0, 'the replacement world finishes without stale sections');
});
test('stationary horizon sections reuse transforms while the sea follows the camera', () => {
  const w = fixture(),
    h = new HorizonLand(),
    scene = new T.Scene();
  scene.add(h.group);
  h.reset(w);
  finish(h);
  let composed = 0,
    multiplied = 0;
  for (const mesh of land(h)) {
    const compose = mesh.matrix.compose.bind(mesh.matrix);
    mesh.matrix.compose = (...args) => {
      composed++;
      return compose(...args);
    };
    const multiply = mesh.matrixWorld.multiplyMatrices.bind(mesh.matrixWorld);
    mesh.matrixWorld.multiplyMatrices = (...args) => {
      multiplied++;
      return multiply(...args);
    };
  }
  const camera = new T.PerspectiveCamera(),
    ground = new GroundTiles();
  for (let i = 0; i < 10; i++) {
    camera.position.set(i * 50, 100, i * -70);
    h.update(w, camera, ground, w.settings.seaLevel, 1);
    scene.updateMatrixWorld();
  }
  assert.equal(composed, 0, 'do not replace GPU work with per-frame static matrix composition');
  assert.equal(multiplied, 0, 'static world transforms stay baked');
  const sea = h.group.children.find(
    (m) => m instanceof T.Mesh && m.material instanceof T.MeshBasicMaterial,
  )!;
  assert.equal(sea.position.x, camera.position.x);
  assert.equal(sea.position.z, camera.position.z);
});

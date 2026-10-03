// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { detailTexture } from '../src/client/detail-textures.ts';
import { buildingModel } from '../src/client/buildings.ts';
import { makeBuilding, createWorld } from '../src/shared/simulation.ts';
import { TownLighting } from '../src/client/lighting.ts';
import { tractor } from '../src/client/tractor.ts';
function triangles(root: T.Object3D) {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh)
      n += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  return n;
}
test('shared detail textures are bounded and luminous window masks exclude frames', () => {
  for (const kind of [
    'window',
    'window-light',
    'door',
    'siding',
    'grille',
    'vents',
    'tyre',
    'rim',
    'paint',
    'livestock',
  ] as const) {
    const t = detailTexture(kind);
    assert.equal(t, detailTexture(kind));
    assert.ok(t.image.width * t.image.height <= 262144);
    assert.ok(t.generateMipmaps);
    assert.ok(t.userData.shared);
  }
  const data = detailTexture('window-light').image.data as Uint8Array;
  assert.equal(data[(128 * 256 + 128) * 4], 0);
  assert.equal(data[0], 0);
  assert.ok(data[(64 * 256 + 64) * 4] > 150);
});
test('textured window quads keep emissive masks and ground-light sources after batching', () => {
  const w = createWorld('window-test', 'Window test', 'owner'),
    b = makeBuilding('house', 'home', 0, 0);
  b.smoking = true;
  w.buildings = [b];
  w.settings.time = 72000;
  const root = buildingModel(b, (m) => m);
  assert.ok(triangles(root) < 600);
  const windows: T.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof T.Mesh && o.userData.lightSource) windows.push(o);
  });
  assert.ok(windows.length >= 4);
  assert.ok(windows.every((o) => o.geometry.index?.count === 6));
  const lights = new TownLighting();
  lights.reset(root);
  lights.update(w, new T.Vector3(0, 0, 0));
  let active = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const m = o.material as T.MeshStandardMaterial;
      if (m.emissiveMap) {
        assert.equal(m.emissiveMap, detailTexture('window-light'));
        if (m.emissiveIntensity > 0) active++;
      }
    }
  });
  assert.ok(active > 0);
  assert.ok(lights.group.children.some((o) => o instanceof T.SpotLight && o.intensity > 0));
  w.settings.time = 43200;
  lights.update(w, new T.Vector3());
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const m = o.material as T.MeshStandardMaterial;
      if (m.emissiveMap) assert.equal(m.emissiveIntensity, 0);
    }
  });
});
test('tractor and occupant stay below half the former detailed mesh budget with independent rolling wheels', () => {
  const g = new T.Group();
  tractor(g, '#aa3322', () => new T.Mesh(new T.PlaneGeometry(0, 0), new T.MeshBasicMaterial()));
  assert.ok(triangles(g) < 15000);
  assert.equal(g.userData.wheels.length, 4);
  for (const wheel of g.userData.wheels) assert.ok(wheel.children.length > 0);
});

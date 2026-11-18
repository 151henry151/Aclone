// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World } from '../shared/types';
import type { GarageBay } from '../shared/garage-bay';
import { terrainHeight } from '../shared/terrain';

/** Thin terrain-following concrete and paint; no new physical obstacle or level change. */
export function garageBayModel(w: World, bay: GarageBay) {
  const group = new T.Group();
  group.name = 'garage-storage-bay';
  const concrete = new T.MeshStandardMaterial({ color: '#85857a', roughness: 1 });
  const paint = new T.MeshStandardMaterial({ color: '#f1c936', roughness: 0.9 });
  const surface = (
    x: number,
    z: number,
    width: number,
    depth: number,
    material: T.Material,
    lift: number,
  ) => {
    const geometry = new T.PlaneGeometry(
      width,
      depth,
      Math.max(1, Math.ceil(width)),
      Math.max(1, Math.ceil(depth)),
    );
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position,
      c = Math.cos(bay.heading),
      s = Math.sin(bay.heading);
    for (let i = 0; i < positions.count; i++) {
      const lx = x + positions.getX(i),
        lz = z + positions.getZ(i);
      const wx = bay.x + lx * c + lz * s,
        wz = bay.z - lx * s + lz * c;
      positions.setXYZ(i, wx, terrainHeight(w, wx, wz) + lift, wz);
    }
    geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  surface(0, 0, bay.width + 0.6, bay.depth + 0.6, concrete, 0.035);
  for (const side of [-1, 1]) {
    for (let z = -bay.depth / 2; z < bay.depth / 2; z += 1.8) {
      const length = Math.min(1, bay.depth / 2 - z);
      surface((side * bay.width) / 2, z + length / 2, 0.16, length, paint, 0.055);
    }
    for (let x = -bay.width / 2; x < bay.width / 2; x += 1.8) {
      const length = Math.min(1, bay.width / 2 - x);
      surface(x + length / 2, (side * bay.depth) / 2, length, 0.16, paint, 0.055);
    }
  }
  // One concrete draw and one paint draw, independent of bay size/dash count.
  const markings = group.children.slice(1) as T.Mesh<T.BufferGeometry>[];
  const merged = new T.Mesh(mergeGeometries(markings.map((m) => m.geometry))!, paint);
  merged.receiveShadow = true;
  for (const mesh of markings) {
    group.remove(mesh);
    mesh.geometry.dispose();
  }
  group.add(merged);
  return group;
}

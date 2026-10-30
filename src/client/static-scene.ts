// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Bake static local/world matrices once, while explicitly preserving animated
 * subtrees such as mill blades. Rebuilding the town creates fresh objects. */
export function freezeScenery(root: Object3D, animated: Object3D[]) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.matrixWorldAutoUpdate = false;
  });
  for (const branch of animated) {
    branch.matrixAutoUpdate = true;
    branch.traverse((o) => {
      o.matrixWorldAutoUpdate = true;
    });
  }
}

/** Batch static scenery at the world origin; animated parts retain their hierarchy. */
export function batchStaticScenery(root: T.Group, excluded?: T.Object3D) {
  root.updateMatrixWorld(true);
  const batches = new Map<string, { geometries: T.BufferGeometry[]; material: T.Material }>();
  const originals: T.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || o === excluded || Array.isArray(o.material)) return;
    const mat = o.material as T.MeshStandardMaterial;
    if (
      o.userData.lightSource ||
      o.userData.hayStack ||
      mat.transparent ||
      mat.vertexColors ||
      !(mat instanceof T.MeshStandardMaterial)
    )
      return;
    let parent: T.Object3D | null = o;
    while (parent) {
      if (
        parent.userData.blades ||
        parent.userData.creatorModel ||
        parent.userData.animatedFlight ||
        parent.userData.spaceportGate
      )
        return;
      parent = parent.parent;
    }
    const key = [
      mat.color.getHexString(),
      mat.map?.uuid,
      mat.roughness,
      mat.metalness,
      mat.side,
      mat.emissive.getHexString(),
    ].join(':');
    const batch = batches.get(key) ?? { geometries: [], material: mat.clone() };
    batch.geometries.push(
      (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
        o.matrixWorld,
      ),
    );
    batches.set(key, batch);
    originals.push(o);
  });
  for (const o of originals) {
    o.removeFromParent();
    o.geometry.dispose();
    (o.material as T.Material).dispose();
  }
  for (const batch of batches.values()) {
    const merged = mergeGeometries(batch.geometries);
    for (const g of batch.geometries) g.dispose();
    if (merged) {
      const mesh = new T.Mesh(merged, batch.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
}

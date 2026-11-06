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
  // Door leaves and interior effects move independently inside their retained
  // hierarchy. Static building exteriors still keep their baked matrices.
  root.traverse((o) => {
    if (o.userData.bayDoor || o.userData.interior) {
      o.traverse((part) => {
        part.matrixAutoUpdate = true;
        part.matrixWorldAutoUpdate = true;
      });
    }
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
  for (const _ of batchStaticScenerySteps(root, excluded)) {
    /* synchronous callers */
  }
}
export function* batchStaticScenerySteps(root: T.Group, excluded?: T.Object3D) {
  root.updateMatrixWorld(true);
  const batches = new Map<string, { geometries: T.BufferGeometry[]; material: T.Material }>();
  const originals: T.Mesh[] = [];
  const objects: T.Object3D[] = [];
  root.traverse((o) => objects.push(o));
  for (const o of objects) {
    yield;
    if (!(o instanceof T.Mesh) || o === excluded || Array.isArray(o.material)) continue;
    const mat = o.material as T.MeshStandardMaterial;
    if (
      o.userData.preserveBatch ||
      o.userData.lightSource ||
      o.userData.hayStack ||
      mat.transparent ||
      mat.vertexColors ||
      !(mat instanceof T.MeshStandardMaterial)
    )
      continue;
    let parent: T.Object3D | null = o;
    while (parent) {
      if (
        parent.userData.blades ||
        parent.userData.creatorModel ||
        parent.userData.animatedFlight ||
        parent.userData.spaceportGate ||
        parent.userData.bayDoor ||
        parent.userData.interior
      )
        break;
      parent = parent.parent;
    }
    if (parent) continue;
    const key = [
      mat.color.getHexString(),
      mat.map?.uuid,
      mat.roughness,
      mat.metalness,
      mat.side,
      mat.emissive.getHexString(),
      mat.customProgramCacheKey(),
    ].join(':');
    let batch = batches.get(key);
    if (!batch) {
      const material = mat.clone();
      // Three.js cloning omits callbacks; keep the shader behavior of this batch.
      material.onBeforeCompile = mat.onBeforeCompile;
      material.customProgramCacheKey = mat.customProgramCacheKey;
      batch = { geometries: [], material };
    }
    batch.geometries.push(
      (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
        o.matrixWorld,
      ),
    );
    batches.set(key, batch);
    originals.push(o);
  }
  for (const o of originals) {
    o.removeFromParent();
    o.geometry.dispose();
    (o.material as T.Material).dispose();
  }
  for (const batch of batches.values()) {
    yield;
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

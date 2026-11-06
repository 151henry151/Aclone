// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { batch } from './tractor';
import type { InteriorRig } from './building-interiors';

/** Batch fixed fixtures within each visibility gate, never doors, stock or vehicles. */
export function batchInteriorProps(rig: InteriorRig) {
  if (rig.group.userData.furnitureBatched) return;
  rig.group.userData.furnitureBatched = true;
  rig.group.updateWorldMatrix(true, true);
  for (const parent of [rig.principal, rig.detail]) {
    const arms = parent.getObjectByName('lift-arms');
    if (arms instanceof T.Group) batch(arms);
    const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<string, { material: T.MeshStandardMaterial; meshes: T.Mesh[] }>();
    for (const fixture of parent.children) {
      if (!fixture.userData.fixedInteriorProp) continue;
      fixture.traverse((o) => {
        if (
          !(o instanceof T.Mesh) ||
          !(o.material instanceof T.MeshStandardMaterial) ||
          o.material.transparent
        )
          return;
        // Effects and lift supports retain their inspected geometry and transforms.
        for (let p: T.Object3D | null = o; p && p !== fixture; p = p.parent)
          if (['kettle-steam', 'hearth-coals', 'lift-arms'].includes(p.name)) return;
        const m = o.material;
        const key = JSON.stringify([
          m.color.getHex(),
          m.roughness,
          m.metalness,
          m.map?.uuid,
          m.emissiveMap?.uuid,
          m.emissive.getHex(),
          m.emissiveIntensity,
          m.opacity,
          m.side,
          m.depthWrite,
          Object.keys(o.geometry.attributes).sort(),
        ]);
        const entry = batches.get(key) ?? { material: m, meshes: [] };
        entry.meshes.push(o);
        batches.set(key, entry);
      });
    }
    for (const { material, meshes } of batches.values()) {
      const geometries = meshes.map((m) =>
        (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(
          inverse.clone().multiply(m.matrixWorld),
        ),
      );
      const geometry = mergeGeometries(geometries);
      if (!geometry) throw new Error('Interior fixture attributes cannot be merged');
      const merged = new T.Mesh(geometry, material);
      merged.name = 'Batched interior furnishings';
      merged.castShadow = merged.receiveShadow = true;
      for (const mesh of meshes) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      for (const g of geometries) g.dispose();
      parent.add(merged);
    }
  }
}

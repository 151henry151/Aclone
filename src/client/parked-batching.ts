// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Only plain standard materials can share values. Identify textures by instance,
 * exclude custom shader callbacks/subclasses, and retain full color precision. */
function materialKey(material: T.Material) {
  if (
    !(material instanceof T.MeshStandardMaterial) ||
    Object.getPrototypeOf(material) !== T.MeshStandardMaterial.prototype ||
    material.onBeforeCompile !== T.Material.prototype.onBeforeCompile ||
    material.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey ||
    Object.values(material).some((value) => typeof value === 'function')
  )
    return material.uuid;
  return JSON.stringify(
    Object.entries(material)
      .filter(([key]) => !['uuid', 'name', 'version', 'userData', '_listeners'].includes(key))
      .map(([key, value]) => [
        key,
        value instanceof T.Color
          ? value.toArray()
          : value instanceof T.Texture
            ? value.uuid
            : value,
      ]),
  );
}

/** A parked body is stationary relative to its root. Keep drivers, glass and any
 * custom drawing behavior independent, while sharing draws for compatible parts. */
export function batchParkedBody(root: T.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const batches = new Map<string, T.Mesh<T.BufferGeometry, T.Material>[]>();
  const keys = new Map<T.Material, string>();
  root.traverseVisible((o) => {
    for (let parent: T.Object3D | null = o; parent && parent !== root; parent = parent.parent)
      if (parent.userData.creatorModel) return;
    if (
      !(o instanceof T.Mesh) ||
      o instanceof T.InstancedMesh ||
      o instanceof T.SkinnedMesh ||
      o.children.length > 0 ||
      Array.isArray(o.material) ||
      o.material.transparent ||
      o.material instanceof T.ShaderMaterial ||
      o.material.onBeforeCompile !== T.Material.prototype.onBeforeCompile ||
      o.material.customProgramCacheKey !== T.Material.prototype.customProgramCacheKey ||
      o.customDepthMaterial ||
      o.customDistanceMaterial ||
      o.onBeforeRender !== T.Object3D.prototype.onBeforeRender ||
      o.onAfterRender !== T.Object3D.prototype.onAfterRender ||
      o.onBeforeShadow !== T.Object3D.prototype.onBeforeShadow ||
      o.onAfterShadow !== T.Object3D.prototype.onAfterShadow ||
      Object.keys(o.geometry.morphAttributes).length ||
      o.geometry.drawRange.start !== 0 ||
      o.geometry.drawRange.count !== Infinity ||
      o.matrixWorld.determinant() < 0
    )
      return;
    if (!keys.has(o.material)) keys.set(o.material, materialKey(o.material));
    const key = JSON.stringify([
      keys.get(o.material),
      o.castShadow,
      o.receiveShadow,
      o.renderOrder,
      o.layers.mask,
      o.frustumCulled,
      Object.entries(
        o.geometry.attributes as Record<string, T.BufferAttribute | T.InterleavedBufferAttribute>,
      )
        .map(([name, a]) => [name, a.itemSize, a.normalized, a.array.constructor.name])
        .sort(),
    ]);
    const list = batches.get(key) ?? [];
    list.push(o);
    batches.set(key, list);
  });
  const retired = new Set<T.BufferGeometry>();
  const retiredMaterials = new Set<T.Material>();
  for (const parts of batches.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map((o) =>
      (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
        inverse.clone().multiply(o.matrixWorld),
      ),
    );
    const geometry = mergeGeometries(geometries);
    for (const g of geometries) g.dispose();
    if (!geometry) continue;
    const first = parts[0],
      mesh = new T.Mesh(geometry, first.material);
    mesh.name = 'Batched parked body';
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.layers.mask = first.layers.mask;
    mesh.frustumCulled = first.frustumCulled;
    for (const part of parts) {
      retired.add(part.geometry);
      retiredMaterials.add(part.material);
      part.removeFromParent();
    }
    root.add(mesh);
  }
  // A driver, transparent pane or custom callback can still share a source
  // buffer. Likewise, shared library geometry belongs to other live vehicles.
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      retired.delete(o.geometry);
      for (const material of Array.isArray(o.material) ? o.material : [o.material])
        retiredMaterials.delete(material);
    }
  });
  for (const geometry of retired) if (!geometry.userData.shared) geometry.dispose();
  for (const material of retiredMaterials) if (!material.userData.shared) material.dispose();
}

// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { coastalBoulders } from '../shared/scenery-obstacles';
/** Small weathered outcrops break the grass/rock silhouette without unique meshes. */
export function coastalRocks(w: World) {
  const objects = coastalBoulders(w),
    count = objects.length;
  const mesh = new T.InstancedMesh(
    new T.DodecahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ color: '#929486', roughness: 1 }),
    count,
  );
  const transform = new T.Object3D();
  let i = 0;
  for (const o of objects) {
    const seed = (o.scaleX! - 1.5) / 2;
    transform.position.set(o.x, o.y, o.z);
    transform.scale.set(o.scaleX!, o.scaleY!, o.scaleZ!);
    transform.rotation.set(o.tiltX!, o.rotation, o.tiltZ!);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    mesh.setColorAt(
      i++,
      new T.Color().setRGB(0.65 + seed * 0.22, 0.68 + seed * 0.19, 0.69 + seed * 0.15),
    );
  }
  mesh.name = 'Weathered cliff rim outcrops';
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

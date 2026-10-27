// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { bluffEdge, bluffPoint } from '../shared/coastal-bluffs';
import { terrainHeight } from '../shared/terrain';
/** Small weathered outcrops break the grass/rock silhouette without unique meshes. */
export function coastalRocks(w: World) {
  const count = (w.coastalBluffs?.length ?? 0) * 9;
  const mesh = new T.InstancedMesh(
    new T.DodecahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ color: '#929486', roughness: 1 }),
    count,
  );
  const transform = new T.Object3D();
  let i = 0;
  for (const b of w.coastalBluffs ?? [])
    for (let j = 0; j < 9; j++) {
      const u = (j / 8 - 0.5) * b.width * 1.55,
        at = bluffPoint(b, u, bluffEdge(b, u) - 2.6);
      const seed = Math.abs(Math.sin(b.seed * 13 + j * 7.9));
      transform.position.set(at.x, terrainHeight(w, at.x, at.z) - 0.5, at.z);
      transform.scale.set(1.5 + seed * 2, 1 + seed * 2.4, 1.2 + seed);
      transform.rotation.set(seed * 0.5, b.angle + j, seed * 0.3);
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

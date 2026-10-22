// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
export const groundTileSize = 128;

/** Distant tiles use 16 m cells, but retain every 4 m edge sample so they
 * join detailed tiles without cracks. Interior cell fans stitch those edges. */
export function groundGeometry(w: World, cx: number, cz: number, detailed: boolean) {
  let geometry: T.BufferGeometry;
  if (detailed) {
    geometry = new T.PlaneGeometry(128, 128, 32, 32);
    geometry.rotateX(-Math.PI / 2);
  } else {
    const vertices: number[] = [],
      indices: number[] = [];
    for (let z = -64; z < 64; z += 16)
      for (let x = -64; x < 64; x += 16) {
        const start = vertices.length / 3;
        vertices.push(x + 8, 0, z + 8);
        const edges = [
          [x, z, x, z + 16, x === -64],
          [x, z + 16, x + 16, z + 16, z === 48],
          [x + 16, z + 16, x + 16, z, x === 48],
          [x + 16, z, x, z, z === -64],
        ];
        for (const [ax, az, bx, bz, boundary] of edges) {
          const n = boundary ? 4 : 1;
          for (let i = 0; i < n; i++)
            vertices.push(
              Number(ax) + ((Number(bx) - Number(ax)) * i) / n,
              0,
              Number(az) + ((Number(bz) - Number(az)) * i) / n,
            );
        }
        const count = vertices.length / 3 - start - 1;
        for (let i = 0; i < count; i++)
          indices.push(start, start + 1 + i, start + 1 + ((i + 1) % count));
      }
    geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(vertices.length, 3));
    geometry.setIndex(indices);
  }
  const p = geometry.attributes.position,
    normal = geometry.attributes.normal;
  const n = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = cx + p.getX(i),
      z = cz + p.getZ(i);
    p.setY(i, terrainHeight(w, x, z));
    n.set(
      -(terrainHeight(w, x + 0.75, z) - terrainHeight(w, x - 0.75, z)) / 1.5,
      1,
      -(terrainHeight(w, x, z + 0.75) - terrainHeight(w, x, z - 0.75)) / 1.5,
    ).normalize();
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  return geometry;
}

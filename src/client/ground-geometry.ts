import { nearInlandWater, riverSediment } from '../shared/inland-water';
import { nearBluff, coastalRockCover } from '../shared/coastal-bluffs';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
export const groundTileSize = 128;

/** Intermediate/distant tiles use 8/16 m cells, retaining every 4 m edge
 * sample (2 m at cliffs/rivers). Shared cell vertices avoid repeated terrain
 * and snow queries; boundary fans join detailed tiles without cracks. */
export function groundGeometry(
  w: World,
  cx: number,
  cz: number,
  detailed: boolean | 'medium',
  coarseFeatures = false,
) {
  const job = groundGeometrySteps(w, cx, cz, detailed, coarseFeatures);
  let step = job.next();
  while (!step.done) step = job.next();
  return step.value;
}
/** Keep terrain sampling out of one long render-blocking task. */
export function* groundGeometrySteps(
  w: World,
  cx: number,
  cz: number,
  detailed: boolean | 'medium',
  coarseFeatures = false,
): Generator<void, T.BufferGeometry> {
  let geometry: T.BufferGeometry;
  const cliff = nearBluff(w, cx, cz, 100);
  const river = nearInlandWater(w, cx, cz);
  if (detailed === true || (!coarseFeatures && (cliff || river))) {
    const segments = cliff || river ? 64 : 32;
    geometry = new T.PlaneGeometry(128, 128, segments, segments);
    geometry.rotateX(-Math.PI / 2);
  } else {
    const vertices: number[] = [],
      indices: number[] = [];
    const sampled = new Map<string, number>();
    const vertex = (x: number, z: number) => {
      const key = `${x}:${z}`;
      let index = sampled.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        sampled.set(key, index);
        vertices.push(x, 0, z);
      }
      return index;
    };
    const cell = detailed === 'medium' ? 8 : 16;
    for (let z = -64; z < 64; z += cell)
      for (let x = -64; x < 64; x += cell) {
        const centre = vertex(x + cell / 2, z + cell / 2);
        const edge: number[] = [];
        const edges = [
          [x, z, x, z + cell, x === -64],
          [x, z + cell, x + cell, z + cell, z === 64 - cell],
          [x + cell, z + cell, x + cell, z, x === 64 - cell],
          [x + cell, z, x, z, z === -64],
        ];
        for (const [ax, az, bx, bz, boundary] of edges) {
          const n = boundary ? cell / (cliff || river ? 2 : 4) : 1;
          for (let i = 0; i < n; i++)
            edge.push(
              vertex(
                Number(ax) + ((Number(bx) - Number(ax)) * i) / n,
                Number(az) + ((Number(bz) - Number(az)) * i) / n,
              ),
            );
        }
        for (let i = 0; i < edge.length; i++)
          indices.push(centre, edge[i], edge[(i + 1) % edge.length]);
      }
    geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute(vertices.length, 3));
    geometry.setIndex(indices);
  }
  let complete = false;
  try {
    const p = geometry.attributes.position,
      normal = geometry.attributes.normal;
    const n = new T.Vector3();
    const rock = new Float32Array(p.count);
    const sediment = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = cx + p.getX(i),
        z = cz + p.getZ(i);
      p.setY(i, terrainHeight(w, x, z));
      sediment[i] = river ? riverSediment(w, x, z) : 0;
      rock[i] = coastalRockCover(w.coastalBluffs, x, z);
      n.set(
        -(terrainHeight(w, x + 0.75, z) - terrainHeight(w, x - 0.75, z)) / 1.5,
        1,
        -(terrainHeight(w, x, z + 0.75) - terrainHeight(w, x, z - 0.75)) / 1.5,
      ).normalize();
      normal.setXYZ(i, n.x, n.y, n.z);
      if (i % 64 === 63) yield;
    }
    geometry.setAttribute('riverSediment', new T.BufferAttribute(sediment, 1));
    geometry.setAttribute('coastalRock', new T.BufferAttribute(rock, 1));
    complete = true;
    return geometry;
  } finally {
    if (!complete) geometry.dispose();
  }
}

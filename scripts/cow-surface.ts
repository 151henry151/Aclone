// SPDX-License-Identifier: GPL-3.0-or-later
// Original sculpt, authored as blended volumes and baked once. No runtime voxel work.
import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeFileSync } from 'node:fs';
const smooth = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
function oval(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
) {
  return (Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1) * Math.min(rx, ry, rz);
}
// Thick thighs continue into a pronounced rear hock; cannon bones alone are slender.
const profiles = {
  rear: [
    [0.09, 0.09, 0.105, -0.73],
    [0.19, 0.085, 0.105, -0.75],
    [0.4, 0.105, 0.13, -0.84],
    [0.55, 0.145, 0.16, -0.86],
    [0.76, 0.2, 0.26, -0.68],
    [1.06, 0.27, 0.36, -0.64],
    [1.36, 0.16, 0.22, -0.71],
    [1.52, 0.035, 0.07, -0.71],
  ],
  front: [
    [0.09, 0.085, 0.105, 0.72],
    [0.21, 0.085, 0.105, 0.7],
    [0.45, 0.11, 0.13, 0.68],
    [0.6, 0.145, 0.17, 0.67],
    [0.86, 0.23, 0.28, 0.61],
    [1.2, 0.25, 0.34, 0.6],
    [1.37, 0.13, 0.2, 0.54],
    [1.53, 0.035, 0.07, 0.54],
  ],
};
function limb(x: number, y: number, z: number, side: number, profile: number[][]) {
  let a = profile[0],
    b = profile[1];
  for (let i = 0; i < profile.length - 1; i++) {
    a = profile[i];
    b = profile[i + 1];
    if (y <= b[0]) break;
  }
  const t = T.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1),
    rx = T.MathUtils.lerp(a[1], b[1], t),
    rz = T.MathUtils.lerp(a[2], b[2], t),
    cz = T.MathUtils.lerp(a[3], b[3], t);
  const radial = (Math.hypot((x - side * 0.29) / rx, (z - cz) / rz) - 1) * Math.min(rx, rz);
  return Math.max(radial, profile[0][0] - y, y - profile.at(-1)![0]);
}
function field(x: number, y: number, z: number) {
  let d = oval(x, y, z, 0, 1.13, -0.04, 0.46, 0.48, 1.03);
  d = smooth(d, oval(x, y, z, 0, 1.23, -0.68, 0.4, 0.37, 0.41), 0.17); // pelvis
  d = smooth(d, oval(x, y, z, 0, 1.22, 0.56, 0.34, 0.4, 0.4), 0.19); // brisket/withers
  d = smooth(d, oval(x, y, z, 0, 1.27, 0.89, 0.25, 0.34, 0.39), 0.18); // neck
  for (const side of [-1, 1])
    for (const p of Object.values(profiles)) d = smooth(d, limb(x, y, z, side, p), 0.14);
  return d;
}
const resolution = 32,
  mc = new MarchingCubes(resolution, new T.MeshBasicMaterial(), false, false, 50000);
mc.isolation = 0;
for (let z = 0; z < resolution; z++)
  for (let y = 0; y < resolution; y++)
    for (let x = 0; x < resolution; x++)
      mc.field[x + y * resolution + z * resolution ** 2] = -field(
        (x / resolution) * 1.8 - 0.9,
        (y / resolution) * 2.1 - 0.2,
        (z / resolution) * 3 - 1.4,
      );
mc.update();
let g = new T.BufferGeometry();
g.setAttribute(
  'position',
  new T.Float32BufferAttribute(
    Array.from(mc.geometry.attributes.position.array).slice(0, mc.count * 3),
    3,
  ),
);
g.scale(0.9, 1.05, 1.5);
g.translate(0, 0.85, 0.1);
g = mergeVertices(g, 1e-5);
const result = g;
result.computeVertexNormals();
const rounded = (a: ArrayLike<number>) => Array.from(a, (n) => Math.round(n * 1e6) / 1e6);
writeFileSync(
  'src/client/cow-surface.json',
  JSON.stringify({
    position: rounded(result.attributes.position.array),
    index: Array.from(result.index!.array),
  }) + '\n',
);
console.log({ vertices: result.attributes.position.count, triangles: result.index!.count / 3 });

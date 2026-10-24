// SPDX-License-Identifier: GPL-3.0-or-later
// Offline original character sculpt. The browser loads only the baked surface.
import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { writeFileSync } from 'node:fs';
type Shape = (x: number, y: number, z: number) => number;
const shapes: Shape[] = [];
function ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number) {
  shapes.push((x, y, z) => {
    x -= cx;
    y -= cy;
    z -= cz;
    const k0 = Math.hypot(x / rx, y / ry, z / rz),
      k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  });
}
function limb(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  r1: number,
  r2: number,
  depth = 1,
) {
  shapes.push((x, y, z) => {
    const dx = bx - ax,
      dy = by - ay,
      dz = bz - az;
    const t = T.MathUtils.clamp(
      ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz),
      0,
      1,
    );
    return (
      Math.hypot(x - ax - dx * t, y - ay - dy * t, (z - az - dz * t) / depth) - (r1 + (r2 - r1) * t)
    );
  });
}
// A clothed adult in an A-pose. Overlapping fields are fused into a single surface;
// they are never rendered as overlapping primitives.
ellipsoid(0, 0.94, 0, 0.17, 0.14, 0.115); // pelvis
ellipsoid(0, 1.14, 0, 0.167, 0.23, 0.111); // waist
ellipsoid(0, 1.32, 0, 0.208, 0.16, 0.123); // chest and shoulder slope
limb(0, 1.39, 0, 0, 1.545, 0, 0.066, 0.055, 0.88); // neck
ellipsoid(0, 1.644, -0.007, 0.096, 0.142, 0.091); // cranium
ellipsoid(0, 1.575, 0.024, 0.076, 0.075, 0.074); // jaw and chin
ellipsoid(0, 1.637, 0.083, 0.016, 0.035, 0.019); // nose bridge
ellipsoid(0, 1.616, 0.101, 0.021, 0.014, 0.021); // nose tip
for (const s of [-1, 1]) {
  ellipsoid(s * 0.096, 1.641, -0.005, 0.017, 0.03, 0.02); // ears, continuous with skull
  ellipsoid(s * 0.047, 1.619, 0.061, 0.035, 0.036, 0.031); // cheek planes
  limb(s * 0.105, 0.91, 0, s * 0.105, 0.51, 0, 0.092, 0.064, 0.96);
  ellipsoid(s * 0.105, 0.37, -0.011, 0.066, 0.158, 0.064); // calf
  limb(s * 0.105, 0.51, 0, s * 0.105, 0.125, 0, 0.062, 0.047, 0.94);
  ellipsoid(s * 0.105, 0.113, 0.017, 0.06, 0.091, 0.08); // ankle/boot cuff
  ellipsoid(s * 0.105, 0.06, 0.079, 0.069, 0.056, 0.142); // boot instep/toe
  // The A-pose separates sleeves from the waist for clean underarm topology.
  const shoulder = s * 0.221,
    elbow = s * (0.221 + Math.sin(0.23) * 0.285),
    wrist = s * (0.221 + Math.sin(0.23) * 0.545);
  limb(s * 0.176, 1.382, 0, shoulder, 1.377, 0, 0.073, 0.072, 0.92);
  limb(shoulder, 1.389, 0, elbow, 1.389 - Math.cos(0.23) * 0.285, 0, 0.072, 0.052, 0.91);
  limb(
    elbow,
    1.389 - Math.cos(0.23) * 0.285,
    0,
    wrist,
    1.389 - Math.cos(0.23) * 0.545,
    0,
    0.052,
    0.033,
    0.91,
  );
  ellipsoid(wrist + s * 0.01, 0.805, 0.003, 0.034, 0.065, 0.024); // relaxed joined fingers, texture divisions
  limb(wrist - s * 0.026, 0.836, 0.008, wrist - s * 0.041, 0.797, 0.021, 0.016, 0.013); // thumb
}
const n = 88,
  size = 2.04,
  cy = 0.9;
const mc = new MarchingCubes(n, new T.MeshBasicMaterial(), false, false, 120000);
mc.isolation = 0;
for (let k = 0; k < n; k++)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = (i / n - 0.5) * size,
        y = (j / n - 0.5) * size + cy,
        z = (k / n - 0.5) * size;
      let d = 10;
      for (const shape of shapes) {
        const b = shape(x, y, z),
          radius = 0.022;
        const h = Math.max(radius - Math.abs(d - b), 0) / radius;
        d = Math.min(d, b) - h * h * radius * 0.25;
      }
      // Open the armpit below the shoulder: a narrow A-pose must not fuse the
      // inner sleeve down the ribcage, which stretches into a web on arm lift.
      const hollow = (Math.hypot((Math.abs(x) - 0.213) / 0.033, (y - 1.245) / 0.09) - 1) * 0.033;
      const round = Math.max(0.008 - Math.abs(d + hollow), 0) / 0.008;
      d = Math.max(d, -hollow) + round * round * 0.008 * 0.25;
      mc.field[i + j * n + k * n * n] = -d;
    }
mc.update();
let g = new T.BufferGeometry();
g.setAttribute(
  'position',
  new T.Float32BufferAttribute(mc.geometry.attributes.position.array.slice(0, mc.count * 3), 3),
);
g.scale(size / 2, size / 2, size / 2).translate(0, cy, 0);
g = mergeVertices(g, 1e-5);
console.log('Surface', g.attributes.position.count, 'vertices');

// Remove coincident iso-surface faces and verify that the sculpt stays connected.
const faces: number[][] = [],
  seen = new Set<string>();
const pos = g.attributes.position;
for (let i = 0; i < g.index!.count; i += 3) {
  const f = [g.index!.getX(i), g.index!.getX(i + 1), g.index!.getX(i + 2)];
  if (new Set(f).size < 3) continue;
  const a = new T.Vector3().fromBufferAttribute(pos, f[0]),
    b = new T.Vector3().fromBufferAttribute(pos, f[1]),
    c = new T.Vector3().fromBufferAttribute(pos, f[2]);
  if (b.sub(a).cross(c.sub(a)).lengthSq() === 0) continue;
  const key = [...f].sort((a, b) => a - b).join(',');
  if (seen.has(key)) continue;
  seen.add(key);
  faces.push(f);
}
const vertexFaces = new Map<number, number[]>();
faces.forEach((f, i) => f.forEach((v) => vertexFaces.set(v, [...(vertexFaces.get(v) ?? []), i])));
const visited = new Set<number>();
let largest: number[] = [];
for (let i = 0; i < faces.length; i++) {
  if (visited.has(i)) continue;
  const component = [i];
  visited.add(i);
  for (let j = 0; j < component.length; j++)
    for (const v of faces[component[j]])
      for (const next of vertexFaces.get(v)!)
        if (!visited.has(next)) {
          visited.add(next);
          component.push(next);
        }
  if (component.length > largest.length) largest = component;
}
if (largest.length !== faces.length) throw Error('Character sculpt has disconnected pieces');
g.setIndex(largest.flatMap((i) => faces[i]));
const edgeCounts = new Map<string, number>();
for (const f of faces)
  for (let i = 0; i < 3; i++) {
    const key = [f[i], f[(i + 1) % 3]].sort((a, b) => a - b).join(',');
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }
if ([...edgeCounts.values()].some((n) => n !== 2))
  throw Error('Character sculpt is not watertight');
writeFileSync(
  'src/client/generated/human-mesh.json',
  JSON.stringify({
    position: Array.from(g.attributes.position.array, (v) => Number(v.toFixed(7))),
    index: Array.from(g.index!.array),
  }) + '\n',
);
console.log('Baked', g.attributes.position.count, 'vertices', g.index!.count / 3, 'triangles');

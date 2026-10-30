// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import {
  SPACEPORT_PARKING,
  spaceportApproach,
  spaceportPoint,
  spaceportYardDistance,
} from '../shared/spaceport-site';
import { terrainHeight } from '../shared/terrain';
import type { World } from '../shared/types';

/** One clipped, terrain-following surface: no overlapping apron edges or flickering seams. */
export function spaceportPavingModel(w: World) {
  const s = w.spaceportSite!,
    root = new T.Group();
  root.name = 'Connected concrete yard and visitor parking';
  const positions: number[] = [],
    colors: number[] = [],
    concrete = new T.Color('#969a93'),
    gravel = new T.Color('#a49b82'),
    approach = spaceportApproach(s);
  type Vertex = { x: number; z: number; d: number };
  const vertex = (x: number, z: number): Vertex => ({ x, z, d: spaceportYardDistance(s, x, z) });
  function add(p: Vertex) {
    const q = spaceportPoint(s, p.x, p.z);
    positions.push(q.x, terrainHeight(w, q.x, q.z) + 0.09, q.z);
    let blend = 0;
    if (p.z > s.fence + 10) {
      let best = Infinity;
      for (const a of approach) {
        const d = Math.hypot(p.x - a.x, p.z - a.z);
        if (d < best) {
          best = d;
          blend = a.blend;
        }
      }
    }
    const color = concrete.clone().lerp(gravel, blend);
    colors.push(color.r, color.g, color.b);
  }
  function triangle(input: Vertex[]) {
    const poly: Vertex[] = [];
    for (let i = 0; i < 3; i++) {
      const a = input[i],
        b = input[(i + 1) % 3];
      if (a.d <= 0) poly.push(a);
      if (a.d < 0 !== b.d < 0) {
        const t = a.d / (a.d - b.d);
        poly.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, d: 0 });
      }
    }
    for (let i = 1; i < poly.length - 1; i++) {
      add(poly[0]);
      add(poly[i]);
      add(poly[i + 1]);
    }
  }
  // Four-metre grid in the industrial yard; two metres at the narrow entrance flare.
  for (let z = 36; z < s.fence + 84;) {
    const step = z >= s.fence - 16 ? 2 : 4;
    for (let x = -212; x < 212; x += step) {
      const a = vertex(x, z),
        b = vertex(x, z + step),
        c = vertex(x + step, z),
        d = vertex(x + step, z + step);
      if (Math.min(a.d, b.d, c.d, d.d) > 0) continue;
      triangle([a, b, c]);
      triangle([c, b, d]);
    }
    z += step;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const pavement = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  pavement.receiveShadow = true;
  root.add(pavement);

  // Ground paint is batched into two meshes, rather than a draw call per bay stripe.
  const paint = { white: [] as number[], yellow: [] as number[] };
  function stripe(
    x: number,
    z: number,
    tx: number,
    tz: number,
    width = 0.14,
    finish: keyof typeof paint = 'white',
  ) {
    const dx = tx - x,
      dz = tz - z,
      length = Math.hypot(dx, dz),
      n = Math.max(1, Math.ceil(length));
    const point = (t: number, side: number) => {
      const p = spaceportPoint(
        s,
        x + dx * t + (((side * dz) / length) * width) / 2,
        z + dz * t - (((side * dx) / length) * width) / 2,
      );
      return [p.x, terrainHeight(w, p.x, p.z) + 0.14, p.z];
    };
    for (let i = 0; i < n; i++) {
      const a = point(i / n, -1),
        b = point(i / n, 1),
        c = point((i + 1) / n, -1),
        d = point((i + 1) / n, 1);
      paint[finish].push(...a, ...b, ...c, ...c, ...b, ...d);
    }
  }
  const parking = SPACEPORT_PARKING,
    z = s.fence - parking.fromGate;
  // 18 tractor-sized 6 × 6 m bays: two banks with a 7 m manoeuvring aisle.
  const x0 = parking.x - 27;
  for (const side of [-1, 1]) {
    const inner = z + side * 3.5,
      outer = z + side * 9.5;
    stripe(x0, outer, x0 + 54, outer);
    for (let i = 0; i <= 9; i++) stripe(x0 + i * 6, inner, x0 + i * 6, outer);
    // Each parking bay is six metres wide for the tractors players actually drive.
  }
  // Pedestrian crossing from parking to the shop forecourt; do not block the gate lane.
  for (let i = 0; i < 7; i++) stripe(49 + i * 0.85, z - 2, 49 + i * 0.85, z + 2, 0.45);
  // Gate stop lines, approach centre dashes and generous service-lane guidance.
  stripe(-6.5, s.fence + 8, -0.5, s.fence + 8, 0.4);
  stripe(0.5, s.fence - 12, 6.5, s.fence - 12, 0.4);
  for (let z = 70; z < s.fence - 20; z += 14) stripe(0, z, 0, z + 5, 0.18, 'yellow');
  for (const [finish, values] of Object.entries(paint)) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(values, 3));
    g.computeVertexNormals();
    root.add(
      new T.Mesh(
        g,
        new T.MeshStandardMaterial({
          color: finish === 'white' ? '#ebe9d9' : '#d7ba63',
          roughness: 1,
          side: T.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      ),
    );
  }
  root.userData.parkingBays = parking.bays;
  return root;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight } from '../shared/terrain';
import { inlandWaterAt } from '../shared/inland-water';
import { smoothstep } from '../shared/noise';
import { waterSourceRules } from '../shared/water-source-rules';
import type { Spring } from '../shared/springs';
import type { World } from '../shared/types';
/** Natural hollow and ground-hugging downhill trickle, in world coordinates. */
export function springGeometry(w: World, s: Spring) {
  const r = waterSourceRules(w.settings),
    radius = r.springBasinDiameter / 2;
  const ground = (x: number, z: number) =>
    Math.max(terrainHeight(w, x, z), inlandWaterAt(w, x, z)?.level ?? -Infinity);
  const drape = (g: T.BufferGeometry, offset: number) => {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + s.x,
        z = p.getZ(i) + s.z;
      p.setXYZ(i, x, p.getY(i) + ground(x, z) + offset, z);
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  };
  // Concentric rings give the transparent damp edge room to feather into real turf.
  const damp = new T.RingGeometry(0, r.springDampDiameter / 2, 32, 6).rotateX(-Math.PI / 2),
    dp = damp.attributes.position,
    colors: number[] = [];
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i),
      z = dp.getZ(i),
      t = Math.hypot(x, z) / (r.springDampDiameter / 2),
      a = Math.atan2(x, z);
    const edge = 1 - 0.07 * Math.sin(a * 5) ** 2 - 0.05 * Math.cos(a * 9) ** 2;
    colors.push(1, 1, 1, 0.72 * (1 - smoothstep(0.45, edge, t)));
  }
  damp.setAttribute('color', new T.Float32BufferAttribute(colors, 4));
  drape(damp, 0.025);
  const moss = new T.RingGeometry(radius * 0.76, radius * 1.18, 32, 5).rotateX(-Math.PI / 2),
    mp = moss.attributes.position,
    mossColors: number[] = [];
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i),
      z = mp.getZ(i),
      a = Math.atan2(x, z),
      t = (Math.hypot(x, z) / radius - 0.76) / 0.42,
      variation = 0.8 + 0.2 * Math.sin(a * 7) ** 2;
    mossColors.push(
      variation,
      variation,
      variation,
      (1 - smoothstep(0.1, 1, t)) * (0.55 + 0.4 * Math.cos(a * 5) ** 2),
    );
  }
  moss.setAttribute('color', new T.Float32BufferAttribute(mossColors, 4));
  drape(moss, 0.055);
  const stones: T.BufferGeometry[] = [],
    reeds: T.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + 0.13 * Math.sin(i * 5),
      scale = 0.18 + 0.17 * Math.sin(i * 7) ** 2;
    const g = new T.IcosahedronGeometry(1, 1)
      .scale(scale * 0.9, scale * 0.55, scale)
      .rotateY(a)
      .translate(
        Math.sin(a) * radius * (0.9 + 0.16 * Math.sin(i * 3) ** 2),
        0.12,
        Math.cos(a) * radius * (0.9 + 0.16 * Math.sin(i * 3) ** 2),
      );
    stones.push(drape(g, 0.035));
  }
  for (let i = 0; i < 18; i++) {
    const a = i * 0.73,
      dist = radius * (1.05 + 0.3 * Math.sin(i * 3) ** 2),
      h = 0.4 + 0.4 * Math.sin(i * 5) ** 2;
    reeds.push(
      drape(
        new T.CylinderGeometry(0.015, 0.03, h, 4)
          .rotateZ(Math.sin(i) * 0.16)
          .translate(Math.sin(a) * dist, h / 2, Math.cos(a) * dist),
        0.04,
      ),
    );
  }
  const head = w.northernIsland?.rivers.find((v) => v.id === s.river)?.points[1];
  let angle = head ? Math.atan2(head.x - s.x, head.z - s.z) : 0;
  if (!head) {
    let low = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        h = ground(
          s.x + Math.sin(a) * r.springTrickleLength,
          s.z + Math.cos(a) * r.springTrickleLength,
        );
      if (h < low) {
        low = h;
        angle = a;
      }
    }
  }
  const positions: number[] = [],
    uv: number[] = [],
    depth: number[] = [],
    slope: number[] = [],
    indices: number[] = [];
  const ring = 32;
  // A slightly irregular shallow pool, with the same shader attributes as the river.
  positions.push(s.x, ground(s.x, s.z) + 0.07, s.z);
  uv.push(0.5, 0);
  depth.push(0.4);
  slope.push(0.02);
  for (let i = 0; i <= ring; i++) {
    const a = (i / ring) * Math.PI * 2,
      x = s.x + Math.sin(a) * radius * 0.8,
      z = s.z + Math.cos(a) * radius * 0.8;
    positions.push(x, ground(x, z) + 0.07, z);
    uv.push((Math.sin(a) + 1) / 2, Math.cos(a) * radius);
    depth.push(0.3);
    slope.push(0.02);
    if (i) indices.push(0, i, i + 1);
  }
  const first = positions.length / 3;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16,
      length = radius * 0.5 + t * r.springTrickleLength,
      width = 0.3 * (1 - t) + 0.015;
    for (const side of [-1, 1]) {
      const x = s.x + Math.sin(angle) * length + Math.cos(angle) * width * side,
        z = s.z + Math.cos(angle) * length - Math.sin(angle) * width * side;
      positions.push(x, ground(x, z) + 0.065, z);
      uv.push((side + 1) / 2, length);
      depth.push(0.12 * (1 - t));
      slope.push(0.06);
    }
    if (i) {
      const a = first + (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const water = new T.BufferGeometry();
  water.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  water.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  water.setAttribute('riverDepth', new T.Float32BufferAttribute(depth, 1));
  water.setAttribute('riverSlope', new T.Float32BufferAttribute(slope, 1));
  water.setIndex(indices);
  water.computeVertexNormals();
  water.computeBoundingSphere();
  const merge = (parts: T.BufferGeometry[]) => {
    const result = mergeGeometries(parts)!;
    parts.forEach((g) => g.dispose());
    return result;
  };
  return { damp, moss, stone: merge(stones), reeds: merge(reeds), water };
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { smoothstep, valueNoise } from './noise';
/** A grass-topped headland: local +Z faces the sea, -Z is the inland approach. */
export interface CoastalBluff {
  id: string;
  x: number;
  z: number;
  angle: number;
  width: number;
  inland: number;
  height: number;
  seed: number;
}
const rotations = new WeakMap<CoastalBluff, { angle: number; s: number; c: number }>();
function rotation(b: CoastalBluff) {
  let r = rotations.get(b);
  if (!r || r.angle !== b.angle) {
    r = { angle: b.angle, s: Math.sin(b.angle), c: Math.cos(b.angle) };
    rotations.set(b, r);
  }
  return r;
}
const spatial = new WeakMap<
  CoastalBluff[],
  { count: number; cells: Map<string, CoastalBluff[]> }
>();
/** Most terrain samples are nowhere near a headland. Index the immutable saved
 * array once, including migration append operations, instead of testing 15 shapes per sample. */
function candidates(bluffs: CoastalBluff[] | undefined, x: number, z: number) {
  if (!bluffs?.length) return [];
  let cached = spatial.get(bluffs);
  if (!cached || cached.count !== bluffs.length) {
    const cells = new Map<string, CoastalBluff[]>();
    for (const b of bluffs) {
      const corners = [
        bluffPoint(b, -b.width, -b.inland),
        bluffPoint(b, b.width, -b.inland),
        bluffPoint(b, -b.width, 55),
        bluffPoint(b, b.width, 55),
      ];
      for (
        let ix = Math.floor(Math.min(...corners.map((p) => p.x)) / 256);
        ix <= Math.floor(Math.max(...corners.map((p) => p.x)) / 256);
        ix++
      )
        for (
          let iz = Math.floor(Math.min(...corners.map((p) => p.z)) / 256);
          iz <= Math.floor(Math.max(...corners.map((p) => p.z)) / 256);
          iz++
        ) {
          const key = ix + ':' + iz;
          const list = cells.get(key) ?? [];
          list.push(b);
          cells.set(key, list);
        }
    }
    cached = { count: bluffs.length, cells };
    spatial.set(bluffs, cached);
  }
  return cached.cells.get(Math.floor(x / 256) + ':' + Math.floor(z / 256)) ?? [];
}
export function bluffLocal(b: CoastalBluff, x: number, z: number) {
  const dx = x - b.x,
    dz = z - b.z,
    s = rotation(b).s,
    c = rotation(b).c;
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}
export function bluffPoint(b: CoastalBluff, u: number, v: number) {
  const s = rotation(b).s,
    c = rotation(b).c;
  return { x: b.x + u * c + v * s, z: b.z - u * s + v * c };
}
/** Broad scallops and small joints, not a straight wall or a circular cone. */
export function bluffEdge(b: CoastalBluff, u: number) {
  return (
    8 * Math.cos(u * 0.033 + b.seed) +
    3 * Math.sin(u * 0.091 + b.seed * 2) -
    18 * (u / b.width) ** 2
  );
}
const outcropCache = new WeakMap<
  CoastalBluff,
  { u: number; v: number; rx: number; rz: number; height: number }[]
>();
/** Irregular submerged toes and detached sea rocks; terrain and boats share these shapes. */
export function bluffOutcrops(b: CoastalBluff) {
  let rocks = outcropCache.get(b);
  if (rocks) return rocks;
  rocks = Array.from({ length: 11 }, (_, i) => {
    const n = (Math.sin(b.seed * 17.1 + i * 8.71) + 1) / 2;
    const u = ((i / 10) * 2 - 1) * b.width * 0.77 + Math.sin(i * 3.1 + b.seed) * 6;
    return {
      u,
      v: i % 3 === 0 ? 25 + n * 13 : bluffEdge(b, u) + 5 + n * 8,
      rx: 6 + n * 7,
      rz: 5 + n * 5,
      height: 2 + n * 8,
    };
  });
  outcropCache.set(b, rocks);
  return rocks;
}
function outcropRadius(
  rock: { u: number; v: number; rx: number; rz: number },
  u: number,
  v: number,
) {
  return ((u - rock.u) / rock.rx) ** 2 + ((v - rock.v) / rock.rz) ** 2;
}
/** Marks exposed sea rock, including flatter crowns that would otherwise grow grass. */
export function coastalRockCover(bluffs: CoastalBluff[] | undefined, x: number, z: number) {
  for (const b of candidates(bluffs, x, z)) {
    const { u, v } = bluffLocal(b, x, z);
    for (const rock of bluffOutcrops(b)) if (outcropRadius(rock, u, v) < 1.05) return 1;
  }
  return 0;
}
export function bluffHeight(
  bluffs: CoastalBluff[] | undefined,
  x: number,
  z: number,
  base: number,
  sea: number,
) {
  let h = base;
  for (const b of candidates(bluffs, x, z)) {
    const { u, v } = bluffLocal(b, x, z);
    if (Math.abs(u) > b.width || v < -b.inland || v > 55) continue;
    const edge = bluffEdge(b, u);
    // Taper the inland shoulders instead of raising a rectangular, level platform.
    // The broad rise continues all the way to the lip; seeded folds break up its silhouette.
    const shoulder = b.width * (0.65 + 0.35 * smoothstep(-b.inland, 0, v));
    const side = 1 - smoothstep(shoulder * 0.52, shoulder, Math.abs(u));
    const rise = (u: number, v: number) =>
      smoothstep(-b.inland + 18 * (1 + Math.sin(u * 0.018 + b.seed)), bluffEdge(b, u), v);
    const folds = (u: number, v: number) =>
      6 * valueNoise(u / 80, v / 95, b.seed) + 2.5 * valueNoise(u / 32 + 7, v / 43, b.seed + 23);
    // Only the existing public tower's small footprint is level, not the headland.
    const natural = b.id.startsWith('natural-');
    const terrainBlend = natural ? 1 : smoothstep(13, 32, Math.hypot(u, v + 42));
    const approach = rise(0, -42) * (1 - terrainBlend) + rise(u, v) * terrainBlend;
    const rolling = folds(0, -42) * (1 - terrainBlend) + folds(u, v) * terrainBlend;
    // Two metres horizontally for a 25–45m drop. Extend the submerged foot
    // beyond the wall so high/low tide both touch rock, never a sandy apron.
    const drop = smoothstep(edge - 1, edge + 1, v);
    const top = sea + b.height + rolling;
    const target = top * (1 - drop) + (sea - 7) * drop;
    const influence = side * approach * (1 - smoothstep(25, 55, v));
    h = h * (1 - influence) + target * influence;
    for (const rock of bluffOutcrops(b)) {
      const r = outcropRadius(rock, u, v);
      if (r < 1) {
        // A weathered cap with a submerged root; no invisible decorative hull.
        const crag = 0.94 + 0.06 * Math.sin(u * 0.7 + v * 0.4 + b.seed);
        h = Math.max(h, sea - 7 + (rock.height + 7) * Math.sqrt(1 - r) * crag);
      }
    }
  }
  return h;
}
export function nearBluff(w: World, x: number, z: number, margin = 0) {
  return (
    w.coastalBluffs?.some((b) => {
      const { u, v } = bluffLocal(b, x, z);
      return Math.abs(u) < b.width + margin && v > -b.inland - margin && v < 55 + margin;
    }) ?? false
  );
}
/** Solid safety boundary slightly inland of the lip; swept checks prevent tunnelling. */
export function cliffBlocks(
  w: World,
  from: { x: number; z: number },
  to: { x: number; z: number },
  radius = 1.3,
) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.75));
  for (const b of w.coastalBluffs ?? []) {
    const start = bluffLocal(b, from.x, from.z);
    if (Math.abs(start.u) > b.width + Math.hypot(to.x - from.x, to.z - from.z) + radius) continue;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps,
        { u, v } = bluffLocal(b, from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
      if (Math.abs(u) < b.width * 0.86 + radius && Math.abs(v - bluffEdge(b, u)) < radius + 3)
        return true;
    }
  }
  return false;
}

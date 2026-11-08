// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { NorthernIsland, RiverPoint, IslandPond } from './northern-island';
import { smoothstep } from './noise';
type Segment = {
  a: RiverPoint;
  b: RiverPoint;
  river: string;
  curve: ReturnType<typeof curveCoefficients>;
  bendA: number;
  bendB: number;
};
type Feature = Segment | IslandPond;
const cache = new WeakMap<
  NorthernIsland,
  { rivers: NorthernIsland['rivers']; ponds: number; cells: Map<string, Feature[]> }
>();
/** Discard cached spatial bounds/curves before surveying edited water geometry. */
export function invalidateInlandWater(w: World) {
  if (w.northernIsland) cache.delete(w.northernIsland);
}
const cell = 256;
function candidates(w: World, x: number, z: number) {
  const n = w.northernIsland;
  if (!n || z >= n.preserveZ) return [];
  const cached = cache.get(n);
  let cells = cached?.cells;
  if (!cells || cached?.rivers !== n.rivers || cached.ponds !== n.ponds.length) {
    cells = new Map();
    const add = (f: Feature, minX: number, maxX: number, minZ: number, maxZ: number) => {
      for (let iz = Math.floor(minZ / cell); iz <= Math.floor(maxZ / cell); iz++)
        for (let ix = Math.floor(minX / cell); ix <= Math.floor(maxX / cell); ix++) {
          const key = ix + ':' + iz,
            list = cells!.get(key) ?? [];
          list.push(f);
          cells!.set(key, list);
        }
    };
    for (const r of n.rivers)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i],
          margin = Math.max(a.width, b.width) * 0.5 + 320;
        add(
          {
            a,
            b,
            curve: curveCoefficients(
              r.points[Math.max(0, i - 2)],
              a,
              b,
              r.points[Math.min(r.points.length - 1, i + 1)],
            ),
            river: r.id,
            bendA: riverBend(r.points, i - 1),
            bendB: riverBend(r.points, i),
          },
          Math.min(a.x, b.x) - margin,
          Math.max(a.x, b.x) + margin,
          Math.min(a.z, b.z) - margin,
          Math.max(a.z, b.z) + margin,
        );
      }
    for (const p of n.ponds)
      add(p, p.x - p.rx * 1.4, p.x + p.rx * 1.4, p.z - p.rz * 1.4, p.z + p.rz * 1.4);
    cache.set(n, { rivers: n.rivers, ponds: n.ponds.length, cells });
  }
  return cells.get(Math.floor(x / cell) + ':' + Math.floor(z / cell)) ?? [];
}
function project(s: Segment, x: number, z: number) {
  const dx = s.b.x - s.a.x,
    dz = s.b.z - s.a.z;
  let t = Math.max(
    0,
    Math.min(1, ((x - s.a.x) * dx + (z - s.a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  const lineX = s.a.x + dx * t,
    lineZ = s.a.z + dz * t;
  let cx = lineX,
    cz = lineZ,
    tx = dx,
    tz = dz;
  if (Math.hypot(x - lineX, z - lineZ) < Math.max(s.a.width, s.b.width) + 25) {
    const originalT = t;
    const weight =
      1 -
      smoothstep(
        Math.max(s.a.width, s.b.width) + 10,
        Math.max(s.a.width, s.b.width) + 25,
        Math.hypot(x - lineX, z - lineZ),
      );
    for (let iteration = 0; iteration < 3; iteration++) {
      const q = curveSample(s.curve, t);
      t = Math.max(
        0,
        Math.min(1, t + ((x - q.x) * q.dx + (z - q.z) * q.dz) / (q.dx * q.dx + q.dz * q.dz || 1)),
      );
    }
    const q = curveSample(s.curve, t);
    cx = lineX + (q.x - lineX) * weight;
    cz = lineZ + (q.z - lineZ) * weight;
    tx = dx + (q.dx - dx) * weight;
    tz = dz + (q.dz - dz) * weight;
    t = originalT + (t - originalT) * weight;
  }
  const mix = (a: number, b: number) => a + (b - a) * t;
  return {
    side: ((x - cx) * -tz + (z - cz) * tx) / (Math.hypot(tx, tz) || 1),
    bend: mix(s.bendA, s.bendB),
    slope: (s.a.level - s.b.level) / (Math.hypot(dx, dz) || 1),
    distance: Math.hypot(x - cx, z - cz),
    level: mix(s.a.level, s.b.level),
    width: mix(s.a.width, s.b.width),
    depth: mix(s.a.depth, s.b.depth),
    dx: tx,
    dz: tz,
  };
}
export function inlandWaterAt(w: World, x: number, z: number) {
  let best:
    | { level: number; depth: number; flow: number; bankDistance: number; river?: string }
    | undefined;
  let closest = Infinity;
  for (const f of candidates(w, x, z)) {
    if ('a' in f) {
      const p = project(f, x, z),
        r = p.distance / (p.width / 2);
      if (r <= 1 && r < closest) {
        closest = r;
        best = {
          bankDistance: Math.max(0, p.width / 2 - p.distance),
          level: p.level,
          depth: channelDepth(p),
          flow: Math.atan2(p.dx, p.dz),
          river: f.river,
        };
      }
    } else {
      const r = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz);
      if (r <= 1)
        best = {
          level: f.level,
          depth: f.depth * (1 - r * r),
          flow: 0,
          bankDistance: (1 - r) * Math.min(f.rx, f.rz),
        };
    }
  }
  return best;
}
/** Bank-to-bank depth, plus broad valley shoulders; no vertical rectangular cuts. */
export function inlandGround(w: World, x: number, z: number, base: number) {
  const features = candidates(w, x, z);
  if (!features.length) return base;
  let h = base;
  // Only the closest segment of each river shapes its valley; adjacent segments
  // must not accumulate erosion at their shared endpoint.
  const rivers = new Map<string, ReturnType<typeof project>>();
  for (const f of features) {
    if ('a' in f) {
      const p = project(f, x, z),
        prior = rivers.get(f.river);
      if (!prior || p.distance < prior.distance) rivers.set(f.river, p);
    } else {
      const r = Math.hypot((x - f.x) / f.rx, (z - f.z) / f.rz);
      if (r < 1) h = f.level - f.depth * (1 - r * r);
      else if (r < 1.4) h = f.level + (base - f.level) * smoothstep(1, 1.4, r);
    }
  }
  for (const p of rivers.values()) {
    const half = p.width / 2;
    if (p.distance >= half + 320) continue;
    if (p.distance <= half) {
      const bed = p.level - channelDepth(p);
      h = p.level > w.settings.seaLevel + 0.01 ? bed : Math.min(h, bed);
    } else {
      const edge = p.distance - half;
      const bar = pointBar(p);
      const bankRise = (0.55 + 0.35 * (1 - bar)) * smoothstep(0, 2 + bar * p.width * 0.55, edge);
      const blend = smoothstep(half, half + 320, p.distance);
      const bank = p.level + bankRise * (1 - blend) + (base - p.level) * blend;
      // A hard switch from filled bank to original terrain at a fixed offset
      // leaves a parallel crease on downhill banks. Blend both cuts and fills
      // continuously across the complete shoulder instead.
      h = p.level > w.settings.seaLevel + 0.01 ? bank : Math.min(h, bank);
    }
  }
  return h;
}
/** Local water datum: upland rivers are not connected to the ocean tide. */
export function inlandLevel(w: World, x: number, z: number, ocean: number) {
  const level = inlandWaterAt(w, x, z)?.level;
  return level === undefined ? ocean : tidalRiverLevel(level, w.settings.seaLevel, ocean);
}
/** Tide enters low estuaries and fades out over the lowest three metres. */
export function tidalRiverLevel(level: number, sea: number, ocean: number) {
  return Math.max(ocean, level + (ocean - sea) * (1 - smoothstep(sea, sea + 3, level)));
}

export function nearInlandWater(w: World, x: number, z: number, margin = 100) {
  return candidates(w, x, z).some((f) => {
    if ('a' in f) {
      const p = project(f, x, z);
      return p.distance <= p.width / 2 + margin;
    }
    return Math.hypot((x - f.x) / (f.rx + margin), (z - f.z) / (f.rz + margin)) <= 1;
  });
}
/** Shared bank lines keep the map and the rendered surface on the same channel. */
export function riverBanks(points: RiverPoint[]) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const dx = ((-(b.z - a.z) / d) * p.width) / 2,
      dz = (((b.x - a.x) / d) * p.width) / 2;
    return {
      left: { x: p.x + dx, z: p.z + dz },
      right: { x: p.x - dx, z: p.z - dz },
      level: p.level,
    };
  });
}

/** Signed bend: positive turns into the left bank. Inner bends deposit material;
 * the outside of the bend keeps a deeper, narrower channel and steeper bank. */
export function riverBend(points: RiverPoint[], i: number) {
  const a = points[Math.max(0, i - 2)],
    p = points[i],
    b = points[Math.min(points.length - 1, i + 2)];
  const ax = p.x - a.x,
    az = p.z - a.z,
    bx = b.x - p.x,
    bz = b.z - p.z;
  const length = Math.hypot(ax, az) * Math.hypot(bx, bz);
  return Math.max(-1, Math.min(1, ((ax * bz - az * bx) / (length || 1)) * 5));
}
function pointBar(p: ReturnType<typeof project>) {
  return Math.max(0, Math.sign(p.side) * p.bend) * (1 - smoothstep(0.025, 0.1, p.slope));
}
function channelDepth(p: ReturnType<typeof project>) {
  const r = Math.min(1, p.distance / (p.width / 2));
  return p.depth * (1 - r * r) * (1 - 0.65 * Math.sign(p.side) * p.bend * r);
}
/** Terrain material mask, not another ribbon laid over the bank. */
export function riverSediment(w: World, x: number, z: number) {
  let best: ReturnType<typeof project> | undefined;
  for (const f of candidates(w, x, z))
    if ('a' in f) {
      const p = project(f, x, z);
      if (!best || p.distance < best.distance) best = p;
    }
  if (!best) return 0;
  const edge = best.distance - best.width / 2;
  const bar = pointBar(best);
  const extent = 1.5 + bar * best.width * 0.65;
  return 1 - smoothstep(-1, extent, edge);
}

function curveCoefficients(p0: RiverPoint, p1: RiverPoint, p2: RiverPoint, p3: RiverPoint) {
  const axis = (k: 'x' | 'z') => [
    p1[k],
    (-p0[k] + p2[k]) * 0.5,
    (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * 0.5,
    (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * 0.5,
  ];
  return { x: axis('x'), z: axis('z') };
}
function curveSample(c: ReturnType<typeof curveCoefficients>, t: number) {
  return {
    x: c.x[0] + t * (c.x[1] + t * (c.x[2] + t * c.x[3])),
    z: c.z[0] + t * (c.z[1] + t * (c.z[2] + t * c.z[3])),
    dx: c.x[1] + t * (2 * c.x[2] + 3 * t * c.x[3]),
    dz: c.z[1] + t * (2 * c.z[2] + 3 * t * c.z[3]),
  };
}
/** Smooth visual bank lines use exactly the same curve as bed/collision queries.
 * Only rendered samples expand; saved world surveys stay compact. */
export function riverSurfacePoints(points: RiverPoint[]) {
  const result: RiverPoint[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      before = points[Math.max(0, i - 1)],
      after = points[Math.min(points.length - 1, i + 2)];
    const curve = curveCoefficients(before, a, b, after);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        q = curveSample(curve, t);
      result.push({
        x: q.x,
        z: q.z,
        level: a.level + (b.level - a.level) * t,
        width: a.width + (b.width - a.width) * t,
        depth: a.depth + (b.depth - a.depth) * t,
      });
    }
  }
  result.push(points.at(-1)!);
  return result;
}

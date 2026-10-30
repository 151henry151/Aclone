// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
export interface SpaceportSite {
  layout?: number;
  /** Pad centre, not the terminal doorway. */
  x: number;
  z: number;
  height: number;
  entryHeight?: number;
  building: string;
  exclusion: number;
  fence: number;
  access?: { x: number; z: number }[];
}
export function spaceportReserved(
  w: Pick<World, 'spaceportSite'>,
  x: number,
  z: number,
  padding = 0,
) {
  const s = w.spaceportSite;
  return !!s && Math.hypot(x - s.x, z - s.z) < s.exclusion + padding;
}
/** Only the working apron is graded; broad smooth shoulders retain the surrounding hills. */
export function spaceportGround(s: SpaceportSite | undefined, x: number, z: number, h: number) {
  if (!s) return h;
  const t = Math.max(0, Math.min(1, (Math.hypot(x - s.x, z - s.z) - 180) / 160));
  const blend = t * t * (3 - 2 * t);
  let ground = s.height * (1 - blend) + h * blend;
  if ((s.layout ?? 0) < 3 || Math.abs(x - s.x) > s.fence + 100 || Math.abs(z - s.z) > s.fence + 100)
    return ground;
  const lx = (x - s.x - (z - s.z)) / Math.SQRT2,
    lz = (x - s.x + (z - s.z)) / Math.SQRT2;
  if (Math.abs(lx) > 260 || lz < -10 || lz > s.fence + 65) return ground;
  const smooth = (v: number) => {
    const t = Math.max(0, Math.min(1, v));
    return t * t * (3 - 2 * t);
  };
  const grade = (z: number) =>
    s.height + ((s.entryHeight ?? s.height) - s.height) * smooth((z - 190) / (s.fence - 190));
  // A graded service yard rises gently from the pad to the gate, with earth shoulders.
  const outside = Math.max(Math.abs(lx) - 210, 45 - lz, lz - (s.fence + 18));
  const weight = 1 - smooth(outside / 45);
  ground = ground * (1 - weight) + grade(lz) * weight;
  for (const p of gradePads(s)) {
    const d = Math.max(Math.abs(lx - p.x) - p.width / 2 - 4, Math.abs(lz - p.z) - p.depth / 2 - 4);
    if (d <= 0) return grade(p.z);
    const a = 1 - smooth(d / 26);
    if (a > 0) ground = ground * (1 - a) + grade(p.z) * a;
  }
  return ground;
}
const cache = new WeakMap<SpaceportSite, ReturnType<typeof makeFence>>();
function makeFence(s: SpaceportSite) {
  const edges = [];
  // 16-metre gate on the town-facing southeast side. Coarse collision segments,
  // with denser terrain-following visual panels generated on the client.
  const gate = Math.PI / 4,
    halfGap = 8 / s.fence,
    n = 192;
  for (let i = 0; i < n; i++) {
    const a = gate + halfGap + ((Math.PI * 2 - 2 * halfGap) * i) / n;
    const b = gate + halfGap + ((Math.PI * 2 - 2 * halfGap) * (i + 1)) / n;
    edges.push({
      id: 'spaceport-security',
      kind: 'fence' as const,
      height: SPACEPORT_FENCE_HEIGHT,
      width: 0.12,
      a: { x: s.x + Math.cos(a) * s.fence, z: s.z + Math.sin(a) * s.fence },
      b: { x: s.x + Math.cos(b) * s.fence, z: s.z + Math.sin(b) * s.fence },
    });
  }
  return edges;
}
export function spaceportFences(
  w: Pick<World, 'spaceportSite'>,
  from?: { x: number; z: number },
  to = from,
  padding = 0,
) {
  const s = w.spaceportSite;
  if (!s) return [];
  if (from && to) {
    const d = Math.hypot(from.x - s.x, from.z - s.z),
      reach = Math.hypot(to.x - from.x, to.z - from.z) + padding + 1;
    if (d + reach < s.fence || d - reach > s.fence) return [];
  }
  let edges = cache.get(s);
  if (!edges) {
    edges = makeFence(s);
    cache.set(s, edges);
  }
  return edges;
}

/** Site coordinates: X across the entrance, Z outward towards town. */
export function spaceportPoint(s: SpaceportSite, x: number, z: number) {
  return { x: s.x + (x + z) / Math.SQRT2, z: s.z + (z - x) / Math.SQRT2 };
}
/** Set the terminal back far enough that its complete side wing clears the circular fence. */
export function spaceportTerminal(s: SpaceportSite) {
  return { x: 30, z: s.fence - ((s.layout ?? 0) >= 4 ? 50 : 35) };
}
export const SPACEPORT_FENCE_HEIGHT = 8.4;
export function spaceportStructures(s: SpaceportSite) {
  if ((s.layout ?? 0) < 3) return [];
  return [
    {
      id: 'integration',
      name: '01 · Horizontal integration',
      x: -120,
      z: 170,
      width: 72,
      depth: 230,
      height: 60,
    },
    {
      id: 'operations',
      name: '02 · Flight operations',
      x: 115,
      z: 270,
      width: 56,
      depth: 54,
      height: 13,
    },
    {
      id: 'workshops',
      name: '03 · Vehicle maintenance',
      x: -110,
      z: 395,
      width: 58,
      depth: 36,
      height: 12,
    },
    {
      id: 'logistics',
      name: '04 · Payload logistics',
      x: 115,
      z: 435,
      width: 64,
      depth: 64,
      height: 19,
    },
    { id: 'gatehouse', name: 'Security', x: -18, z: s.fence - 7, width: 7, depth: 10, height: 3.5 },
  ];
}
/** Decorative freight remains outside doors, traffic lanes and visitor parking. */
export function spaceportYardProps(s: SpaceportSite) {
  if ((s.layout ?? 0) < 3) return [];
  return [
    {
      id: 'container-east-a',
      kind: 'containers',
      x: 172,
      z: 439,
      width: 9.6,
      depth: 12.2,
      height: 5.2,
    },
    {
      id: 'container-east-b',
      kind: 'containers',
      x: 188,
      z: 463,
      width: 9.6,
      depth: 12.2,
      height: 5.2,
    },
    {
      id: 'container-west',
      kind: 'containers',
      x: -175,
      z: 451,
      width: 9.6,
      depth: 6.1,
      height: 5.2,
    },
    {
      id: 'container-integration',
      kind: 'containers',
      x: -184,
      z: 225,
      width: 9.6,
      depth: 12.2,
      height: 5.2,
    },
    { id: 'freight-pallets', kind: 'crates', x: 110, z: 479, width: 12, depth: 5, height: 2.8 },
    { id: 'workshop-spares', kind: 'crates', x: -140, z: 430, width: 12, depth: 5, height: 2.8 },
    { id: 'ground-power', kind: 'generator', x: -150, z: 350, width: 5, depth: 7, height: 3.5 },
    { id: 'cable-drums', kind: 'cables', x: -130, z: 345, width: 9, depth: 5, height: 3 },
    { id: 'service-tanks', kind: 'tanks', x: 177, z: 222, width: 14, depth: 8, height: 7 },
    { id: 'freight-forklift', kind: 'forklift', x: 158, z: 470, width: 3, depth: 6.8, height: 4.5 },
  ];
}
const structureCache = new WeakMap<SpaceportSite, ReturnType<typeof makeStructureFences>>();
function makeStructureFences(s: SpaceportSite) {
  return [
    ...spaceportStructures(s),
    ...spaceportYardProps(s),
    ...((s.layout ?? 0) >= 3
      ? [
          { id: 'transporter', x: -65, z: 245, width: 10, depth: 217, height: 7 },
          { id: 'payload-truck', x: 68, z: 410, width: 4, depth: 29, height: 5 },
          { id: 'service-truck', x: 160, z: 390, width: 4, depth: 32, height: 5 },
          { id: 'crane', x: -185, z: 335, width: 12, depth: 20, height: 7 },
          { id: 'dish-a', x: 160, z: 305, width: 2, depth: 2, height: 6 },
          { id: 'dish-b', x: 185, z: 325, width: 2, depth: 2, height: 6 },
          { id: 'dish-c', x: 160, z: 355, width: 2, depth: 2, height: 6 },
        ]
      : []),
  ].flatMap((b) => {
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => spaceportPoint(s, b.x + (x * b.width) / 2, b.z + (z * b.depth) / 2));
    return corners.map((a, i) => ({
      id: 'spaceport-' + b.id,
      kind: 'fence' as const,
      height: b.height,
      width: 0.4,
      a,
      b: corners[(i + 1) % 4],
    }));
  });
}
export function spaceportStructureFences(
  w: Pick<World, 'spaceportSite'>,
  from?: { x: number; z: number },
  to = from,
  padding = 0,
) {
  const s = w.spaceportSite;
  if (!s) return [];
  if (
    from &&
    to &&
    Math.hypot(from.x - s.x, from.z - s.z) >
      s.fence + 100 + padding + Math.hypot(to.x - from.x, to.z - from.z)
  )
    return [];
  let result = structureCache.get(s);
  if (!result) {
    result = makeStructureFences(s);
    structureCache.set(s, result);
  }
  return result;
}
/** Automatic barriers fail open for approaching traffic; keep them raised while occupied. */
export function spaceportGateRequested(
  s: SpaceportSite,
  positions: readonly { x: number; z: number }[],
) {
  const gate = spaceportPoint(s, 0, s.fence);
  return positions.some((p) => Math.hypot(p.x - gate.x, p.z - gate.z) < 55);
}

const gradeCache = new WeakMap<
  SpaceportSite,
  { x: number; z: number; width: number; depth: number }[]
>();
function gradePads(s: SpaceportSite) {
  let pads = gradeCache.get(s);
  if (!pads) {
    pads = [
      ...spaceportStructures(s),
      { x: -65, z: 245, width: 17, depth: 225 },
      { x: -185, z: 335, width: 25, depth: 35 },
      { ...spaceportTerminal(s), width: 40, depth: 42 },
      { x: 23, z: s.fence + 12, width: 12, depth: 4 },
    ];
    gradeCache.set(s, pads);
  }
  return pads;
}

/** Connected work yard, terminal forecourt and gate throat, in site coordinates. */
const pavingCache = new WeakMap<
  SpaceportSite,
  { x: number; z: number; width: number; depth: number; radius: number }[]
>();
export function spaceportPaving(s: SpaceportSite) {
  const cached = pavingCache.get(s);
  if (cached) return cached;
  const result = [
    { x: 0, z: 265, width: 410, depth: 450, radius: 12 },
    { x: 45, z: s.fence - 70, width: 160, depth: 120, radius: 12 },
    { x: 0, z: s.fence - 7, width: 52, depth: 34, radius: 8 },
  ];
  pavingCache.set(s, result);
  return result;
}
export const SPACEPORT_PARKING = { x: 84, width: 56, depth: 24, fromGate: 66, bays: 18 };

const approachCache = new WeakMap<
  SpaceportSite,
  { x: number; z: number; width: number; blend: number }[]
>();
/** Flare the existing six-metre road into the gate without a square concrete lip. */
export function spaceportApproach(s: SpaceportSite) {
  const cached = approachCache.get(s);
  if (cached) return cached;
  const local = (p: { x: number; z: number }) => ({
    x: (p.x - s.x - (p.z - s.z)) / Math.SQRT2,
    z: (p.x - s.x + (p.z - s.z)) / Math.SQRT2,
  });
  const path = (s.access ?? []).map(local);
  let nearest = -1;
  for (let i = 0; i < path.length; i++)
    if (
      nearest < 0 ||
      Math.hypot(path[i].x, path[i].z - s.fence) <
        Math.hypot(path[nearest].x, path[nearest].z - s.fence)
    )
      nearest = i;
  let end = { x: 0, z: s.fence + 60 },
    tangent = { x: 0, z: 1 };
  // Saved access runs from town towards the gate, then turns into the terminal.
  let previous = { x: 0, z: s.fence },
    remaining = 60;
  for (let i = nearest - 1; i >= 0; i--) {
    const p = path[i],
      length = Math.hypot(p.x - previous.x, p.z - previous.z);
    if (length < 0.001) continue;
    tangent = { x: (p.x - previous.x) / length, z: (p.z - previous.z) / length };
    end = {
      x: previous.x + tangent.x * Math.min(remaining, length),
      z: previous.z + tangent.z * Math.min(remaining, length),
    };
    if (length >= remaining) break;
    remaining -= length;
    previous = p;
  }
  const a = { x: 0, z: s.fence + 3 },
    b = { x: 0, z: s.fence + 25 },
    c = { x: end.x - tangent.x * 20, z: end.z - tangent.z * 20 };
  const result = Array.from({ length: 33 }, (_, i) => {
    const t = i / 32,
      u = 1 - t,
      smooth = t * t * (3 - 2 * t);
    return {
      x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * end.x,
      z: u ** 3 * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t ** 3 * end.z,
      width: 11 - 8 * smooth,
      blend: Math.max(0, (t - 0.55) / 0.45),
    };
  });
  approachCache.set(s, result);
  return result;
}
/** Signed footprint shared by the visual mesh and snow/traction sampling. */
export function spaceportYardDistance(s: SpaceportSite, x: number, z: number) {
  let distance = Infinity;
  for (const p of spaceportPaving(s)) {
    const dx = Math.abs(x - p.x) - p.width / 2 + p.radius,
      dz = Math.abs(z - p.z) - p.depth / 2 + p.radius;
    distance = Math.min(
      distance,
      Math.hypot(Math.max(0, dx), Math.max(0, dz)) + Math.min(0, Math.max(dx, dz)) - p.radius,
    );
  }
  const approach = spaceportApproach(s);
  // The route is short; broad-phase avoids segment checks over the rest of the yard.
  if (z > s.fence && z < s.fence + 85 && Math.abs(x) < 85)
    for (let i = 1; i < approach.length; i++) {
      const a = approach[i - 1],
        b = approach[i],
        dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
      );
      distance = Math.min(
        distance,
        Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - (a.width + (b.width - a.width) * t),
      );
    }
  return distance;
}
export function spaceportPavementDistance(w: Pick<World, 'spaceportSite'>, x: number, z: number) {
  const s = w.spaceportSite;
  if (!s || (s.layout ?? 0) < 3) return Infinity;
  const dx = x - s.x,
    dz = z - s.z;
  if (Math.hypot(dx, dz) > s.fence + 100) return Infinity;
  return Math.min(
    Math.hypot(dx, dz) - 60,
    spaceportYardDistance(s, (dx - dz) / Math.SQRT2, (dx + dz) / Math.SQRT2),
  );
}

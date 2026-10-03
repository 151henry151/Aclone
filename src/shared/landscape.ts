// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World, Player, Action } from './types.ts';
import { terrainHeight } from './terrain.ts';
import { townRoads, roadDistance, type Point, type Road } from './town.ts';
const coordinate = z.number().finite().min(-250).max(250);
const point = z.object({ x: coordinate, z: coordinate });
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const polyline = z
  .array(point)
  .min(2)
  .max(16)
  .refine(
    (points) =>
      points.slice(1).every((p, i) => Math.hypot(p.x - points[i].x, p.z - points[i].z) >= 1),
    'Separate adjacent points by at least one metre',
  );
export const landscapeSchema = z
  .object({
    paths: z
      .array(
        z.object({
          id,
          points: polyline,
          width: z.number().min(1).max(20).default(5),
          curved: z.boolean().default(true),
        }),
      )
      .max(16)
      .default([]),
    surfaces: z
      .array(
        z.object({
          id,
          x: coordinate,
          z: coordinate,
          radius: z.number().min(1).max(100),
          material: z.enum(['grass', 'gravel', 'soil', 'sand']),
        }),
      )
      .max(64)
      .default([]),
    barriers: z
      .array(
        z.object({
          id,
          points: polyline,
          kind: z.enum(['fence', 'wall']).default('fence'),
          height: z.number().min(0.5).max(8).default(1.5),
          width: z.number().min(0.2).max(3).default(0.3),
        }),
      )
      .max(16)
      .default([]),
    scatter: z
      .array(
        z.object({
          id,
          model: id,
          x: coordinate,
          z: coordinate,
          radius: z.number().min(2).max(100),
          count: z.number().int().min(1).max(64),
          seed: z.number().int().min(0).max(1e9),
          scale: z.number().min(0.2).max(3).default(1),
          solid: z.boolean().default(false),
        }),
      )
      .max(16)
      .default([]),
    heightmap: z
      .array(z.number().finite().min(-40).max(40))
      .length(33 * 33)
      .optional(),
  })
  .superRefine((v, ctx) => {
    const all = [...v.paths, ...v.surfaces, ...v.barriers, ...v.scatter];
    if (new Set(all.map((x) => x.id)).size !== all.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate landscape IDs' });
    if (v.scatter.reduce((n, s) => n + s.count, 0) > 128)
      ctx.addIssue({ code: 'custom', message: 'Scatter limit: 128 instances per world' });
    if ([...v.paths, ...v.barriers].reduce((n, p) => n + p.points.length, 0) > 128)
      ctx.addIssue({
        code: 'custom',
        message: 'Limit paths and barriers to 128 control points in total',
      });
    if (
      v.barriers.reduce(
        (n, b) =>
          n +
          b.points
            .slice(1)
            .reduce((m, p, i) => m + Math.hypot(p.x - b.points[i].x, p.z - b.points[i].z), 0),
        0,
      ) > 1200
    )
      ctx.addIssue({ code: 'custom', message: 'Barrier length limit: 1200 metres' });
  });
export type Landscape = z.infer<typeof landscapeSchema>;
export function validateLandscape(w: World, input: unknown) {
  const l = landscapeSchema.parse(input);
  for (const s of l.scatter)
    if (!w.creator?.models.some((m) => m.id === s.model))
      throw Error('Choose an existing Workshop model for scatter');
  return l;
}
export function landscapeAction(w: World, p: Player, a: Action) {
  if (p.authority < 20) throw Error('Only the world caretaker can edit the landscape');
  if (a.operation === 'undo') {
    if (!w.landscapeHistory?.length) throw Error('No landscape change to undo');
    const previous = validateLandscape(w, w.landscapeHistory.at(-1));
    w.landscapeHistory.pop();
    w.landscape = previous;
  } else {
    const next = validateLandscape(w, a.landscape);
    w.landscapeHistory = [
      ...(w.landscapeHistory ?? []),
      structuredClone(w.landscape ?? landscapeSchema.parse({})),
    ].slice(-4);
    w.landscape = next;
  }
  w.revision++;
  return '';
}
/** 33 x 33 samples span the playable -250..250 square; brushes remain additive. */
export function heightmapAt(samples: number[], x: number, z: number) {
  const gx = Math.max(0, Math.min(32, ((x + 250) * 32) / 500)),
    gz = Math.max(0, Math.min(32, ((z + 250) * 32) / 500));
  const ix = Math.min(31, Math.floor(gx)),
    iz = Math.min(31, Math.floor(gz)),
    tx = gx - ix,
    tz = gz - iz;
  return (
    (samples[iz * 33 + ix] * (1 - tx) + samples[iz * 33 + ix + 1] * tx) * (1 - tz) +
    (samples[(iz + 1) * 33 + ix] * (1 - tx) + samples[(iz + 1) * 33 + ix + 1] * tx) * tz
  );
}
const roadCache = new WeakMap<Landscape, Road[]>();
export function landscapeRoads(w: Pick<World, 'landscape'>): Road[] {
  if (!w.landscape) return [];
  const cached = roadCache.get(w.landscape);
  if (cached) return cached;
  const roads: Road[] = [];
  for (const path of w.landscape.paths) {
    const pts = path.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[Math.min(pts.length - 1, i + 2)];
      let a = p1;
      for (let j = 1; j <= (path.curved ? 8 : 1); j++) {
        const t = j / (path.curved ? 8 : 1);
        const interpolate = (key: 'x' | 'z') =>
          Math.max(
            -250,
            Math.min(
              250,
              0.5 *
                (2 * p1[key] +
                  (-p0[key] + p2[key]) * t +
                  (2 * p0[key] - 5 * p1[key] + 4 * p2[key] - p3[key]) * t * t +
                  (-p0[key] + 3 * p1[key] - 3 * p2[key] + p3[key]) * t * t * t),
            ),
          );
        const b = path.curved ? { x: interpolate('x'), z: interpolate('z') } : p2;
        if (Math.hypot(b.x - a.x, b.z - a.z) > 0.001) roads.push({ a, b, width: path.width });
        a = b;
      }
    }
  }
  roadCache.set(w.landscape, roads);
  return roads;
}
type BarrierSegment = Landscape['barriers'][number] & { a: Point; b: Point };
const barrierCache = new WeakMap<Landscape, BarrierSegment[]>();
export function barrierSegments(w: World): BarrierSegment[] {
  if (!w.landscape) return [];
  const cached = barrierCache.get(w.landscape);
  if (cached) return cached;
  const segments = (w.landscape?.barriers ?? []).flatMap((b) =>
    b.points.slice(1).flatMap((to, i) => {
      const from = b.points[i],
        count = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 6);
      return Array.from({ length: count }, (_, j) => ({
        ...b,
        a: { x: from.x + ((to.x - from.x) * j) / count, z: from.z + ((to.z - from.z) * j) / count },
        b: {
          x: from.x + ((to.x - from.x) * (j + 1)) / count,
          z: from.z + ((to.z - from.z) * (j + 1)) / count,
        },
      }));
    }),
  );
  barrierCache.set(w.landscape, segments);
  return segments;
}
function projection(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return { t, distance: Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t) };
}
export function landscapeBlocks(
  w: World,
  from: Point & { y: number },
  to: Point & { y: number },
  padding: number,
  allowEscape: boolean,
) {
  return barrierSegments(w).some((b) => {
    const start = projection(from, b.a, b.b).distance,
      end = projection(to, b.a, b.b).distance,
      r = b.width / 2 + padding;
    if (allowEscape && start < r && end > start) return false;
    // Closest endpoints plus crossing intersection cover the complete swept segment.
    const dx = to.x - from.x,
      dz = to.z - from.z,
      ex = b.b.x - b.a.x,
      ez = b.b.z - b.a.z,
      det = dx * ez - dz * ex;
    const t = det ? ((b.a.x - from.x) * ez - (b.a.z - from.z) * ex) / det : -1;
    const u = det ? ((b.a.x - from.x) * dz - (b.a.z - from.z) * dx) / det : -1;
    const candidates = [
      { t: 0, distance: start },
      { t: 1, distance: end },
      projection(b.a, from, to),
      projection(b.b, from, to),
    ];
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) candidates.push({ t, distance: 0 });
    return candidates.some((c) => {
      const ground = terrainHeight(w, from.x + dx * c.t, from.z + dz * c.t),
        y = from.y + (to.y - from.y) * c.t;
      return c.distance < r && y >= ground - 2 && y < ground + b.height;
    });
  });
}
const scatterCache = new WeakMap<
  World,
  { revision: number; landscape: World['landscape']; objects: ReturnType<typeof makeScatter> }
>();
function makeScatter(w: World) {
  const objects: {
    id: string;
    name: string;
    model: string;
    x: number;
    z: number;
    y: number;
    yaw: number;
    scale: number;
    solid: boolean;
    visible: boolean;
    radius: number;
    prompt: string;
  }[] = [];
  const roads = townRoads(w);
  for (const s of w.landscape?.scatter ?? []) {
    const m = w.creator?.models.find((m) => m.id === s.model);
    if (!m) continue;
    let state = s.seed | 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) | 0;
      return (state >>> 0) / 4294967296;
    };
    let placed = 0;
    for (let attempt = 0; attempt < s.count * 20 && placed < s.count; attempt++) {
      const angle = random() * Math.PI * 2,
        r = Math.sqrt(random()) * s.radius,
        x = s.x + Math.sin(angle) * r,
        z = s.z + Math.cos(angle) * r,
        scale = s.scale * (0.8 + random() * 0.4),
        yaw = random() * 360;
      const radius = Math.max(m.width, m.depth) / 2;
      if (
        Math.abs(x) > 248 ||
        Math.abs(z) > 248 ||
        terrainHeight(w, x, z) < w.settings.seaLevel + 0.3 ||
        roadDistance(roads, x, z) < radius * scale + 2 ||
        w.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 20 + radius * scale) ||
        objects.some((o) => Math.hypot(o.x - x, o.z - z) < o.radius * o.scale + radius * scale)
      )
        continue;
      objects.push({
        id: s.id + '-' + placed++,
        name: m.name,
        model: s.model,
        x,
        z,
        y: 0,
        yaw,
        scale,
        solid: s.solid,
        visible: true,
        radius,
        prompt: '',
      });
    }
  }
  return objects;
}
export function scatterObjects(w: World) {
  const cached = scatterCache.get(w);
  if (cached && cached.revision === w.revision && cached.landscape === w.landscape)
    return cached.objects;
  const objects = makeScatter(w);
  scatterCache.set(w, { revision: w.revision, landscape: w.landscape, objects });
  return objects;
}

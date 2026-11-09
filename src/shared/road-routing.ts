import { publicBridges } from './bridge-network';
import { bridgeDeckHeight, bridgeRectBlocked } from './bridge-geometry';
import { finishRoadWork, riverGeometryStamp, type RoadWork } from './road-work';
import { roadFordSteps } from './road-fords';
import { roadRules } from './road-rules';
import { sceneryBlocksSegmentSteps } from './ground-contacts';
import { pastureParcelSize } from './pasture-land';
import { inlandLevel, inlandWaterAt, nearInlandWater, invalidateInlandWater } from './inland-water';
import { spaceportFences, spaceportStructureFences } from './spaceport-site';
import { highWater } from './ocean';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import type { Point, Road } from './town.ts';
import { roadDistance } from './town.ts';
import { buildingPlan } from './building-shapes.ts';
import { farmPlotCount, farmPlotLocal } from './farm-land.ts';
import { isLivestockFarm } from './pasture-land';
import { terrainHeight, mapHalf } from './terrain.ts';
import { seedOf, valueNoise } from './noise.ts';
import { townAt } from './town-charter.ts';
import { barrierSegments } from './landscape.ts';

export const pointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function roadSamples(r: Road, spacing = 2): Point[] {
  const n = Math.max(1, Math.ceil(pointDistance(r.a, r.b) / spacing));
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: r.a.x + ((r.b.x - r.a.x) * i) / n,
    z: r.a.z + ((r.b.z - r.a.z) * i) / n,
  }));
}
const surveyedWater = new WeakMap<NonNullable<World['northernIsland']>, string>();
/** One clearance policy for new connections, detours and ordinary extensions.
 * Reserve the whole lane width, all farm plots and a small verge. */
export function roadSite(w: World, width = roadRules(w.settings).roadWidth) {
  if (w.northernIsland) {
    const key = JSON.stringify([
      riverGeometryStamp(w.northernIsland.rivers),
      w.northernIsland.ponds,
    ]);
    if (surveyedWater.get(w.northernIsland) !== key) {
      invalidateInlandWater(w);
      surveyedWater.set(w.northernIsland, key);
    }
  }
  const rules = roadRules(w.settings);
  const bridgeWorld = { ...w, bridges: publicBridges(w) };
  const pad = width / 2 + 1,
    half = mapHalf(w) - pad,
    sea = highWater(w) + 0.5,
    seed = seedOf(w.id + ':country-lanes'),
    heights = new Map<string, number>();
  const height = (p: Point) => {
    const key = `${p.x}:${p.z}`;
    let h = heights.get(key);
    if (h === undefined) {
      h = bridgeDeckHeight(bridgeWorld, p.x, p.z) ?? terrainHeight(w, p.x, p.z);
      heights.set(key, h);
    }
    return h;
  };
  // Precompute footprints once per survey. Continuous segment/rectangle tests
  // prevent curves clipping a corner between terrain samples.
  type Rect = {
    x: number;
    z: number;
    hx: number;
    hz: number;
    s: number;
    c: number;
    rx: number;
    rz: number;
  };
  const rect = (x: number, z: number, hx: number, hz: number, angle = 0): Rect => {
    const s = Math.sin(angle),
      c = Math.cos(angle);
    hx += pad;
    hz += pad;
    return {
      x,
      z,
      hx,
      hz,
      s,
      c,
      rx: Math.abs(c) * hx + Math.abs(s) * hz,
      rz: Math.abs(s) * hx + Math.abs(c) * hz,
    };
  };
  const solids: Rect[] = [];
  for (const e of w.earthworks ?? [])
    if (e.progress < 1 && e.work?.active !== false)
      solids.push(rect(e.x, e.z, e.width / 2 + e.shoulder, e.depth / 2 + e.shoulder, e.rotation));
  for (const b of w.buildings) {
    const plan = buildingPlan(b),
      c = Math.cos(b.rotation),
      s = Math.sin(b.rotation);
    const local = (x: number, z: number, hx: number, hz: number) =>
      solids.push(rect(b.x + x * c + z * s, b.z - x * s + z * c, hx, hz, b.rotation));
    for (const v of [...plan.volumes, ...(plan.fixtures ?? [])])
      if (v.eaves + v.rise > 0) local(v.x, v.z, v.width / 2, v.depth / 2);
    if (b.kind === 'farm')
      for (let i = 0; i < farmPlotCount(b); i++) {
        const p = farmPlotLocal(i);
        local(p.x, p.z, 4, 4);
      }
    if (b.pasture && isLivestockFarm(b)) {
      const half = pastureParcelSize(b.pasture) / 2;
      local(
        b.pasture.x + (b.pasture.parcels - 1) * half,
        b.pasture.z,
        b.pasture.parcels * half,
        half,
      );
    }
  }
  if (w.airfield) {
    const a = w.airfield;
    solids.push(rect(a.x, a.z, a.width / 2 + 10, a.length / 2 + 10));
  }
  const fences = [...barrierSegments(w), ...spaceportFences(w), ...spaceportStructureFences(w)].map(
    (b) =>
      rect(
        (b.a.x + b.b.x) / 2,
        (b.a.z + b.b.z) / 2,
        b.width / 2,
        pointDistance(b.a, b.b) / 2,
        Math.atan2(b.b.x - b.a.x, b.b.z - b.a.z),
      ),
  );
  for (const o of w.creator?.objects ?? [])
    if (o.solid) fences.push(rect(o.x, o.z, o.radius, o.radius));
  const intersects = (r: Rect, a: Point, b: Point) => {
    if (
      Math.max(a.x, b.x) < r.x - r.rx ||
      Math.min(a.x, b.x) > r.x + r.rx ||
      Math.max(a.z, b.z) < r.z - r.rz ||
      Math.min(a.z, b.z) > r.z + r.rz
    )
      return false;
    const x = (a.x - r.x) * r.c - (a.z - r.z) * r.s,
      z = (a.x - r.x) * r.s + (a.z - r.z) * r.c;
    const dx = (b.x - a.x) * r.c - (b.z - a.z) * r.s,
      dz = (b.x - a.x) * r.s + (b.z - a.z) * r.c;
    let lo = 0,
      hi = 1;
    for (const [v, d, h] of [
      [x, dx, r.hx],
      [z, dz, r.hz],
    ]) {
      if (Math.abs(d) < 1e-10) {
        if (Math.abs(v) >= h) return false;
        continue;
      }
      const t1 = (-h - v) / d,
        t2 = (h - v) / d;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo >= hi) return false;
    }
    return true;
  };
  const allSolids = [...solids, ...fences];
  function* occupiedSteps(p: Point): RoadWork<boolean> {
    return (
      solids.some((r) => intersects(r, p, p)) || (yield* sceneryBlocksSegmentSteps(w, p, p, pad))
    );
  }
  const occupied = (p: Point) => finishRoadWork(occupiedSteps(p));
  const dry = (p: Point) => {
    if (Math.abs(p.x) >= half || Math.abs(p.z) >= half) return false;
    const water = inlandWaterAt(w, p.x, p.z),
      level = inlandLevel(w, p.x, p.z, sea);
    return (
      height(p) > level ||
      !!(rules.roadFords && water?.river && level - height(p) <= rules.groundWaterDepth)
    );
  };
  const allowed = (p: Point) => {
    const town = townAt(w, p.x, p.z);
    return !town || town.permissions.residents.roads || town.permissions.guests.roads;
  };
  function* clearSteps(p: Point): RoadWork<boolean> {
    return (
      !(yield* occupiedSteps(p)) && !fences.some((r) => intersects(r, p, p)) && dry(p) && allowed(p)
    );
  }
  const clear = (p: Point) => finishRoadWork(clearSteps(p));
  // Cost includes actual intermediate rises, not just endpoint elevations. That
  // prevents a straight shortcut over a hill whose two ends are equally low.
  /** Shared obstruction survey; bridges supply their own elevated water/grade policy. */
  function* unobstructedSteps(a: Point, b: Point, scenery = true): RoadWork<boolean> {
    if (allSolids.some((r) => intersects(r, a, b))) return false;
    if (scenery) {
      const parts = Math.max(1, Math.ceil(pointDistance(a, b) / 32));
      for (let i = 0; i < parts; i++) {
        yield;
        const point = (t: number) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        if (yield* sceneryBlocksSegmentSteps(w, point(i / parts), point((i + 1) / parts), pad))
          return false;
      }
    }
    return true;
  }
  function* costSteps(a: Point, b: Point, spacing = 2, scenery = true): RoadWork<number> {
    if (!(yield* unobstructedSteps(a, b, scenery))) return Infinity;
    if (bridgeWorld.bridges.length) {
      const length = pointDistance(a, b) || 1,
        dx = (b.x - a.x) / length,
        dz = (b.z - a.z) / length;
      const from = {
        ...a,
        hx: width / 2,
        hz: 0.001,
        axes: [
          { x: dz, z: -dx },
          { x: dx, z: dz },
        ],
      };
      if (bridgeRectBlocked(bridgeWorld, from, { ...from, ...b })) return Infinity;
    }
    const length = pointDistance(a, b),
      n = Math.max(1, Math.ceil(length / spacing));
    if (!dry(a) || !allowed(a)) return Infinity;
    // Check the full lane on river approaches, not just a shallow centreline.
    const sidePoint = (p: Point, side: number) => ({
      x: p.x + ((b.z - a.z) * side) / (length || 1),
      z: p.z - ((b.x - a.x) * side) / (length || 1),
    });
    let prior = a;
    let previous = height(a),
      total = 0;
    const step = length / n;

    for (let i = 1; i <= n; i++) {
      if (i % 8 === 1) yield;
      const t = i / n,
        p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (!dry(p) || !allowed(p)) return Infinity;
      if (nearInlandWater(w, p.x, p.z, pad) || nearInlandWater(w, prior.x, prior.z, pad)) {
        const verge = bridgeDeckHeight(bridgeWorld, p.x, p.z) !== undefined ? width / 2 : pad;
        for (const side of [-verge, verge]) {
          const q = sidePoint(p, side),
            before = sidePoint(prior, side);
          if (
            !dry(q) ||
            !dry(before) ||
            !allowed(q) ||
            !allowed(before) ||
            Math.abs(height(q) - height(before)) / Math.max(step, 1e-6) > rules.roadMaxGrade
          )
            return Infinity;
        }
      }
      prior = p;
      const h = height(p),
        rise = Math.abs(h - previous),
        grade = rise / Math.max(step, 1e-6);
      if (grade > rules.roadMaxGrade) return Infinity;
      // Rolling terrain is affordable; repeated climbs and steep grades are dear.
      // Broad seeded variation is stable across planning, saves and restarts.
      total +=
        step * (1 + 0.08 * (valueNoise(p.x / 220, p.z / 220, seed) + 1) + 8 * grade * grade) +
        5 * rise;
      previous = h;
    }
    return total;
  }
  function* segmentSteps(a: Point, b: Point): RoadWork<boolean> {
    return Number.isFinite(yield* costSteps(a, b));
  }
  const cost = (a: Point, b: Point, spacing = 2, scenery = true) =>
    finishRoadWork(costSteps(a, b, spacing, scenery));
  const segment = (a: Point, b: Point) => finishRoadWork(segmentSteps(a, b));
  return {
    occupied,
    clear,
    occupiedSteps,
    clearSteps,
    segment,
    cost,
    costSteps,
    segmentSteps,
    unobstructedSteps,
  };
}

/** Round corners and give long open stretches a little survey variation. Every
 * proposed bend uses the same clearance/grade/cost checks as the route search. */
function* naturalAlignment(
  w: World,
  path: Point[],
  site: ReturnType<typeof roadSite>,
): RoadWork<Point[]> {
  const seed = seedOf(w.id + ':lane-bends');
  function* cost(ps: Point[]): RoadWork<number> {
    let sum = 0;
    for (let i = 1; i < ps.length; i++) sum += yield* site.costSteps(ps[i - 1], ps[i]);
    return sum;
  }
  const rounded: Point[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1],
      b = path[i],
      c = path[i + 1];
    const cut = Math.min(24, pointDistance(a, b) / 4, pointDistance(b, c) / 4);
    const towards = (p: Point) => {
      const t = cut / pointDistance(b, p);
      return { x: b.x + (p.x - b.x) * t, z: b.z + (p.z - b.z) * t };
    };
    if (cut < 2) {
      rounded.push(b);
      continue;
    }
    const enter = towards(a),
      leave = towards(c);
    const curve = Array.from({ length: 5 }, (_, k) => {
      const t = k / 4,
        u = 1 - t;
      return {
        x: u * u * enter.x + 2 * u * t * b.x + t * t * leave.x,
        z: u * u * enter.z + 2 * u * t * b.z + t * t * leave.z,
      };
    });
    const curveCost = yield* cost(curve);
    if (Number.isFinite(curveCost) && curveCost <= (yield* cost([enter, b, leave])) * 1.03)
      rounded.push(...curve);
    else rounded.push(b);
  }
  rounded.push(path.at(-1)!);
  const result: Point[] = [rounded[0]];
  for (let i = 1; i < rounded.length; i++) {
    const a = rounded[i - 1],
      b = rounded[i],
      length = pointDistance(a, b);
    if (length < 160) {
      result.push(b);
      continue;
    }
    const n = Math.ceil(length / 24),
      amplitude = Math.min(16, length * 0.035);
    const curve = Array.from({ length: n + 1 }, (_, k) => {
      if (k === 0) return a;
      if (k === n) return b;
      const t = k / n,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      const offset = amplitude * Math.sin(Math.PI * t) ** 2 * valueNoise(x / 170, z / 170, seed);
      return { x: x - ((b.z - a.z) / length) * offset, z: z + ((b.x - a.x) / length) * offset };
    });
    const curveCost = yield* cost(curve);
    if (Number.isFinite(curveCost) && curveCost <= (yield* site.costSteps(a, b)) * 1.04)
      result.push(...curve.slice(1));
    else result.push(b);
  }
  // Adjacent rounded corners also change their joining segment. Validate the
  // complete result and retain the surveyed path if cosmetic bends are unsafe.
  for (let i = 1; i < result.length; i++)
    if (!(yield* site.segmentSteps(result[i - 1], result[i]))) return path;
  return result;
}

/** Bounded A*: a wider survey with coarser cells handles kilometre-scale country
 * roads, while every edge still checks terrain and obstacles every two metres.
 * Short urban connections retain the fine grid. Simplification preserves the
 * climb savings instead of replacing a contouring route with a straight climb. */
export function roadRoute(
  w: World,
  start: Point,
  goal: Point,
  width = roadRules(w.settings).roadWidth,
) {
  return finishRoadWork(roadRouteSteps(w, start, goal, width));
}
export function* roadRouteSteps(
  w: World,
  start: Point,
  goal: Point,
  width = roadRules(w.settings).roadWidth,
): RoadWork<Point[] | undefined> {
  const direct = yield* roadGridRoute(w, start, goal, width);
  if (direct || pointDistance(start, goal) <= 800) return direct;
  const site = roadSite(w, width);
  if (!(yield* site.clearSteps(start)) || !(yield* site.clearSteps(goal))) return;
  const candidates = (yield* roadFordSteps(w, site, width))
    .flatMap((f) => [
      { a: f.a, b: f.b },
      { a: f.b, b: f.a },
    ])
    .sort(
      (a, b) =>
        pointDistance(start, a.a) +
        pointDistance(a.b, goal) -
        (pointDistance(start, b.a) + pointDistance(b.b, goal)),
    );
  // A single start-anchored grid may miss the turn onto a narrow bank. Re-anchor
  // each landward stage at the surveyed approach; retain every validated point.
  for (const ford of candidates) {
    const before = yield* roadGridRoute(w, start, ford.a, width);
    if (!before) continue;
    const after = yield* roadGridRoute(w, ford.b, goal, width);
    if (after) return [...before, ford.b, ...after.slice(1)];
  }
}
function* roadGridRoute(
  w: World,
  start: Point,
  goal: Point,
  width: number,
): RoadWork<Point[] | undefined> {
  const site = roadSite(w, width),
    distance = pointDistance(start, goal);
  if (!(yield* site.clearSteps(start)) || !(yield* site.clearSteps(goal))) return;
  if (distance < 80 && (yield* site.segmentSteps(start, goal))) return [start, goal];
  const cell = distance > 2500 ? 96 : distance > 800 ? 24 : 8;
  const margin = Math.max(256, distance * 0.5),
    half = mapHalf(w);
  const minX = Math.max(-half, Math.min(start.x, goal.x) - margin),
    maxX = Math.min(half, Math.max(start.x, goal.x) + margin),
    minZ = Math.max(-half, Math.min(start.z, goal.z) - margin),
    maxZ = Math.min(half, Math.max(start.z, goal.z) + margin);
  // Fine local paths handle streets; coarse searches explicitly visit surveyed
  // ford approaches instead of hoping a grid vertex falls on a narrow crossing.
  // A mainland survey must not validate every remote island ford. The widest
  // skewed approach reaches sqrt(1 + 4²) times the normal bank clearance.
  // If any approach can reach this search box, retain the full cached survey.
  const nearbyRiver = w.northernIsland?.rivers.some((river) =>
    river.points.some((p) => {
      const reach = (p.width / 2 + width * 3) * Math.sqrt(17);
      return (
        p.x + reach >= minX && p.x - reach <= maxX && p.z + reach >= minZ && p.z - reach <= maxZ
      );
    }),
  );
  const fordPortals =
    distance > 800 && nearbyRiver
      ? (yield* roadFordSteps(w, site, width))
          .flatMap((f) => [
            { id: f.id + ':a', p: f.a, other: f.b, otherId: f.id + ':b' },
            { id: f.id + ':b', p: f.b, other: f.a, otherId: f.id + ':a' },
          ])
          .filter((f) => f.p.x >= minX && f.p.x <= maxX && f.p.z >= minZ && f.p.z <= maxZ)
      : [];
  const portals = [
    ...fordPortals,
    ...publicBridges(w)
      .filter((b) => b.width >= width)
      .flatMap((b) => [
        { id: b.id + ':a', p: b.approachA, other: b.approachB, otherId: b.id + ':b' },
        { id: b.id + ':b', p: b.approachB, other: b.approachA, otherId: b.id + ':a' },
      ]),
  ].filter((p) => p.p.x >= minX && p.p.x <= maxX && p.p.z >= minZ && p.p.z <= maxZ);
  type Node = { i: number; j: number; id?: string; p: Point; g: number; f: number; parent?: Node };
  const nodeKey = (n: Node) => n.id ?? `${n.i}:${n.j}`;
  const heap: Node[] = [],
    costs = new Map<string, number>();
  const push = (n: Node) => {
    let i = heap.length;
    heap.push(n);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= n.f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = n;
  };
  const pop = () => {
    const root = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
        if (heap[c].f >= last.f) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = last;
    }
    return root;
  };
  push({ i: 0, j: 0, p: start, g: 0, f: distance });
  costs.set('0:0', 0);
  const cached = new Map<string, boolean>(),
    settled = new Set<string>();
  for (let visits = 0; heap.length && visits < 16000; visits++) {
    yield;
    const n = pop();
    if (n.g !== costs.get(nodeKey(n)) || settled.has(nodeKey(n))) continue;
    settled.add(nodeKey(n));
    for (const portal of portals) {
      if (settled.has(portal.id) || portal.id === n.id) continue;
      const linked = n.id && portals.find((p) => p.id === n.id)?.otherId === portal.id;
      if (!linked && pointDistance(n.p, portal.p) > cell * 2) continue;
      const g = n.g + (yield* site.costSteps(n.p, portal.p));
      if (g >= (costs.get(portal.id) ?? Infinity)) continue;
      costs.set(portal.id, g);
      push({
        id: portal.id,
        i: Math.round((portal.p.x - start.x) / cell),
        j: Math.round((portal.p.z - start.z) / cell),
        p: portal.p,
        g,
        f: g + pointDistance(portal.p, goal),
        parent: n,
      });
    }
    const finish =
      pointDistance(n.p, goal) <= cell * 2
        ? (yield* site.segmentSteps(n.p, goal))
          ? [n.p, goal]
          : cell > 8
            ? yield* roadGridRoute(w, n.p, goal, width)
            : undefined
        : undefined;
    if (finish) {
      const path = finish.slice(1).reverse();
      let at: Node | undefined = n;
      while (at) {
        path.push(at.p);
        at = at.parent;
      }
      path.reverse();
      // Coarse surveys are cheap. Refine any edge with a missed narrow obstacle
      // using the fine urban grid before accepting or smoothing the result.
      const refined: Point[] = [path[0]];
      for (let i = 1; i < path.length; i++) {
        if (yield* site.segmentSteps(path[i - 1], path[i])) refined.push(path[i]);
        else {
          const local = cell > 8 ? yield* roadGridRoute(w, path[i - 1], path[i], width) : undefined;
          if (!local) return;
          refined.push(...local.slice(1));
        }
      }
      path.splice(0, path.length, ...refined);
      const totals = [0];
      for (let i = 1; i < path.length; i++)
        totals.push(totals[i - 1] + (yield* site.costSteps(path[i - 1], path[i])));
      const simple = [path[0]];
      for (let i = 0; i < path.length - 1;) {
        let j = path.length - 1;
        if (distance > 800) {
          // Grow long-road shortcuts locally rather than repeatedly querying
          // the whole island for every small forest detour.
          j = i + 1;
          while (
            j + 1 < path.length &&
            (yield* site.costSteps(path[i], path[j + 1])) <= (totals[j + 1] - totals[i]) * 1.015
          )
            j++;
        } else {
          while (
            j > i + 1 &&
            (yield* site.costSteps(path[i], path[j])) > (totals[j] - totals[i]) * 1.015
          )
            j--;
        }
        simple.push(path[j]);
        i = j;
      }
      return yield* naturalAlignment(w, simple, site);
    }
    for (const [di, dj] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const i = n.i + di,
        j = n.j + dj,
        key = `${i}:${j}`;
      if (settled.has(key)) continue;
      const p = { x: start.x + i * cell, z: start.z + j * cell };
      if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) continue;
      if (n.g + cell * Math.hypot(di, dj) >= (costs.get(key) ?? Infinity)) continue;
      let valid = cached.get(key);
      if (valid === undefined) {
        valid = yield* site.clearSteps(p);
        cached.set(key, valid);
      }
      if (!valid) continue;
      const g = n.g + (yield* site.costSteps(n.p, p, cell > 24 ? 16 : cell > 8 ? 8 : 2, cell <= 8));
      if (g >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, g);
      push({ i, j, p, g, f: g + pointDistance(p, goal), parent: n });
    }
  }
}

/** Segments meet at junctions and crossings, not just identical endpoints. */
export function roadsTouch(a: Road, b: Road) {
  const cross = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const a1 = cross(a.a, a.b, b.a),
    a2 = cross(a.a, a.b, b.b),
    b1 = cross(b.a, b.b, a.a),
    b2 = cross(b.a, b.b, a.b);
  if (a1 * a2 < 0 && b1 * b2 < 0) return true;
  return (
    [a.a, a.b].some((p) => roadDistance([b], p.x, p.z) <= a.width / 2 + 0.05) ||
    [b.a, b.b].some((p) => roadDistance([a], p.x, p.z) <= b.width / 2 + 0.05)
  );
}
export function roadComponents(roads: readonly Road[]) {
  return finishRoadWork(roadComponentSteps(roads));
}
export function* roadComponentSteps(roads: readonly Road[]): RoadWork<Road[][]> {
  const unique = [...new Set(roads)];
  // Index conservative lane bounds before doing exact crossing/distance checks.
  // Very long segments use a fallback list rather than filling an enormous grid.
  const cell = 64;
  const bounds = unique.map((r) => {
    const padding = r.width / 2 + 0.05;
    const minX = Math.min(r.a.x, r.b.x) - padding,
      maxX = Math.max(r.a.x, r.b.x) + padding,
      minZ = Math.min(r.a.z, r.b.z) - padding,
      maxZ = Math.max(r.a.z, r.b.z) + padding;
    return {
      minX,
      maxX,
      minZ,
      maxZ,
      x0: Math.floor(minX / cell),
      x1: Math.floor(maxX / cell),
      z0: Math.floor(minZ / cell),
      z1: Math.floor(maxZ / cell),
    };
  });
  const buckets = new Map<string, number[]>(),
    long = new Set<number>();
  for (let i = 0; i < unique.length; i++) {
    yield;
    const b = bounds[i];
    if ((b.x1 - b.x0 + 1) * (b.z1 - b.z0 + 1) > 256) {
      long.add(i);
      continue;
    }
    for (let x = b.x0; x <= b.x1; x++)
      for (let z = b.z0; z <= b.z1; z++) {
        const key = `${x}:${z}`;
        let bucket = buckets.get(key);
        if (!bucket) buckets.set(key, (bucket = []));
        bucket.push(i);
      }
  }
  const remaining = new Set(unique.map((_, i) => i)),
    groups: Road[][] = [];
  while (remaining.size) {
    const group = [remaining.values().next().value!];
    remaining.delete(group[0]);
    for (let i = 0; i < group.length; i++) {
      yield;
      const id = group[i],
        a = bounds[id];
      const candidates = new Set(long.has(id) ? remaining : long);
      if (!long.has(id))
        for (let x = a.x0; x <= a.x1; x++)
          for (let z = a.z0; z <= a.z1; z++)
            for (const other of buckets.get(`${x}:${z}`) ?? []) candidates.add(other);
      // Preserve the original breadth-first order; planners use its tie breaks.
      for (const other of [...candidates].sort((a, b) => a - b)) {
        yield;
        if (!remaining.has(other)) continue;
        const b = bounds[other];
        if (a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ) continue;
        if (roadsTouch(unique[id], unique[other])) {
          group.push(other);
          remaining.delete(other);
        }
      }
    }
    groups.push(group.map((i) => unique[i]));
  }
  return groups;
}

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
/** One clearance policy for new connections, detours and ordinary extensions.
 * Reserve the whole lane width, all farm plots and a small verge. */
export function roadSite(w: World, width = 5) {
  const pad = width / 2 + 1,
    half = mapHalf(w) - pad,
    sea = highWater(w) + 0.5,
    seed = seedOf(w.id + ':country-lanes'),
    heights = new Map<string, number>();
  const height = (p: Point) => {
    const key = `${p.x}:${p.z}`;
    let h = heights.get(key);
    if (h === undefined) {
      h = terrainHeight(w, p.x, p.z);
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
    if (b.pasture && isLivestockFarm(b))
      local(b.pasture.x + (b.pasture.parcels - 1) * 8, b.pasture.z, b.pasture.parcels * 8, 8);
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
  const occupied = (p: Point) => solids.some((r) => intersects(r, p, p));
  const dry = (p: Point) => Math.abs(p.x) < half && Math.abs(p.z) < half && height(p) > sea;
  const allowed = (p: Point) => {
    const town = townAt(w, p.x, p.z);
    return !town || town.permissions.residents.roads || town.permissions.guests.roads;
  };
  const clear = (p: Point) =>
    !occupied(p) && !fences.some((r) => intersects(r, p, p)) && dry(p) && allowed(p);
  // Cost includes actual intermediate rises, not just endpoint elevations. That
  // prevents a straight shortcut over a hill whose two ends are equally low.
  const cost = (a: Point, b: Point, spacing = 2) => {
    if (allSolids.some((r) => intersects(r, a, b))) return Infinity;
    const length = pointDistance(a, b),
      n = Math.max(1, Math.ceil(length / spacing));
    if (!dry(a) || !allowed(a)) return Infinity;
    let previous = height(a),
      total = 0;
    const step = length / n;

    for (let i = 1; i <= n; i++) {
      const t = i / n,
        p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      if (!dry(p) || !allowed(p)) return Infinity;
      const h = height(p),
        rise = Math.abs(h - previous),
        grade = rise / Math.max(step, 1e-6);
      if (grade > 0.35) return Infinity;
      // Rolling terrain is affordable; repeated climbs and steep grades are dear.
      // Broad seeded variation is stable across planning, saves and restarts.
      total +=
        step * (1 + 0.08 * (valueNoise(p.x / 220, p.z / 220, seed) + 1) + 8 * grade * grade) +
        5 * rise;
      previous = h;
    }
    return total;
  };
  const segment = (a: Point, b: Point) => Number.isFinite(cost(a, b));
  return { occupied, clear, segment, cost };
}

/** Round corners and give long open stretches a little survey variation. Every
 * proposed bend uses the same clearance/grade/cost checks as the route search. */
function naturalAlignment(w: World, path: Point[], site: ReturnType<typeof roadSite>) {
  const seed = seedOf(w.id + ':lane-bends');
  const cost = (ps: Point[]) => ps.slice(1).reduce((sum, p, i) => sum + site.cost(ps[i], p), 0);
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
    if (cost(curve) <= cost([enter, b, leave]) * 1.03) rounded.push(...curve);
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
    if (cost(curve) <= site.cost(a, b) * 1.04) result.push(...curve.slice(1));
    else result.push(b);
  }
  return result;
}

/** Bounded A*: a wider survey with coarser cells handles kilometre-scale country
 * roads, while every edge still checks terrain and obstacles every two metres.
 * Short urban connections retain the fine grid. Simplification preserves the
 * climb savings instead of replacing a contouring route with a straight climb. */
export function roadRoute(w: World, start: Point, goal: Point, width = 5): Point[] | undefined {
  const site = roadSite(w, width),
    distance = pointDistance(start, goal);
  if (!site.clear(start) || !site.clear(goal)) return;
  if (distance < 80 && site.segment(start, goal)) return [start, goal];
  const cell = distance > 2500 ? 96 : distance > 800 ? 24 : 8;
  const margin = Math.max(256, distance * 0.5),
    half = mapHalf(w);
  const minX = Math.max(-half, Math.min(start.x, goal.x) - margin),
    maxX = Math.min(half, Math.max(start.x, goal.x) + margin),
    minZ = Math.max(-half, Math.min(start.z, goal.z) - margin),
    maxZ = Math.min(half, Math.max(start.z, goal.z) + margin);
  type Node = { i: number; j: number; p: Point; g: number; f: number; parent?: Node };
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
    const n = pop();
    if (n.g !== costs.get(`${n.i}:${n.j}`) || settled.has(`${n.i}:${n.j}`)) continue;
    settled.add(`${n.i}:${n.j}`);
    if (pointDistance(n.p, goal) <= cell * 2 && site.segment(n.p, goal)) {
      const path = [goal];
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
        if (site.segment(path[i - 1], path[i])) refined.push(path[i]);
        else {
          const local = cell > 8 ? roadRoute(w, path[i - 1], path[i], width) : undefined;
          if (!local) return;
          refined.push(...local.slice(1));
        }
      }
      path.splice(0, path.length, ...refined);
      const totals = [0];
      for (let i = 1; i < path.length; i++)
        totals.push(totals[i - 1] + site.cost(path[i - 1], path[i]));
      const simple = [path[0]];
      for (let i = 0; i < path.length - 1;) {
        let j = path.length - 1;
        while (j > i + 1 && site.cost(path[i], path[j]) > (totals[j] - totals[i]) * 1.015) j--;
        simple.push(path[j]);
        i = j;
      }
      return naturalAlignment(w, simple, site);
    }
    for (const [di, dj] of [
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
        valid = site.clear(p);
        cached.set(key, valid);
      }
      if (!valid) continue;
      const g = n.g + site.cost(n.p, p, cell > 24 ? 16 : cell > 8 ? 8 : 2);
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
  const groups: Road[][] = [],
    remaining = new Set(roads);
  while (remaining.size) {
    const group = [remaining.values().next().value!];
    remaining.delete(group[0]);
    for (let i = 0; i < group.length; i++)
      for (const r of remaining)
        if (roadsTouch(group[i], r)) {
          group.push(r);
          remaining.delete(r);
        }
    groups.push(group);
  }
  return groups;
}

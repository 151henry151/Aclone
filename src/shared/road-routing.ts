import { spaceportFences } from './spaceport-site';
import { highWater } from './ocean';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import type { Point, Road } from './town.ts';
import { roadDistance } from './town.ts';
import { buildingBounds, buildingPlan, blocksBuilding } from './building-shapes.ts';
import { onFarmLand } from './farm-land.ts';
import { terrainHeight, mapHalf } from './terrain.ts';
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
    half = mapHalf(w) - pad;
  const buildings = w.buildings.map((b) => ({
    b,
    radius: (() => {
      const bounds = buildingBounds(buildingPlan(b));
      return (
        Math.hypot(
          Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
          Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
        ) + pad
      );
    })(),
  }));
  const barriers = [...barrierSegments(w), ...spaceportFences(w)];
  const occupied = (p: Point) =>
    onFarmLand(w, p.x, p.z, pad) ||
    buildings.some(
      ({ b, radius }) =>
        Math.abs(b.x - p.x) < radius &&
        Math.abs(b.z - p.z) < radius &&
        blocksBuilding(b, p.x, p.z, 0, pad),
    );
  const dry = (p: Point) =>
    Math.abs(p.x) < half && Math.abs(p.z) < half && terrainHeight(w, p.x, p.z) > highWater(w) + 0.5;
  const allowed = (p: Point) => {
    const town = townAt(w, p.x, p.z);
    return !town || town.permissions.residents.roads || town.permissions.guests.roads;
  };
  const clear = (p: Point) =>
    !occupied(p) &&
    dry(p) &&
    allowed(p) &&
    !barriers.some((b) => roadDistance([{ a: b.a, b: b.b, width: b.width }], p.x, p.z) < pad) &&
    !w.creator?.objects.some((o) => o.solid && Math.hypot(p.x - o.x, p.z - o.z) < o.radius + pad);
  const segment = (a: Point, b: Point) => roadSamples({ a, b, width }, 2).every(clear);
  return { occupied, clear, segment };
}

/** Bounded, deterministic A*: avoids getting stuck repeatedly steering toward a
 * wall. 8 m planning cells are validated at 2 m intervals, including diagonals.
 * A generous corridor allows a natural jog; impossible routes remain pending. */
export function roadRoute(w: World, start: Point, goal: Point, width = 5): Point[] | undefined {
  const site = roadSite(w, width);
  if (!site.clear(start) || !site.clear(goal)) return;
  if (site.segment(start, goal)) return [start, goal];
  const cell = 8,
    margin = 256;
  const minX = Math.min(start.x, goal.x) - margin,
    maxX = Math.max(start.x, goal.x) + margin;
  const minZ = Math.min(start.z, goal.z) - margin,
    maxZ = Math.max(start.z, goal.z) + margin;
  type Node = { i: number; j: number; p: Point; g: number; f: number; parent?: Node };
  const heap: Node[] = [],
    cost = new Map<string, number>();
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
  push({ i: 0, j: 0, p: start, g: 0, f: pointDistance(start, goal) });
  cost.set('0:0', 0);
  const cached = new Map<string, boolean>();
  for (let visits = 0; heap.length && visits < 16000; visits++) {
    const n = pop();
    if (n.g !== cost.get(`${n.i}:${n.j}`)) continue;
    if (pointDistance(n.p, goal) <= cell * 2 && site.segment(n.p, goal)) {
      const path = [goal];
      let at: Node | undefined = n;
      while (at) {
        path.push(at.p);
        at = at.parent;
      }
      path.reverse();
      const simple = [path[0]];
      for (let i = 0; i < path.length - 1;) {
        let j = path.length - 1;
        while (j > i + 1 && !site.segment(path[i], path[j])) j--;
        simple.push(path[j]);
        i = j;
      }
      return simple;
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
      const p = { x: start.x + i * cell, z: start.z + j * cell };
      if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ) continue;
      const g = n.g + cell * Math.hypot(di, dj);
      if (g >= (cost.get(key) ?? Infinity)) continue;
      let valid = cached.get(key);
      if (valid === undefined) {
        valid = site.clear(p);
        cached.set(key, valid);
      }
      if (!valid || !site.segment(n.p, p)) continue;
      cost.set(key, g);
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

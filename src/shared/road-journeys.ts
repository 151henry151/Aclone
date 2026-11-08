// SPDX-License-Identifier: GPL-3.0-or-later
import type { Point, Road } from './town';
import type { RoadWork } from './road-work';

export function roadProjection(r: Road, p: Point) {
  const dx = r.b.x - r.a.x,
    dz = r.b.z - r.a.z;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - r.a.x) * dx + (p.z - r.a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return { t, x: r.a.x + t * dx, z: r.a.z + t * dz };
}
type Edge = { to: number; distance: number };
export interface RoadJourneys {
  edges: Edge[][];
  anchors: number[];
}
/** Split centre lines at actual junctions and projected destination access points.
 * Short joins across overlapping lane widths retain their physical distance. */
export function* roadJourneyGraphSteps(
  roads: readonly Road[],
  anchors: readonly Point[],
): RoadWork<RoadJourneys> {
  const edges: Edge[][] = [],
    points: Point[] = [],
    cuts: Map<number, number>[] = [];
  const at = (i: number, t: number) => {
    const key = Math.round(t * 1e9) / 1e9,
      old = cuts[i].get(key);
    if (old !== undefined) return old;
    const r = roads[i],
      id = points.length;
    points.push({ x: r.a.x + t * (r.b.x - r.a.x), z: r.a.z + t * (r.b.z - r.a.z) });
    edges.push([]);
    cuts[i].set(key, id);
    return id;
  };
  const link = (a: number, b: number) => {
    if (a === b) return;
    const distance = Math.hypot(points[a].x - points[b].x, points[a].z - points[b].z);
    edges[a].push({ to: b, distance });
    edges[b].push({ to: a, distance });
  };
  const bounds = roads.map((r) => {
    const pad = r.width / 2 + 0.05;
    return {
      minX: Math.min(r.a.x, r.b.x) - pad,
      maxX: Math.max(r.a.x, r.b.x) + pad,
      minZ: Math.min(r.a.z, r.b.z) - pad,
      maxZ: Math.max(r.a.z, r.b.z) + pad,
    };
  });
  const buckets = new Map<string, number[]>(),
    long = new Set<number>();
  for (let i = 0; i < roads.length; i++) {
    yield;
    cuts.push(new Map());
    at(i, 0);
    at(i, 1);
    const b = bounds[i],
      x0 = Math.floor(b.minX / 16),
      x1 = Math.floor(b.maxX / 16),
      z0 = Math.floor(b.minZ / 16),
      z1 = Math.floor(b.maxZ / 16);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 256) {
      long.add(i);
      continue;
    }
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const key = `${x}:${z}`,
          ids = buckets.get(key) ?? [];
        ids.push(i);
        buckets.set(key, ids);
      }
  }
  for (let i = 0; i < roads.length; i++) {
    yield;
    const a = roads[i],
      box = bounds[i],
      candidates = new Set<number>(long);
    if (long.has(i)) for (let j = i + 1; j < roads.length; j++) candidates.add(j);
    else
      for (let x = Math.floor(box.minX / 16); x <= Math.floor(box.maxX / 16); x++)
        for (let z = Math.floor(box.minZ / 16); z <= Math.floor(box.maxZ / 16); z++)
          for (const j of buckets.get(`${x}:${z}`) ?? []) candidates.add(j);
    for (const j of candidates) {
      yield;
      if (j <= i) continue;
      const b = roads[j],
        other = bounds[j];
      if (
        box.maxX < other.minX ||
        box.minX > other.maxX ||
        box.maxZ < other.minZ ||
        box.minZ > other.maxZ
      )
        continue;
      const dx = a.b.x - a.a.x,
        dz = a.b.z - a.a.z,
        ex = b.b.x - b.a.x,
        ez = b.b.z - b.a.z,
        det = dx * ez - dz * ex;
      if (Math.abs(det) > 1e-12) {
        const t = ((b.a.x - a.a.x) * ez - (b.a.z - a.a.z) * ex) / det,
          u = ((b.a.x - a.a.x) * dz - (b.a.z - a.a.z) * dx) / det;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) link(at(i, t), at(j, u));
      }
      for (const [from, to] of [
        [i, j],
        [j, i],
      ])
        for (const t of [0, 1]) {
          const p = t ? roads[from].b : roads[from].a,
            q = roadProjection(roads[to], p);
          if (Math.hypot(p.x - q.x, p.z - q.z) <= (a.width + b.width) / 2 + 0.05)
            link(at(from, t), at(to, q.t));
        }
    }
  }
  const ids: number[] = [];
  for (const p of anchors) {
    let best = -1,
      distance = Infinity,
      t = 0;
    for (let i = 0; i < roads.length; i++) {
      yield;
      const q = roadProjection(roads[i], p),
        d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < distance) {
        distance = d;
        best = i;
        t = q.t;
      }
    }
    ids.push(best < 0 ? -1 : at(best, t));
  }
  for (const row of cuts) {
    yield;
    const ordered = [...row].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ordered.length; i++) {
      yield;
      link(ordered[i - 1][1], ordered[i][1]);
    }
  }
  return { edges, anchors: ids };
}
/** Dijkstra yields between settled junctions and uses a binary heap. */
export function* roadJourneyDistances(graph: RoadJourneys, from: number): RoadWork<number[]> {
  const distances = graph.edges.map(() => Infinity),
    heap: { id: number; distance: number }[] = [];
  const push = (id: number, distance: number) => {
    let i = heap.length;
    heap.push({ id, distance });
    while (i) {
      const parent = (i - 1) >> 1;
      if (heap[parent].distance <= distance) break;
      heap[i] = heap[parent];
      i = parent;
    }
    heap[i] = { id, distance };
  };
  if (from < 0) return distances;
  distances[from] = 0;
  push(from, 0);
  while (heap.length) {
    yield;
    const next = heap[0],
      last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].distance < heap[child].distance) child++;
        if (heap[child].distance >= last.distance) break;
        heap[i] = heap[child];
        i = child;
      }
      heap[i] = last;
    }
    if (next.distance !== distances[next.id]) continue;
    let visitedEdges = 0;
    for (const edge of graph.edges[next.id]) {
      if (++visitedEdges % 64 === 0) yield;
      const d = next.distance + edge.distance;
      if (d < distances[edge.to]) {
        distances[edge.to] = d;
        push(edge.to, d);
      }
    }
  }
  return distances;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { townRoads, type Point, type Road } from './town';
import { roadRules, roadAlternatePolicy } from './road-rules';
import { roadSite, roadRouteSteps, pointDistance } from './road-routing';
import { safeNearestSteps, type RoadProject } from './road-projects';
import { roadJourneyGraphSteps, roadJourneyDistances, roadProjection } from './road-journeys';
import { spaceportPoint } from './spaceport-site';
import type { RoadWork } from './road-work';

/** Index only nearby centre lines; long segments retain an exact fallback. */
function* parallelIndex(roads: readonly Road[], distance: number) {
  const buckets = new Map<string, Road[]>(),
    long: Road[] = [];
  for (const r of roads) {
    yield;
    const x0 = Math.floor((Math.min(r.a.x, r.b.x) - distance) / 64),
      x1 = Math.floor((Math.max(r.a.x, r.b.x) + distance) / 64),
      z0 = Math.floor((Math.min(r.a.z, r.b.z) - distance) / 64),
      z1 = Math.floor((Math.max(r.a.z, r.b.z) + distance) / 64);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 256) {
      long.push(r);
      continue;
    }
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const key = `${x}:${z}`,
          rows = buckets.get(key) ?? [];
        rows.push(r);
        buckets.set(key, rows);
      }
  }
  return function* near(p: Point): RoadWork<boolean> {
    for (const group of [
      long,
      buckets.get(`${Math.floor(p.x / 64)}:${Math.floor(p.z / 64)}`) ?? [],
    ])
      for (const r of group) {
        yield;
        if (pointDistance(p, roadProjection(r, p)) <= distance) return true;
      }
    return false;
  };
}

/** Optional links run only after required connections and property access. */
export function* planAlternateRoadSteps(w: World): RoadWork<RoadProject | undefined> {
  const rules = roadRules(w.settings);
  if (!rules.roadAlternateRoutes) return;
  const roads = townRoads(w);
  if (!roads.length) return;
  const site = roadSite(w),
    anchors: Point[] = [];
  const destinations: Point[] = [...w.towns];
  if (w.spaceportSite) destinations.push(spaceportPoint(w.spaceportSite, 0, w.spaceportSite.fence));
  for (const destination of destinations) {
    const p = yield* safeNearestSteps(roads, destination, site);
    if (p && !anchors.some((a) => pointDistance(a, p) < 1)) anchors.push(p);
  }
  if (anchors.length < 2) return;
  const graph = yield* roadJourneyGraphSteps(roads, anchors);
  const near = yield* parallelIndex(roads, rules.roadAlternateParallelDistance);
  const candidates: { a: Point; b: Point; old: number; upper: number; order: number }[] = [];
  const useful = (old: number, length: number) =>
    Number.isFinite(old) &&
    old - length > 1e-6 &&
    old - length >= rules.roadAlternateSavingMetres &&
    (old - length) / old >= rules.roadAlternateSavingFraction;
  for (let i = 0; i < anchors.length - 1; i++) {
    const distances = yield* roadJourneyDistances(graph, graph.anchors[i]);
    for (let j = i + 1; j < anchors.length; j++) {
      yield;
      const a = anchors[i],
        b = anchors[j],
        old = distances[graph.anchors[j]],
        direct = pointDistance(a, b);
      if (useful(old, direct))
        candidates.push({ a, b, old, upper: (old - direct) / direct, order: candidates.length });
    }
  }
  // Terrain can only lengthen the straight-line proposal. After validating a
  // winner, lower upper bounds cannot beat it and need no terrain survey.
  candidates.sort((a, b) => b.upper - a.upper || a.order - b.order);
  let best: RoadProject | undefined,
    score = 0,
    bestOrder = Infinity;
  for (const { a, b, old, upper, order } of candidates) {
    yield;
    if (upper < score) break;
    const path = yield* roadRouteSteps(w, a, b);
    if (!path) continue;
    const length = path.slice(1).reduce((sum, p, k) => sum + pointDistance(path[k], p), 0);
    if (!useful(old, length)) continue;
    let parallel = 0;
    for (let k = 1; k < path.length; k++) {
      const from = path[k - 1],
        to = path[k],
        distance = pointDistance(from, to),
        samples = Math.max(1, Math.ceil(distance / 4));
      for (let n = 0; n < samples; n++) {
        yield;
        const t = (n + 0.5) / samples,
          p = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
        // A lane-width at either endpoint is the ordinary junction, not a duplicate lane.
        if (pointDistance(p, a) < rules.roadWidth || pointDistance(p, b) < rules.roadWidth)
          continue;
        if (yield* near(p)) parallel += distance / samples;
      }
    }
    if (parallel / length > rules.roadAlternateParallelFraction) continue;
    const benefit = (old - length) / length;
    if (benefit > score || (benefit === score && order < bestOrder)) {
      bestOrder = order;
      score = benefit;
      best = {
        kind: 'alternate',
        width: rules.roadWidth,
        path,
        alternatePolicy: roadAlternatePolicy(w.settings),
      };
    }
  }
  return best;
}

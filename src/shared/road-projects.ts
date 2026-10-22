// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { townRoads, roadDistance, roadKey, type Point, type Road } from './town.ts';
import {
  pointDistance,
  roadComponents,
  roadSamples,
  roadSite,
  roadRoute,
  roadsTouch,
} from './road-routing.ts';

export interface RoadProject {
  kind: 'town' | 'detour' | 'building';
  town?: string;
  building?: string;
  width: number;
  path: Point[];
  /** Additional branches reconnect every exit of a blocked junction. */
  branches?: Point[][];
  retire?: string[];
}
export function safeNearest(
  roads: readonly Road[],
  goal: Point,
  site: ReturnType<typeof roadSite>,
) {
  let best: Point | undefined,
    distance = Infinity;
  for (const r of roads) {
    const dx = r.b.x - r.a.x,
      dz = r.b.z - r.a.z,
      len = dx * dx + dz * dz;
    const t = len
      ? Math.max(0, Math.min(1, ((goal.x - r.a.x) * dx + (goal.z - r.a.z) * dz) / len))
      : 0;
    const projected = { x: r.a.x + t * dx, z: r.a.z + t * dz };
    for (const p of [projected, ...roadSamples(r, 4)]) {
      const d = pointDistance(p, goal);
      if (d < distance && site.clear(p)) {
        best = p;
        distance = d;
      }
    }
  }
  return best;
}
/** A private lane beside a remote town is not a connection to the original town.
 * Compare road components, then join the closest disconnected settlement. */
export function planTownRoad(w: World): RoadProject | undefined {
  if (w.towns.length < 2) return;
  const roads = townRoads(w);
  if (!roads.length) return;
  const groups = roadComponents(roads);
  const origin = w.towns[0];
  groups.sort((a, b) => roadDistance(a, origin.x, origin.z) - roadDistance(b, origin.x, origin.z));
  const main = groups[0],
    site = roadSite(w);
  const towns = w.towns
    .slice(1)
    .filter((t) => roadDistance(main, t.x, t.z) > 24)
    .sort((a, b) => roadDistance(main, a.x, a.z) - roadDistance(main, b.x, b.z));
  for (const town of towns) {
    if (!town.permissions.residents.roads && !town.permissions.guests.roads) continue;
    const local = groups.slice(1).find((g) => roadDistance(g, town.x, town.z) <= 24);
    const near = safeNearest(main, town, site);
    if (!near) continue;
    const heading = Math.atan2(near.x - town.x, near.z - town.z);
    const entries = local
      ? [safeNearest(local, near, site)].filter((p): p is Point => !!p)
      : [12, 20].flatMap((radius) =>
          [0, 0.5, -0.5, 1, -1, Math.PI].map((turn) => ({
            x: town.x + Math.sin(heading + turn) * radius,
            z: town.z + Math.cos(heading + turn) * radius,
          })),
        );
    for (const goal of entries) {
      if (!site.clear(goal)) continue;
      const start = safeNearest(main, goal, site);
      if (!start) continue;
      const path = roadRoute(w, start, goal);
      if (path) return { kind: 'town', town: town.id, width: 5, path };
    }
  }
}

/** A bypass replaces obstructed stretches only after every branch is complete.
 * Adjacent blocked segments are one job, so a building straddling several old
 * segments cannot leave tiny road fragments running through its walls. */
export function planRoadDetour(w: World): RoadProject | undefined {
  const roads = townRoads(w);
  const sites = new Map<number, ReturnType<typeof roadSite>>();
  const siteFor = (width: number) => {
    if (!sites.has(width)) sites.set(width, roadSite(w, width));
    return sites.get(width)!;
  };
  const blocked = roads.filter((r) => roadSamples(r).some((p) => siteFor(r.width).occupied(p)));
  for (const group of roadComponents(blocked)) {
    const width = Math.max(5, ...group.map((r) => r.width));
    const site = siteFor(width);
    // Include short neighbouring pieces whose junction remains inside the wider
    // bypass clearance, until the two ends really are clear of the obstacle.
    const removed = new Set(group);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of roads)
        if (
          !removed.has(r) &&
          [...removed].some((o) => roadsTouch(o, r)) &&
          [r.a, r.b].some((p) => site.occupied(p))
        ) {
          removed.add(r);
          changed = true;
        }
    }
    const exits: Point[] = [];
    for (const r of removed)
      for (const p of [r.a, r.b])
        if (site.clear(p) && !exits.some((q) => pointDistance(p, q) < 1)) exits.push(p);
    if (exits.length < 2) continue;
    // Join exits as a small tree rather than making a loop around each building.
    const connected = [exits.shift()!],
      paths: Point[][] = [];
    while (exits.length) {
      let best: { i: number; from: Point; distance: number } | undefined;
      for (let i = 0; i < exits.length; i++)
        for (const from of connected) {
          const distance = pointDistance(from, exits[i]);
          if (!best || distance < best.distance) best = { i, from, distance };
        }
      const to = exits.splice(best!.i, 1)[0];
      const path = roadRoute(w, best!.from, to, width);
      if (!path) {
        paths.length = 0;
        break;
      }
      paths.push(path);
      connected.push(to);
    }
    if (paths.length)
      return {
        kind: 'detour',
        width,
        path: paths[0],
        branches: paths.slice(1),
        retire: [...removed].map(roadKey),
      };
  }
}

/** Spend at most the existing 12 m/day budget, with town crews working from
 * both ends. Remaining waypoints persist across saves and restarts. */
export function advanceRoadProject(w: World, project: RoadProject, budget: number) {
  const site = roadSite(w, project.width);
  if (project.kind === 'town' && !w.towns.some((t) => t.id === project.town)) return false;
  // An edited building/field or changed permission invalidates the route. Keep
  // already laid roads, discard the plan and find a new safe route next day.
  if (
    [project.path, ...(project.branches ?? [])].some((path) =>
      path.slice(1).some((b, i) => !site.segment(path[i], b)),
    )
  )
    return false;
  const lay = (allowance: number, reverse = false) => {
    if (reverse) project.path.reverse();
    while (allowance > 1e-6 && project.path.length > 1) {
      const [a, b] = project.path,
        length = pointDistance(a, b);
      if (length < 1e-6) {
        project.path.shift();
        continue;
      }
      const step = Math.min(length, allowance),
        t = step / length;
      const to = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      const roads = (w.roads ??= []);
      // Keep long country roads compact: extend a collinear tip instead of
      // adding two more tiny segments every day. Never revive a retired lane.
      const retired = new Set(w.retiredRoads ?? []);
      const extend =
        project.kind === 'town' &&
        roads.find((r) => {
          if (r.width !== project.width || retired.has(roadKey(r))) return false;
          const atA = pointDistance(r.a, a) < 1e-6;
          const atB = pointDistance(r.b, a) < 1e-6;
          if (!atA && !atB) return false;
          const other = atA ? r.b : r.a;
          const dx = a.x - other.x,
            dz = a.z - other.z;
          const ex = to.x - a.x,
            ez = to.z - a.z;
          return (
            dx * ex + dz * ez > 0 && Math.abs(dx * ez - dz * ex) < 1e-6 * Math.hypot(dx, dz) * step
          );
        });
      if (extend) {
        if (pointDistance(extend.a, a) < 1e-6) extend.a = to;
        else extend.b = to;
      } else roads.push({ a: { ...a }, b: to, width: project.width });
      if (step === length) project.path.shift();
      else project.path[0] = to;
      allowance -= step;
      w.revision++;
    }
    if (reverse) project.path.reverse();
  };
  if (project.kind === 'town') {
    lay(budget / 2);
    lay(budget / 2, true);
  } else lay(budget);
  if (project.path.length > 1) return true;
  if (project.branches?.length) {
    project.path = project.branches.shift()!;
    return true;
  }
  if (project.retire?.length) {
    w.retiredRoads = [...new Set([...(w.retiredRoads ?? []), ...project.retire])];
    w.revision++;
  }
  return false;
}

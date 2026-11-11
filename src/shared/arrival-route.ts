// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { buildingPlan } from './building-shapes';
import { parkingRules } from './parking-rules';
import { travelHeight } from './dock';
import type { Point } from './town';

export type WalkPoint = Point & { y: number };
type Wall = { x: number; z: number; hx: number; hz: number; c: number; s: number };
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
function local(r: Wall, p: Point) {
  return { x: (p.x - r.x) * r.c - (p.z - r.z) * r.s, z: (p.x - r.x) * r.s + (p.z - r.z) * r.c };
}
function inside(r: Wall, p: Point) {
  const v = local(r, p);
  return Math.abs(v.x) < r.hx - 1e-7 && Math.abs(v.z) < r.hz - 1e-7;
}
/** Continuous slab test: sampling alone can miss a thin wall or clipped corner.
 * Boundary travel is allowed; nodes already include the pedestrian clearance. */
function crosses(r: Wall, a: Point, b: Point) {
  const p = local(r, a),
    q = local(r, b);
  let low = 0,
    high = 1;
  for (const [v, delta, half] of [
    [p.x, q.x - p.x, r.hx - 1e-7],
    [p.z, q.z - p.z, r.hz - 1e-7],
  ]) {
    if (Math.abs(delta) < 1e-10) {
      if (Math.abs(v) >= half) return false;
    } else {
      const t1 = (-half - v) / delta,
        t2 = (half - v) / delta;
      low = Math.max(low, Math.min(t1, t2));
      high = Math.min(high, Math.max(t1, t2));
      if (high <= low) return false;
    }
  }
  return high > low;
}

/** A small visibility graph built once on interaction, never in the render loop.
 * Follow actual rotated volumes, so inset doors and multi-wing premises work. */
export function arrivalRoute(
  w: World,
  building: Building,
  from: WalkPoint,
  to: WalkPoint,
  entering = false,
): WalkPoint[] {
  const clearance = parkingRules(w.settings).arrivalWallClearance;
  // Keep the last short step normal to the doorway, where the character is
  // deliberately allowed to enter its own wall-clearance band (not a wall).
  const goal = entering
    ? {
        x: to.x + Math.sin(building.rotation) * clearance,
        z: to.z + Math.cos(building.rotation) * clearance,
      }
    : to;
  const walls: Wall[] = [],
    raw: Wall[] = [];
  const reach = parkingRules(w.settings).arrivalRange + parkingRules(w.settings).parkingSearchRange;
  for (const b of w.buildings) {
    const plan = buildingPlan(b),
      c = Math.cos(b.rotation),
      s = Math.sin(b.rotation);
    for (const v of [...plan.volumes, ...(plan.fixtures ?? [])]) {
      if (v.eaves + v.rise <= 0) continue;
      const r = {
        x: b.x + v.x * c + v.z * s,
        z: b.z - v.x * s + v.z * c,
        hx: v.width / 2,
        hz: v.depth / 2,
        c,
        s,
      };
      if (
        distance(r, from) > reach + Math.hypot(r.hx, r.hz) &&
        distance(r, to) > reach + Math.hypot(r.hx, r.hz)
      )
        continue;
      raw.push(r);
      walls.push({ ...r, hx: r.hx + clearance, hz: r.hz + clearance });
    }
  }
  const fail = () => {
    throw Error('No clear walking route to the door; move around the obstruction');
  };
  if (
    raw.some((r) => inside(r, from) || inside(r, to)) ||
    (entering && raw.some((r) => crosses(r, goal, to)))
  )
    return fail();
  // A pedestrian may start against a wall within the clearance band, or cancel
  // at the threshold. Allow only outward escape from that band, never a wall.
  const clear = (a: Point, b: Point) =>
    !walls.some((r) => {
      if (!crosses(r, a, b)) return false;
      if (a === from && inside(r, a) && !inside(r, b)) {
        const bare = { ...r, hx: r.hx - clearance, hz: r.hz - clearance };
        return crosses(bare, a, b);
      }
      return true;
    });
  const nodes: Point[] = [from, goal];
  for (const r of walls)
    for (const x of [-r.hx, r.hx])
      for (const z of [-r.hz, r.hz]) {
        const p = { x: r.x + x * r.c + z * r.s, z: r.z - x * r.s + z * r.c };
        if (!walls.some((wall) => inside(wall, p))) nodes.push(p);
      }
  const cost = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    done = new Set<number>();
  cost[0] = 0;
  while (true) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!done.has(i) && (current < 0 || cost[i] < cost[current])) current = i;
    if (current < 0 || !Number.isFinite(cost[current])) return fail();
    if (current === 1) break;
    done.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (done.has(i)) continue;
      const next = cost[current] + distance(nodes[current], nodes[i]);
      if (next < cost[i] && clear(nodes[current], nodes[i])) {
        cost[i] = next;
        previous[i] = current;
      }
    }
  }
  const route: Point[] = [];
  for (let i = 1; i >= 0; i = previous[i]) route.unshift(nodes[i]);
  const points = route.map((p, i) => (i === 0 ? from : { ...p, y: travelHeight(w, p.x, p.z) }));
  if (entering && distance(goal, to) > 1e-8) points.push(to);
  else points[points.length - 1] = to;
  return points;
}
export function arrivalPathLength(path: readonly Point[]) {
  return path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
}
export function arrivalPathPose(
  path: readonly WalkPoint[],
  fraction: number,
  fallbackHeading: number,
) {
  let left = arrivalPathLength(path) * Math.max(0, Math.min(1, fraction));
  let lastHeading = fallbackHeading;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      length = distance(a, b);
    if (length < 1e-8) continue;
    lastHeading = Math.atan2(b.x - a.x, b.z - a.z);
    if (left <= length || i === path.length - 1) {
      const f = Math.min(1, left / length);
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        z: a.z + (b.z - a.z) * f,
        heading: lastHeading,
      };
    }
    left -= length;
  }
  return { ...path[path.length - 1], heading: lastHeading };
}

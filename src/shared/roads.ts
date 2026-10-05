// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building } from './types.ts';
import { townRoads, roadDistance, type Point, type Road } from './town.ts';
import { buildingPlan, buildingBounds, blocksBuilding } from './building-shapes.ts';
import { terrainHeight } from './terrain.ts';

/** A tractor is about 4.6 m long; the parish lays a little under three a day. */
export const roadGrowthPerDay = 12;
export const grownRoadWidth = 5;

export function grownRoads(w: Pick<World, 'roads'>): readonly Road[] {
  return w.roads ?? [];
}
function footprintRadius(b: Building) {
  const bounds = buildingBounds(buildingPlan(b));
  return Math.max(bounds.width, bounds.depth) / 2;
}
/** Starter lots sit up to ~10 m from a lane edge; larger footprints get a wider reach. */
export function roadConnected(w: World, b: Building, roads: readonly Road[] = townRoads(w)) {
  return roadDistance(roads, b.x, b.z) <= Math.max(12, footprintRadius(b) + 4);
}
function nearestPoint(roads: readonly Road[], x: number, z: number): Point | undefined {
  let best: Point | undefined,
    closest = Infinity;
  for (const { a, b } of roads) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = dx * dx + dz * dz;
    const t = len ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len)) : 0;
    const p = { x: a.x + dx * t, z: a.z + dz * t },
      d = Math.hypot(x - p.x, z - p.z);
    if (d < closest) {
      closest = d;
      best = p;
    }
  }
  return best;
}
function clear(w: World, a: Point, b: Point, target: Building) {
  for (const t of [0.25, 0.5, 0.75, 1]) {
    const x = a.x + (b.x - a.x) * t,
      z = a.z + (b.z - a.z) * t;
    if (terrainHeight(w, x, z) <= w.settings.seaLevel + 0.5) return false;
    for (const other of w.buildings)
      if (blocksBuilding(other, x, z, 0, grownRoadWidth / 2 + 1)) return false;
  }
  // Stop short of the destination's walls rather than paving its doorstep.
  return !blocksBuilding(target, b.x, b.z, 0, grownRoadWidth / 2 + 1);
}
/** Lay one day's stretch toward the unconnected building nearest the network. */
function growOnce(w: World) {
  const roads = townRoads(w);
  if (!roads.length) return false;
  const pending = w.buildings
    .filter((b) => !roadConnected(w, b, roads))
    .sort((a, b) => roadDistance(roads, a.x, a.z) - roadDistance(roads, b.x, b.z));
  for (const target of pending) {
    const from = nearestPoint(roads, target.x, target.z);
    if (!from) continue;
    const dx = target.x - from.x,
      dz = target.z - from.z,
      gap = Math.hypot(dx, dz),
      stop = Math.max(10, footprintRadius(target) + 3);
    const step = Math.min(roadGrowthPerDay, Math.max(1, gap - stop));
    const heading = Math.atan2(dx, dz);
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      const angle = heading + turn;
      const to = { x: from.x + Math.sin(angle) * step, z: from.z + Math.cos(angle) * step };
      if (!clear(w, from, to, target)) continue;
      // Don't double back onto the network: a detour must still make progress or hold ground.
      if (turn && roadDistance(roads, to.x, to.z) < -grownRoadWidth) continue;
      (w.roads ??= []).push({ a: from, b: to, width: grownRoadWidth });
      w.revision++;
      return true;
    }
  }
  return false;
}
/** Each game-day boundary crossed since the last checkpoint lays one stretch, so an
 * outage catches up deterministically instead of racing or skipping work. */
export function growRoads(w: World, start: number, end: number) {
  const dayLength = w.settings.dayLength > 0 ? w.settings.dayLength : 600;
  const last = w.roadGrowth ?? Math.floor(start / dayLength);
  const due = Math.floor(end / dayLength);
  if (due <= last) {
    w.roadGrowth ??= last;
    return;
  }
  for (let d = last + 1; d <= due; d++) growOnce(w);
  w.roadGrowth = due;
}

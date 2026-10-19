// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { roadConditions } from './environment.ts';
import { roadDistance, townRoads } from './town.ts';
import { travelHeight } from './dock.ts';

/** Rise/run along the tractor's forward axis, sampled across its wheelbase.
 * Support height includes the fishing dock, so its seabed is not a driving slope. */
export function drivingGrade(w: World, x: number, z: number, heading: number) {
  const dx = Math.sin(heading) * 2,
    dz = Math.cos(heading) * 2;
  return (travelHeight(w, x + dx, z + dz) - travelHeight(w, x - dx, z - dz)) / 4;
}
/** Positive grade is uphill. Keep a usable climbing speed and a bounded descent
 * bonus; this is controllable tractor handling rather than unbounded gravity. */
export function slopeSpeed(grade: number) {
  return grade >= 0 ? Math.max(0.45, 1 / (1 + grade * 2.5)) : Math.min(1.3, 1 - grade);
}

/** Roads retain their existing weather-limited speed. Soft ground adds rolling
 * resistance, blending over the two-metre verge instead of snapping at the edge.
 * Saved wetness/snow keep the effect through showers, thaw and reconnects. */
export function drivingSurface(w: World, x: number, z: number) {
  const conditions = roadConditions(w);
  const distance = roadDistance(townRoads(w), x, z);
  const t = Math.max(0, Math.min(1, distance / 2));
  const offRoad = t * t * (3 - 2 * t);
  const snow = Math.max(0, Math.min(1, w.climate?.snow ?? 0));
  const wet = Math.max(0, Math.min(1, w.climate?.wetness ?? 0));
  return {
    speed: conditions.speed * (1 - offRoad * (0.1 + wet * 0.1 + snow * 0.3)),
    grip: conditions.grip,
  };
}

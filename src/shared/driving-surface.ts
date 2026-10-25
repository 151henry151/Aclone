// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { roadConditions, snowDepth, WINTER_BASE_SNOW } from './environment.ts';
import { roadSurfaceDistance, townRoads } from './town.ts';
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

/** Smooth transition across the verge. Ordinary 4 cm snow permits 40% of dry
 * road speed (formerly ~20–33%); a metre permits ~10%, with a 6% crawl floor. */
export function drivingSurface(w: World, x: number, z: number) {
  const conditions = roadConditions(w);
  const distance = roadSurfaceDistance(w, townRoads(w), x, z);
  const t = Math.max(0, Math.min(1, distance / 2));
  const offRoad = t * t * (3 - 2 * t);
  const depth = snowDepth(w.climate),
    cover = Math.min(1, depth / WINTER_BASE_SNOW);
  const wet = Math.max(0, Math.min(1, w.climate?.wetness ?? 0));
  const bareSpeed = conditions.speed * (0.9 - wet * 0.1);
  const snowSpeed = 0.06 + 0.34 / (1 + Math.max(0, depth - WINTER_BASE_SNOW) * 7);
  const fieldSpeed = bareSpeed * (1 - cover) + snowSpeed * cover;
  const fieldGrip = conditions.grip * (1 - cover * 0.25);
  return {
    speed: conditions.speed + (fieldSpeed - conditions.speed) * offRoad,
    grip: conditions.grip + (fieldGrip - conditions.grip) * offRoad,
  };
}

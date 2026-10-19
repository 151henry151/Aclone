// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { roadConditions } from './environment.ts';
import { roadDistance, townRoads } from './town.ts';

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

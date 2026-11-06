import { nearestWaterSite } from './water-sites';
import { oceanConnected } from './ocean-connection';
import { waterSourceRules } from './water-source-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import { terrainHeight, mapHalf } from './terrain.ts';
import type { World } from './types.ts';
import type { Point } from './town.ts';
import { highWater, lowWater } from './ocean';

/** The pump house stays dry; its buried intake reaches water behind the building.
 * Check the real, editable terrain; new sites must work at both tidal extremes.
 * Existing installations retain their mean-water intake survey. */
export function waterworksSite(w: World, p: Point, rotation?: number, newSite = false) {
  const rules = waterSourceRules(w.settings);
  const edge = mapHalf(w) - rules.desalinationIntakeMaxReach;
  const dryLevel = newSite ? highWater(w) : w.settings.seaLevel;
  const wetLevel = newSite ? lowWater(w) : w.settings.seaLevel;
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > edge ||
    Math.abs(p.z) > edge
  )
    return undefined;
  if (terrainHeight(w, p.x, p.z) < dryLevel + rules.desalinationFreeboard) return undefined;
  const angles =
    rotation === undefined ? Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8) : [rotation];
  for (const angle of angles) {
    const sin = Math.sin(angle),
      cos = Math.cos(angle);
    // A nine-point foundation test prevents placing a half-submerged building.
    let dry = true;
    for (const x of [-4.4, 0, 4.4])
      for (const z of [-3.4, 0, 3.4])
        if (
          terrainHeight(w, p.x + x * cos + z * sin, p.z - x * sin + z * cos) <
          dryLevel + rules.desalinationFreeboard
        )
          dry = false;
    if (!dry) continue;
    for (const reach of [
      rules.desalinationIntakeMinReach,
      (rules.desalinationIntakeMinReach + rules.desalinationIntakeMaxReach) / 2,
      rules.desalinationIntakeMaxReach,
    ]) {
      const intake = { x: p.x - sin * reach, z: p.z - cos * reach };
      if (
        terrainHeight(w, intake.x, intake.z) <= wetLevel - rules.desalinationIntakeDepth &&
        (!newSite || !rules.desalinationRequiresOcean || oceanConnected(w, intake))
      )
        return { rotation: angle, intake };
    }
  }
  return undefined;
}

/** Compatibility for callers using the original desalination finder. */
export function nearestWaterworksSite(w: World, p: Point) {
  return nearestWaterSite(w, p, 'waterworks');
}

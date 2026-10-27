// SPDX-License-Identifier: GPL-3.0-or-later
import { constructionSiteReason } from './construction-site.ts';
import { terrainHeight, mapHalf } from './terrain.ts';
import type { World } from './types.ts';
import type { Point } from './town.ts';
import { highWater, lowWater } from './ocean';

/** The pump house stays dry; its buried intake reaches water behind the building.
 * Check the real, editable terrain; new sites must work at both tidal extremes.
 * Existing installations retain their mean-water intake survey. */
export function waterworksSite(w: World, p: Point, rotation?: number, newSite = false) {
  const edge = mapHalf(w) - 10;
  const dryLevel = newSite ? highWater(w) : w.settings.seaLevel;
  const wetLevel = newSite ? lowWater(w) : w.settings.seaLevel;
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > edge ||
    Math.abs(p.z) > edge
  )
    return undefined;
  if (terrainHeight(w, p.x, p.z) < dryLevel + 0.2) return undefined;
  const angles =
    rotation === undefined ? Array.from({ length: 16 }, (_, i) => (i * Math.PI) / 8) : [rotation];
  for (const angle of angles) {
    const sin = Math.sin(angle),
      cos = Math.cos(angle);
    // A nine-point foundation test prevents placing a half-submerged building.
    let dry = true;
    for (const x of [-4.4, 0, 4.4])
      for (const z of [-3.4, 0, 3.4])
        if (terrainHeight(w, p.x + x * cos + z * sin, p.z - x * sin + z * cos) < dryLevel + 0.2)
          dry = false;
    if (!dry) continue;
    for (const reach of [6, 8, 10]) {
      const intake = { x: p.x - sin * reach, z: p.z - cos * reach };
      if (terrainHeight(w, intake.x, intake.z) <= wetLevel - 0.3)
        return { rotation: angle, intake };
    }
  }
  return undefined;
}

// Only resurvey when terrain changes. Each resident then filters occupied/no-build
// lots and chooses the nearest one, rather than rescanning the entire coast.
const cache = new WeakMap<World, { key: string; sites: Point[] }>();
export function nearestWaterworksSite(w: World, p: Point) {
  const key = JSON.stringify([w.settings.seaLevel, w.settings.tidalRange, w.townLayout, w.terrain]);
  let entry = cache.get(w);
  if (!entry || entry.key !== key) {
    const sites: Point[] = [];
    for (let z = -224; z <= 224; z += 8)
      for (let x = -224; x <= 224; x += 16) {
        if (waterworksSite(w, { x, z }, undefined, true)) sites.push({ x, z });
      }
    entry = { key, sites };
    cache.set(w, entry);
  }
  return entry.sites
    .filter(
      (s) =>
        w.buildings.every((b) => Math.hypot(b.x - s.x, b.z - s.z) > 20) &&
        !w.zones.some((z) => z.kind === 'noBuild' && Math.hypot(z.x - s.x, z.z - s.z) < z.radius) &&
        !constructionSiteReason(w, {
          id: 'construction',
          kind: 'waterworks',
          ...s,
          rotation: waterworksSite(w, s, undefined, true)!.rotation,
        }),
    )
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
}

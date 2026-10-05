// SPDX-License-Identifier: GPL-3.0-or-later
import { terrainHeight, mapHalf } from './terrain.ts';
import type { World } from './types.ts';
import type { Point } from './town.ts';

/** The pump house stays dry; its buried intake reaches water behind the building.
 * Check the real, editable terrain and current sea level, never just a map edge. */
export function waterworksSite(w: World, p: Point, rotation?: number) {
  const edge = mapHalf(w) - 10;
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    Math.abs(p.x) > edge ||
    Math.abs(p.z) > edge
  )
    return undefined;
  if (terrainHeight(w, p.x, p.z) < w.settings.seaLevel + 0.2) return undefined;
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
          w.settings.seaLevel + 0.2
        )
          dry = false;
    if (!dry) continue;
    for (const reach of [6, 8, 10]) {
      const intake = { x: p.x - sin * reach, z: p.z - cos * reach };
      if (terrainHeight(w, intake.x, intake.z) <= w.settings.seaLevel - 0.3)
        return { rotation: angle, intake };
    }
  }
  return undefined;
}

// Only resurvey when terrain changes. Each resident then filters occupied/no-build
// lots and chooses the nearest one, rather than rescanning the entire coast.
const cache = new WeakMap<World, { key: string; sites: Point[] }>();
export function nearestWaterworksSite(w: World, p: Point) {
  const key = JSON.stringify([w.settings.seaLevel, w.townLayout, w.terrain]);
  let entry = cache.get(w);
  if (!entry || entry.key !== key) {
    const sites: Point[] = [];
    for (let z = -224; z <= 224; z += 8)
      for (let x = -224; x <= 224; x += 16) {
        if (waterworksSite(w, { x, z })) sites.push({ x, z });
      }
    entry = { key, sites };
    cache.set(w, entry);
  }
  return entry.sites
    .filter(
      (s) =>
        w.buildings.every((b) => Math.hypot(b.x - s.x, b.z - s.z) > 20) &&
        !w.zones.some((z) => z.kind === 'noBuild' && Math.hypot(z.x - s.x, z.z - s.z) < z.radius),
    )
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
}

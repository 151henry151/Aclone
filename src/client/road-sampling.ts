// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { roadDistance, roadSurfaceDistance, type Road } from '../shared/town';
/** Exact road-edge distance within reach; farther distances may be Infinity.
 * Build once per static scenery revision, never once per vertex or grass tuft. */
export function nearbyRoadDistance(roads: readonly Road[], reach: number) {
  // Long custom segments stay in a fallback list instead of allocating an
  // enormous diagonal bounding grid.
  const cells = new Map<string, Road[]>(),
    long: Road[] = [];
  for (const road of roads) {
    const pad = road.width / 2 + reach;
    const x0 = Math.floor((Math.min(road.a.x, road.b.x) - pad) / 64);
    const x1 = Math.floor((Math.max(road.a.x, road.b.x) + pad) / 64);
    const z0 = Math.floor((Math.min(road.a.z, road.b.z) - pad) / 64);
    const z1 = Math.floor((Math.max(road.a.z, road.b.z) + pad) / 64);
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > 256) {
      long.push(road);
      continue;
    }
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const key = i + ':' + j;
        const bucket = cells.get(key);
        if (bucket) bucket.push(road);
        else cells.set(key, [road]);
      }
  }
  return (x: number, z: number) =>
    Math.min(
      roadDistance(cells.get(Math.floor(x / 64) + ':' + Math.floor(z / 64)) ?? [], x, z),
      long.length ? roadDistance(long, x, z) : Infinity,
    );
}

/** Snow also clears the town square, runway and spaceport apron. */
export function nearbyRoadSurface(
  w: Pick<World, 'creator' | 'airfield' | 'spaceportSite'>,
  roads: readonly Road[],
  reach: number,
) {
  const distance = nearbyRoadDistance(roads, reach);
  return (x: number, z: number) => Math.min(distance(x, z), roadSurfaceDistance(w, [], x, z));
}

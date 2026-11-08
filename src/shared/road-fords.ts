import { finishRoadWork, roadGeometryKey, type RoadWork } from './road-work';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Point } from './town';
import type { roadSite } from './road-routing';
import { riverBanks } from './inland-water';
import { roadRules } from './road-rules';
export interface RoadFord {
  id: string;
  a: Point;
  b: Point;
}
const cache = new WeakMap<World, { key: string; fords: RoadFord[] }>();
/** Cache geometry, not river-centre proximity. Any relevant edit invalidates the survey. */
export function* roadFordSteps(
  w: World,
  site: ReturnType<typeof roadSite>,
  width: number,
): RoadWork<readonly RoadFord[]> {
  const rules = roadRules(w.settings);
  if (!rules.roadFords || !w.northernIsland) return [];
  const key = width + ':' + roadGeometryKey(w);
  const prior = cache.get(w);
  if (prior?.key === key) return prior.fords;
  const fords: RoadFord[] = [];
  for (const river of w.northernIsland.rivers) {
    const banks = riverBanks(river.points);
    let last: Point | undefined;
    for (let i = 0; i < river.points.length; i++) {
      yield;
      const p = river.points[i];
      if (p.depth > rules.groundWaterDepth || (last && Math.hypot(p.x - last.x, p.z - last.z) < 64))
        continue;
      const bank = banks[i],
        dx = (bank.right.x - bank.left.x) / p.width,
        dz = (bank.right.z - bank.left.z) / p.width;
      // Extend beyond the bank far enough for a vehicle and its lane verge.
      const reach = p.width / 2 + width * 3;
      for (const skew of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        const a = { x: p.x - (dx - skew * dz) * reach, z: p.z - (dz + skew * dx) * reach };
        const b = { x: p.x + (dx - skew * dz) * reach, z: p.z + (dz + skew * dx) * reach };
        if (site.clear(a) && site.clear(b) && (yield* site.segmentSteps(a, b))) {
          fords.push({ id: `${river.id}:${i}`, a, b });
          last = p;
          break;
        }
      }
    }
  }
  cache.set(w, { key, fords });
  return fords;
}

export function roadFords(w: World, site: ReturnType<typeof roadSite>, width: number) {
  return finishRoadWork(roadFordSteps(w, site, width));
}

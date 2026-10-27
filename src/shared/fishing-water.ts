import { waterLevel, lowWater } from './ocean';
// SPDX-License-Identifier: GPL-3.0-or-later
import { mapHalf, terrainHeight } from './terrain';
import type { World } from './types';

export const DEEP_FISHING_DEPTH = 8;
export const DEEP_FISHING_SHORE_DISTANCE = 150;
const GRID = 10;
interface CoastCache {
  worldId: string;
  townLayout: World['townLayout'];
  revision: number;
  landscape: World['landscape'];
  terrain: World['terrain'];
  terrainCount: number;
  sea: number;
  half: number;
  airfield: World['airfield'];
  cells: Map<string, boolean>;
  heights: Map<string, number>;
  grounds: Map<string, number>;
  terrainSize: number | undefined;
}
// Client snapshots replace World objects but retain unchanged terrain arrays.
const coastCache = new WeakMap<World['terrain'], CoastCache>();
/** Both rod and net fishing use the same offshore rule. Sample the whole disk,
 * not just a few rays (which miss islands). A conservative grid margin keeps
 * the accepted area beyond 150m; coastal boundaries are approximate to 10m.
 * Cache bounded spatial cells so moving/rendering never scans a coast per tick. */
export function deepFishingWater(w: World, p: { x: number; z: number }) {
  if (waterLevel(w) - terrainHeight(w, p.x, p.z) < DEEP_FISHING_DEPTH) return false;
  const half = mapHalf(w);
  if (Math.max(Math.abs(p.x), Math.abs(p.z)) > half) return false;
  let cache = coastCache.get(w.terrain);
  if (
    !cache ||
    cache.worldId !== w.id ||
    cache.townLayout !== w.townLayout ||
    cache.revision !== w.revision ||
    cache.landscape !== w.landscape ||
    cache.terrain !== w.terrain ||
    cache.terrainCount !== w.terrain.length ||
    cache.sea !== lowWater(w) ||
    cache.half !== half ||
    cache.terrainSize !== w.terrainMapSize ||
    cache.airfield !== w.airfield
  ) {
    cache = {
      worldId: w.id,
      townLayout: w.townLayout,
      revision: w.revision,
      landscape: w.landscape,
      terrain: w.terrain,
      terrainCount: w.terrain.length,
      sea: lowWater(w),
      half,
      airfield: w.airfield,
      cells: new Map(),
      heights: new Map(),
      grounds: new Map(),
      terrainSize: w.terrainMapSize,
    };
    coastCache.set(w.terrain, cache);
  }
  const cx = Math.floor(p.x / GRID),
    cz = Math.floor(p.z / GRID),
    key = `${cx},${cz}`;
  const known = cache.cells.get(key);
  if (known !== undefined) return known;
  const x = (cx + 0.5) * GRID,
    z = (cz + 0.5) * GRID;
  const radius = DEEP_FISHING_SHORE_DISTANCE + Math.SQRT2 * GRID;
  // Creator-made islets can be smaller than a grid cell. Check their summits
  // explicitly and conservatively include the brush footprint as coastline.
  let offshore = !w.terrain.some(
    (t) =>
      t.height > 0 &&
      Math.hypot(t.x - x, t.z - z) < radius + t.radius &&
      terrainHeight(w, t.x, t.z) >= lowWater(w),
  );
  for (let dx = -Math.ceil(radius / GRID); dx <= Math.ceil(radius / GRID) && offshore; dx++) {
    for (let dz = -Math.ceil(radius / GRID); dz <= Math.ceil(radius / GRID); dz++) {
      if (Math.hypot(dx * GRID, dz * GRID) > radius) continue;
      const sx = x + dx * GRID,
        sz = z + dz * GRID;
      if (Math.max(Math.abs(sx), Math.abs(sz)) > half) continue;
      const sampleKey = `${cx + dx},${cz + dz}`;
      let h = cache.heights.get(sampleKey);
      if (h === undefined) {
        h = terrainHeight(w, sx, sz);
        if (cache.heights.size >= 16384) cache.heights.clear();
        cache.heights.set(sampleKey, h);
      }
      if (h >= lowWater(w)) {
        offshore = false;
        break;
      }
    }
  }
  if (cache.cells.size >= 1024) cache.cells.clear();
  cache.cells.set(key, offshore);
  return offshore;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Server-side environmental suitability, never a player-facing fish finder.
 * Water sightlines distinguish an enclosed bay from ocean beyond headlands.
 * Bilinear interpolation avoids invisible zone boundaries. Edited terrain and
 * islands participate; out-of-world samples never create fictitious open sea. */
export function fishingGroundQuality(w: World, p: { x: number; z: number }) {
  if (!deepFishingWater(w, p)) return 0;
  const cache = coastCache.get(w.terrain)!;
  const cell = 100,
    cx = Math.floor(p.x / cell),
    cz = Math.floor(p.z / cell);
  const sample = (ix: number, iz: number) => {
    const key = `${ix},${iz}`;
    const known = cache.grounds.get(key);
    if (known !== undefined) return known;
    let sight = 0,
      nearest = 5000;
    for (let ray = 0; ray < 24; ray++) {
      const a = (ray * Math.PI * 2) / 24;
      let reach = 5000;
      for (let r = 250; r <= 5000; r += 250) {
        const x = ix * cell + Math.sin(a) * r,
          z = iz * cell + Math.cos(a) * r;
        if (
          Math.max(Math.abs(x), Math.abs(z)) > cache.half ||
          terrainHeight(w, x, z) >= cache.sea
        ) {
          reach = r - 125;
          break;
        }
      }
      nearest = Math.min(nearest, reach);
      sight += reach / (5000 * 24);
    }
    const quality = 0.65 * smooth(0.25, 0.9, sight) + 0.35 * smooth(150, 3000, nearest);
    if (cache.grounds.size >= 4096) cache.grounds.clear();
    cache.grounds.set(key, quality);
    return quality;
  };
  const x = p.x / cell - cx,
    z = p.z / cell - cz;
  return (
    (sample(cx, cz) * (1 - x) + sample(cx + 1, cz) * x) * (1 - z) +
    (sample(cx, cz + 1) * (1 - x) + sample(cx + 1, cz + 1) * x) * z
  );
}

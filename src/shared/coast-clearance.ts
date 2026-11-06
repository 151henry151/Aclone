// SPDX-License-Identifier: GPL-3.0-or-later
import { terrainHeight, mapHalf } from './terrain';
import { lowWater } from './ocean';
import type { World } from './types';
// Geometry resolution, not a gameplay threshold. Conservative clearance and
// conservative return distance deliberately bracket the sampled shoreline.
const GRID = 50,
  HALF_DIAGONAL = GRID / Math.SQRT2;
const caches = new WeakMap<
  World['terrain'],
  {
    key: string;
    landscape: World['landscape'];
    layout: World['townLayout'];
    airfield: World['airfield'];
    island: World['northernIsland'];
    cells: Map<string, { clearance: number; returnDistance: number }>;
    heights: Map<string, number>;
  }
>();
export function coastClearance(w: World, p: { x: number; z: number }) {
  const key = [w.id, w.revision, w.terrain.length, lowWater(w), mapHalf(w), w.terrainMapSize].join(
    ':',
  );
  let cache = caches.get(w.terrain);
  if (
    !cache ||
    cache.key !== key ||
    cache.landscape !== w.landscape ||
    cache.layout !== w.townLayout ||
    cache.airfield !== w.airfield ||
    cache.island !== w.northernIsland
  ) {
    cache = {
      key,
      landscape: w.landscape,
      layout: w.townLayout,
      airfield: w.airfield,
      island: w.northernIsland,
      cells: new Map(),
      heights: new Map(),
    };
    caches.set(w.terrain, cache);
  }
  const ix = Math.round(p.x / GRID),
    iz = Math.round(p.z / GRID),
    cell = `${ix},${iz}`,
    known = cache.cells.get(cell);
  if (known) return known;
  const x = ix * GRID,
    z = iz * GRID,
    sea = lowWater(w),
    half = mapHalf(w);
  let nearest = Infinity;
  const sample = (sx: number, sz: number) => {
    if (Math.max(Math.abs(sx), Math.abs(sz)) > half) return;
    const k = `${sx},${sz}`;
    let h = cache!.heights.get(k);
    if (h === undefined) {
      h = terrainHeight(w, sx, sz);
      if (cache!.heights.size >= 65536) cache!.heights.clear();
      cache!.heights.set(k, h);
    }
    if (h >= sea) nearest = Math.min(nearest, Math.hypot(sx - x, sz - z));
  };
  // Rings stop once no later sample can improve the nearest coast. Large ocean
  // distances use a coarser search, then refine the nearest candidate neighborhood.
  let coarsePoint: { x: number; z: number } | undefined;
  for (let r = 0; r <= 60 && r * GRID <= nearest + GRID; r++) {
    if (r === 0) {
      sample(x, z);
      continue;
    }
    for (let j = -r; j <= r; j++) {
      sample(x + j * GRID, z - r * GRID);
      sample(x + j * GRID, z + r * GRID);
      if (Math.abs(j) !== r) {
        sample(x - r * GRID, z + j * GRID);
        sample(x + r * GRID, z + j * GRID);
      }
    }
  }
  const coarse = 500;
  if (!Number.isFinite(nearest)) {
    for (let sx = -half; sx <= half; sx += coarse)
      for (let sz = -half; sz <= half; sz += coarse) {
        if (Math.hypot(sx - x, sz - z) >= nearest) continue;
        const before = nearest;
        sample(sx, sz);
        if (nearest < before) coarsePoint = { x: sx, z: sz };
      }
    if (coarsePoint)
      for (let dx = -coarse; dx <= coarse; dx += GRID)
        for (let dz = -coarse; dz <= coarse; dz += GRID)
          sample(coarsePoint.x + dx, coarsePoint.z + dz);
  }
  // Tiny authored islands cannot disappear between terrain grid samples.
  // A brush edge is only a conservative clearance bound, not dry ground.
  let clearance = nearest;
  for (const t of w.terrain)
    if (t.height > 0 && terrainHeight(w, t.x, t.z) >= sea) {
      const distance = Math.hypot(t.x - x, t.z - z);
      clearance = Math.min(clearance, Math.max(0, distance - t.radius));
      nearest = Math.min(nearest, distance);
    }
  const margin = HALF_DIAGONAL + (coarsePoint ? coarse : GRID);
  const value = { clearance: Math.max(0, clearance - margin), returnDistance: nearest + margin };
  if (cache.cells.size >= 512) cache.cells.clear();
  cache.cells.set(cell, value);
  return value;
}

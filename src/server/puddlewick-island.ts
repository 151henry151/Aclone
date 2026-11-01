// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import type { NorthernIsland } from '../shared/northern-island';
import { regionalResource } from '../shared/northern-island';
import { terrainHalf, terrainHeight, terrainSeed, landBounds } from '../shared/terrain';
import { worldResources, resourceNode } from '../shared/resources';
import { hash2 } from '../shared/noise';
import { inlandWaterAt } from '../shared/inland-water';
import { islandRivers } from './island-rivers';
import { isPublicPuddlewick } from '../shared/harbour-supply';

/** Deterministic geometry helpers also used by the release survey/preview. */
export function islandArea(w: World, step = 200) {
  const b = landBounds(w);
  let count = 0;
  for (let z = b.minZ + step / 2; z < b.maxZ; z += step)
    for (let x = b.minX + step / 2; x < b.maxX; x += step)
      if (terrainHeight(w, x, z) > w.settings.seaLevel) count++;
  return count * step * step;
}
function headlands(w: World, n: NorthernIsland) {
  const sea = w.settings.seaLevel;
  const add = (angle: number, width: number, index: number) => {
    // Search the actual generated waterline; not the nominal circle.
    let lo = n.radius * 0.78,
      hi = n.radius * 1.1;
    for (let i = 0; i < 20; i++) {
      const r = (lo + hi) / 2;
      if (terrainHeight(w, Math.cos(angle) * r, n.centreZ + Math.sin(angle) * r) > sea) lo = r;
      else hi = r;
    }
    const x = (Math.cos(angle) * (lo + hi)) / 2,
      z = n.centreZ + (Math.sin(angle) * (lo + hi)) / 2;
    if (
      z > n.blendZ - 800 ||
      n.rivers.some((r) => r.points.some((p) => Math.hypot(p.x - x, p.z - z) < width + 500))
    )
      return;
    if (w.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < width + 600)) return;
    w.coastalBluffs!.push({
      id: `natural-north-${index}`,
      x,
      z,
      angle: Math.PI / 2 - angle,
      width,
      inland: width > 300 ? 600 : 350,
      height: 35 + (index % 5) * 9,
      seed: (n.seed % 1000) + index,
    });
  };
  for (let i = 0; i < 24; i++) add((i * Math.PI * 2) / 24, 180 + (i % 3) * 35, i);
  // Two extended rocky coasts, with overlapping irregular shoulders and sea stacks.
  for (let coast = 0; coast < 2; coast++)
    for (let j = 0; j < 4; j++)
      add(-2.12 + coast * 2.6 + (j - 1.5) * 0.052, 650, 30 + coast * 4 + j);
}
function resources(w: World, n: NorthernIsland) {
  const b = landBounds(w),
    old = n.resources.slice(),
    additional: typeof old = [];
  const usable = (x: number, z: number) => {
    if (z >= n.preserveZ || inlandWaterAt(w, x, z)) return false;
    const heights = [
      [0, 0],
      [8, 0],
      [-8, 0],
      [0, 8],
      [0, -8],
    ].map(([dx, dz]) => terrainHeight(w, x + dx, z + dz));
    return (
      Math.min(...heights) > w.settings.seaLevel + 3 &&
      Math.max(...heights) - Math.min(...heights) < 5 &&
      !w.buildings.some((o) => Math.hypot(o.x - x, o.z - z) < 60)
    );
  };
  const centres: { x: number; z: number }[] = [];
  for (let iz = Math.ceil(b.minZ / 400); iz < b.maxZ / 400; iz++)
    for (let ix = Math.ceil(b.minX / 400); ix < b.maxX / 400; ix++) {
      if (hash2(ix, iz, n.seed + 101) > 0.42) continue;
      const x = Math.round((ix + 0.5) * 400 + (hash2(ix, iz, n.seed + 102) - 0.5) * 240);
      const z = Math.round((iz + 0.5) * 400 + (hash2(ix, iz, n.seed + 103) - 0.5) * 240);
      if (!usable(x, z) || old.some((o) => Math.hypot(o.x - x, o.z - z) < 140)) continue;
      const item = regionalResource(n, x, z, hash2(ix, iz, n.seed + 104));
      additional.push(resourceNode(`extra-north-${ix}-${iz}`, item, x, z));
      if (
        hash2(ix, iz, n.seed + 105) < 0.08 &&
        centres.every((c) => Math.hypot(c.x - x, c.z - z) > 1800)
      )
        centres.push({ x, z });
    }
  for (let c = 0; c < centres.length; c++)
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.39996,
        r = 50 + Math.sqrt(i / 16) * 150;
      const x = Math.round(centres[c].x + Math.cos(angle) * r),
        z = Math.round(centres[c].z + Math.sin(angle) * r);
      if (usable(x, z))
        additional.push(
          resourceNode(
            `extra-north-cluster-${c}-${i}`,
            regionalResource(n, x, z, hash2(c, i, n.seed + 106)),
            x,
            z,
          ),
        );
    }
  n.resources.push(...additional);
}
/** Add land only north of the towns. Existing land/resource coordinates, buildings,
 * sea settings, inventories and economic state are never rescaled or reset. */
export function expandPuddlewickIsland(w: World) {
  if (!isPublicPuddlewick(w) || w.northernIsland || w.landscape?.heightmap || terrainHalf(w) < 1000)
    return false;
  const oldResources = worldResources(w).map((p) => ({ ...p })),
    area = islandArea(w);
  const half = terrainHalf(w),
    seed = terrainSeed(w);
  w.terrainMapSize ??= half * 2;
  const n: NorthernIsland = {
    version: 1,
    seed,
    radius: Math.sqrt((area * 9) / Math.PI) / 0.965,
    centreZ: 0,
    preserveZ: -1200,
    blendZ: -3600,
    mountain: { x: 0, z: 0, height: 1350, radius: 3300 },
    regions: [],
    rivers: [],
    ponds: [],
    resources: oldResources,
    previousArea: area,
    area: 0,
  };
  w.northernIsland = n;
  // Calibrate against land area, not map side length (which would make 100x land).
  for (let i = 0; i < 3; i++) {
    n.centreZ = -n.radius + 500;
    n.mountain.z = n.centreZ;
    n.area = islandArea(w, 240);
    n.radius *= Math.sqrt((area * 10) / n.area);
  }
  n.centreZ = -n.radius + 500;
  n.mountain.z = n.centreZ;
  n.regions = [
    { x: -n.radius * 0.45, z: n.centreZ + 2500, radius: 5000, relief: 0.14, forest: 0.15 },
    { x: n.radius * 0.48, z: n.centreZ - 2500, radius: 4500, relief: 0.38, forest: 0.25 },
    { x: 0, z: n.centreZ - 6500, radius: 4000, relief: 1.55, forest: 0.85 },
    { x: -n.radius * 0.5, z: n.centreZ - 3500, radius: 4500, relief: 0.9, forest: 0.94 },
    { x: n.radius * 0.43, z: n.centreZ + 4500, radius: 4200, relief: 1.2, forest: 0.95 },
    { x: -1200, z: -half - 1500, radius: 3400, relief: 0.6, forest: 0.88 },
  ];
  n.rivers = islandRivers(n, w.settings.seaLevel);
  for (let i = 0; i < 80 && n.ponds.length < 18; i++) {
    const a = i * 2.39996,
      r = n.radius * (0.35 + 0.4 * hash2(i, 0, seed + 110));
    const x = Math.cos(a) * r,
      z = n.centreZ + Math.sin(a) * r;
    const rx = 45 + hash2(i, 1, seed + 110) * 100,
      rz = 35 + hash2(i, 2, seed + 110) * 85;
    if (
      z > n.blendZ ||
      n.rivers.some((r) => r.points.some((p) => Math.hypot(x - p.x, z - p.z) < 500))
    )
      continue;
    const ring = Array.from({ length: 16 }, (_, j) =>
      terrainHeight(
        w,
        x + Math.cos((j * Math.PI) / 8) * rx * 1.4,
        z + Math.sin((j * Math.PI) / 8) * rz * 1.4,
      ),
    );
    const low = Math.min(...ring),
      high = Math.max(...ring);
    if (low < w.settings.seaLevel + 12 || high - low > 25) continue;
    n.ponds.push({ id: `north-pond-${i}`, x, z, rx, rz, level: low - 0.6, depth: 2 + (i % 4) });
  }
  // Former northern sea cliffs become inland; retain all southern headlands and occupied ones.
  w.coastalBluffs = (w.coastalBluffs ?? []).filter(
    (b) =>
      b.z + b.width + b.inland + 55 >= n.preserveZ ||
      w.buildings.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < 700),
  );
  headlands(w, n);
  resources(w, n);
  n.area = islandArea(w);
  const extent = landBounds(w);
  w.settings.mapSize = Math.max(
    w.settings.mapSize,
    Math.ceil(((Math.max(-extent.minZ, extent.maxX) + 8000) * 2) / 1000) * 1000,
  );
  w.revision++;
  return true;
}

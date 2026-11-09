import { earthworksTerrain, blendEarthworks } from './earthworks-ground';
import { northernHeight, northernBlend, northernRegion } from './northern-island';
import { inlandGround, inlandWaterAt } from './inland-water';
import { minMapSize, maxMapSize } from './world-limits';
export { minMapSize, maxMapSize } from './world-limits';
import { spaceportGround } from './spaceport-site';
import { seabedHeight, seabedUnchanged } from './seabed';
import { bluffHeight, nearBluff, coastalRockCover } from './coastal-bluffs';
import { airfieldHeight } from './airfield';
import { heightmapAt } from './landscape.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { fbm, seedOf, smoothstep } from './noise.ts';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** The original 500 m parish square. Village terrain, lanes and gathering grounds live inside it. */
export const legacyHalf = 250;
/** Half the configured square map side in metres; older saves default to the legacy square. */
export function mapHalf(w: Pick<World, 'settings'>) {
  const size = w.settings.mapSize;
  return (Number.isFinite(size) && size >= minMapSize ? Math.min(maxMapSize, size) : 500) / 2;
}
/** Ocean expansions must never stretch the island, creator heightmaps or woodland. */
export function terrainHalf(w: World) {
  return Number.isFinite(w.terrainMapSize) && w.terrainMapSize! >= minMapSize
    ? Math.min(maxMapSize, w.terrainMapSize!) / 2
    : mapHalf(w);
}
/** Beyond this the village square gives way to the generated countryside. */
export const countrysideEdge = legacyHalf + 150;
let seedId: string | undefined,
  cachedSeed = 0;
export function terrainSeed(w: Pick<World, 'id' | 'northernIsland'>) {
  if (w.northernIsland?.seed != null) return w.northernIsland.seed;
  if (w.id !== seedId) {
    cachedSeed = seedOf(w.id);
    seedId = w.id;
  }
  return cachedSeed;
}
/** The hand-tuned village: a flat plateau, gentle surrounding hills and the harbour slope. */
function villageHeight(w: World, x: number, z: number) {
  const hills = Math.sin(x * 0.021) * Math.cos(z * 0.019) * 8 + Math.sin(x * 0.047 + z * 0.025) * 3;
  const plateau = w.townLayout === 2 ? 230 : 120;
  const flat = 1 - clamp((Math.max(Math.abs(x), Math.abs(z)) - plateau) / 80, 0, 1);
  let h = hills * (1 - flat) + 0.15;
  if (z > 140) h -= (z - 140) * 0.2;
  return h;
}
/** Generated land: a plain around the village rising into hills, the harbour inlet
 * running south to the open sea, and a coastline that sinks the whole map edge. */
function countrysideHeight(w: World, x: number, z: number, half: number) {
  const seed = terrainSeed(w),
    d = Math.hypot(x, z);
  const square = Math.max(Math.abs(x), Math.abs(z)) / half,
    radial = d / half,
    shoreNoise = fbm(x / 1500, z / 1500, 2, seed + 13) * 0.05;
  const coast = smoothstep(0.8 + shoreNoise, 0.93 + shoreNoise, square * 0.6 + radial * 0.4);
  // Full coastal replacement discards all hill noise. Preserve the partial
  // coastline arithmetic below so existing terrain heights stay identical.
  if (coast === 1) return -30;
  const relief = smoothstep(350, 1000, d);
  // Broad downs with smaller rolling shoulders, not high-frequency crags. Fewer
  // octaves keep slopes smooth and terrain sampling no dearer than before.
  const broad = fbm(x / 850, z / 850, 3, seed),
    detail = fbm(x / 260, z / 260, 2, seed + 7);
  // Smaller islands need lower hills so the descent to the sea remains gentle.
  const scale = Math.min(1, Math.max(0.15, (half - legacyHalf) / 2000));
  const inletWidth = 250 + Math.max(0, z - 150) * 0.5;
  // Bring hills down before the narrow harbour shore, rather than turning the
  // old 120m beach transition into a cliff beneath a 150m hill.
  const inletFoothills =
    1 - smoothstep(120, 400, z) * (1 - smoothstep(0, 550 * scale, Math.abs(x) - inletWidth));
  let h = 6 + scale * relief * inletFoothills * (95 * (broad + 0.8) + 22 * detail) + detail * 2;
  h = h * (1 - coast) - 30 * coast;
  if (z > 150) {
    const halfWidth = 250 + (z - 150) * 0.5;
    const inlet = 1 - smoothstep(halfWidth - 120, halfWidth + 40, Math.abs(x));
    h = Math.min(h, h * (1 - inlet) - 18 * inlet);
  }
  return h;
}
export function terrainHeight(w: World, x: number, z: number) {
  const half = terrainHalf(w);
  const local = w.earthworks?.length ? earthworksTerrain(w, x, z) : undefined;
  let h: number;
  if (typeof local === 'number') h = local;
  else {
    if (w.landscape?.heightmap) {
      // Authored heightmaps replace all procedural terrain, including river beds.
      h = heightmapAt(w.landscape.heightmap, x, z, half);
    } else {
      const blend =
        half > legacyHalf
          ? smoothstep(legacyHalf, countrysideEdge, Math.max(Math.abs(x), Math.abs(z)))
          : 0;
      // Do not evaluate a terrain layer whose blend weight is exactly zero.
      h = blend === 1 ? countrysideHeight(w, x, z, half) : villageHeight(w, x, z);
      if (blend > 0 && blend < 1) h = h * (1 - blend) + countrysideHeight(w, x, z, half) * blend;
      if (w.northernIsland && z < w.northernIsland.preserveZ) {
        const north = northernBlend(w.northernIsland, z);
        h += (Math.max(h, northernHeight(w.northernIsland, x, z, w.settings.seaLevel)) - h) * north;
        h = inlandGround(w, x, z, h);
      }
    }
    for (const t of w.terrain)
      h += t.height * Math.max(0, 1 - Math.hypot(x - t.x, z - t.z) / t.radius);
    if (local) h = blendEarthworks(local, x, z, h);
  }
  const surface = spaceportGround(
    w.spaceportSite,
    x,
    z,
    airfieldHeight(
      w.airfield,
      x,
      z,
      bluffHeight(w.coastalBluffs, x, z, h, w.settings.seaLevel),
      w.settings.runwayShoulder,
    ),
  );
  if (w.landscape?.heightmap || seabedUnchanged(surface, w.settings.seaLevel, half)) return surface;
  const blend = smoothstep(legacyHalf, countrysideEdge, Math.max(Math.abs(x), Math.abs(z)));
  return (
    surface +
    (seabedHeight(surface, w.settings.seaLevel, x, z, half, terrainSeed(w)) - surface) * blend
  );
}
/** Woodland cover 0..1 for the generated countryside: zero in the village, in the
 * water and on compact maps, which keep their hand-placed trees. */
export function woodland(w: World, x: number, z: number) {
  const half = terrainHalf(w);
  if (half <= legacyHalf) return 0;
  const outside = smoothstep(300, 450, Math.max(Math.abs(x), Math.abs(z)));
  if (outside <= 0) return 0;
  const h = terrainHeight(w, x, z);
  if (
    nearBluff(w, x, z) &&
    Math.max(
      Math.abs(terrainHeight(w, x + 2, z) - terrainHeight(w, x - 2, z)),
      Math.abs(terrainHeight(w, x, z + 2) - terrainHeight(w, x, z - 2)),
    ) > 5
  )
    return 0;
  if (h < w.settings.seaLevel + 1 || coastalRockCover(w.coastalBluffs, x, z) > 0) return 0;
  const seed = terrainSeed(w);
  if (inlandWaterAt(w, x, z)) return 0;
  const regional = w.northernIsland
    ? northernRegion(w.northernIsland, x, z).forest * northernBlend(w.northernIsland, z)
    : 0;
  const cover = Math.max(regional, smoothstep(0.08, 0.5, fbm(x / 420, z / 420, 3, seed + 29)));
  const shore = smoothstep(w.settings.seaLevel + 1, w.settings.seaLevel + 4, h);
  const treeline =
    w.northernIsland && z < w.northernIsland.preserveZ ? 1 - smoothstep(850, 1150, h) : 1;
  return clamp(cover * outside * shore * treeline, 0, 1);
}

/** Geographic land bounds; ocean travel bounds and the original terrain seed stay independent. */
export function landBounds(w: World) {
  const half = terrainHalf(w),
    n = w.northernIsland;
  return n
    ? {
        minX: Math.min(-half, -n.radius * 1.08),
        maxX: Math.max(half, n.radius * 1.08),
        minZ: Math.min(-half, n.centreZ - n.radius * 1.08),
        maxZ: half,
      }
    : { minX: -half, maxX: half, minZ: -half, maxZ: half };
}

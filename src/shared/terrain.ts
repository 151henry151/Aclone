import { heightmapAt } from './landscape.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { fbm, seedOf, smoothstep } from './noise.ts';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** The original 500 m parish square. Village terrain, lanes and gathering grounds live inside it. */
export const legacyHalf = 250;
export const minMapSize = 500,
  maxMapSize = 20000;
/** Half the configured square map side in metres; older saves default to the legacy square. */
export function mapHalf(w: Pick<World, 'settings'>) {
  const size = w.settings.mapSize;
  return (Number.isFinite(size) && size >= minMapSize ? Math.min(maxMapSize, size) : 500) / 2;
}
/** Beyond this the village square gives way to the generated countryside. */
export const countrysideEdge = legacyHalf + 150;
export const terrainSeed = (w: Pick<World, 'id'>) => seedOf(w.id);
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
  const relief = smoothstep(350, 1400, d);
  const broad = fbm(x / 900, z / 900, 4, seed),
    detail = fbm(x / 170, z / 170, 3, seed + 7);
  let h = 6 + 40 * relief * (broad + 0.35) + detail * 5 * (0.25 + 0.75 * relief);
  const square = Math.max(Math.abs(x), Math.abs(z)) / half,
    radial = d / half,
    shoreNoise = fbm(x / 1500, z / 1500, 2, seed + 13) * 0.05;
  const coast = smoothstep(0.8 + shoreNoise, 0.93 + shoreNoise, square * 0.6 + radial * 0.4);
  h = h * (1 - coast) - 30 * coast;
  if (z > 150) {
    const halfWidth = 250 + (z - 150) * 0.5;
    const inlet = 1 - smoothstep(halfWidth - 120, halfWidth + 40, Math.abs(x));
    h = Math.min(h, h * (1 - inlet) - 18 * inlet);
  }
  return h;
}
export function terrainHeight(w: World, x: number, z: number) {
  const half = mapHalf(w);
  let h = villageHeight(w, x, z);
  if (half > legacyHalf) {
    const s = smoothstep(legacyHalf, countrysideEdge, Math.max(Math.abs(x), Math.abs(z)));
    if (s > 0) h = h * (1 - s) + countrysideHeight(w, x, z, half) * s;
  }
  if (w.landscape?.heightmap) h = heightmapAt(w.landscape.heightmap, x, z, half);
  for (const t of w.terrain)
    h += t.height * Math.max(0, 1 - Math.hypot(x - t.x, z - t.z) / t.radius);
  return h;
}
/** Woodland cover 0..1 for the generated countryside: zero in the village, in the
 * water and on compact maps, which keep their hand-placed trees. */
export function woodland(w: World, x: number, z: number) {
  const half = mapHalf(w);
  if (half <= legacyHalf) return 0;
  const outside = smoothstep(300, 450, Math.max(Math.abs(x), Math.abs(z)));
  if (outside <= 0) return 0;
  const h = terrainHeight(w, x, z);
  if (h < w.settings.seaLevel + 1) return 0;
  const seed = terrainSeed(w);
  const cover = smoothstep(0.08, 0.5, fbm(x / 420, z / 420, 3, seed + 29));
  const shore = smoothstep(w.settings.seaLevel + 1, w.settings.seaLevel + 4, h);
  return clamp(cover * outside * shore, 0, 1);
}

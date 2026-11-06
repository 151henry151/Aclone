// SPDX-License-Identifier: GPL-3.0-or-later
import { hash2 } from './noise';
import { landBounds, terrainHeight, terrainSeed } from './terrain';
import { nearInlandWater } from './inland-water';
import { foundationProfile } from './construction-site';
import { constructionRules } from './construction-rules';
import { waterSourceRules } from './water-source-rules';
import type { World } from './types';
export interface Spring {
  id: string;
  x: number;
  z: number;
  flow: number;
  river?: string;
}
export function springNormalY(w: World, x: number, z: number) {
  const dx = (terrainHeight(w, x + 1, z) - terrainHeight(w, x - 1, z)) / 2;
  const dz = (terrainHeight(w, x, z + 1) - terrainHeight(w, x, z - 1)) / 2;
  return 1 / Math.hypot(1, dx, dz);
}
export function springCandidate(w: World, x: number, z: number) {
  const r = waterSourceRules(w.settings),
    h = terrainHeight(w, x, z);
  if (
    h - w.settings.seaLevel < r.springMinimumElevation ||
    springNormalY(w, x, z) < r.springMinimumNormalY ||
    nearInlandWater(w, x, z, r.springWaterClearance)
  )
    return false;
  // Sample the surrounding water exclusion ring and its interior. This includes
  // edited low ponds which do not occur in the named river/pond survey.
  const stride = Math.max(1, r.springWaterClearance / 4);
  for (let dz = -r.springWaterClearance; dz <= r.springWaterClearance; dz += stride)
    for (let dx = -r.springWaterClearance; dx <= r.springWaterClearance; dx += stride)
      if (
        Math.hypot(dx, dz) <= r.springWaterClearance &&
        terrainHeight(w, x + dx, z + dz) <= w.settings.seaLevel
      )
        return false;
  const site = { id: 'spring-survey', kind: 'waterworks', x, z, rotation: 0 };
  return foundationProfile(w, site).rise <= constructionRules(w.settings).constructionMaximumRise;
}
/** One seeded survey, then saved source identities become authoritative. */
export function surveySprings(w: World): Spring[] {
  const r = waterSourceRules(w.settings);
  if (!r.springsEnabled) return [];
  const springs: Spring[] = r.springHeadwaters
    ? (w.northernIsland?.rivers ?? []).map((river) => ({
        id: 'spring-head-' + river.id,
        x: river.points[0].x,
        z: river.points[0].z,
        flow: r.springHeadwaterFlow,
        river: river.id,
      }))
    : [];
  const b = landBounds(w),
    seed = terrainSeed(w),
    candidates: { x: number; z: number; rank: number; id: string }[] = [];
  // Sampling resolution is bounded independently of the requested density.
  const step = Math.max(
    r.springSpacing,
    Math.sqrt(((b.maxX - b.minX) * (b.maxZ - b.minZ)) / 20000),
  );
  for (let iz = Math.ceil(b.minZ / step); iz * step < b.maxZ; iz++)
    for (let ix = Math.ceil(b.minX / step); ix * step < b.maxX; ix++) {
      const x = Math.round((ix + 0.15 + 0.7 * hash2(ix, iz, seed + 307)) * step),
        z = Math.round((iz + 0.15 + 0.7 * hash2(ix, iz, seed + 308)) * step);
      if (x > b.maxX || z > b.maxZ) continue;
      const h = terrainHeight(w, x, z) - w.settings.seaLevel;
      const t = Math.max(
        0,
        Math.min(
          1,
          (h - r.springLowElevation) / Math.max(1, r.springHighElevation - r.springLowElevation),
        ),
      );
      if (
        hash2(ix, iz, seed + 309) >=
        r.springLowChance + (r.springHighChance - r.springLowChance) * t
      )
        continue;
      if (springCandidate(w, x, z))
        candidates.push({ x, z, id: `spring-${ix}-${iz}`, rank: hash2(ix, iz, seed + 310) });
    }
  for (const c of candidates.sort((a, b) => a.rank - b.rank)) {
    if (springs.length >= r.springTargetCount) break;
    if (springs.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < r.springSpacing)) continue;
    springs.push({
      id: c.id,
      x: c.x,
      z: c.z,
      flow: +(
        r.springMinimumFlow +
        (r.springMaximumFlow - r.springMinimumFlow) * hash2(c.x, c.z, seed + 311)
      ).toFixed(3),
    });
  }
  return springs;
}
export function prepareWaterSources(w: World) {
  if (w.waterSourcesVersion === 1) return false;
  w.springs ??= surveySprings(w);
  for (const b of w.buildings) if (b.kind === 'waterworks') b.legacyWaterIntake = true;
  w.waterSourcesVersion = 1;
  return true;
}

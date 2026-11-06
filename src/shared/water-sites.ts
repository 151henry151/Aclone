// SPDX-License-Identifier: GPL-3.0-or-later
import { landBounds, mapHalf, terrainHeight } from './terrain';
import { highWater } from './ocean';
import { riverBanks } from './inland-water';
import { constructionSiteReason } from './construction-site';
import { constructionRules } from './construction-rules';
import { pumpHouseSite, pumpHouseRecipe } from './fresh-water';
import { waterworksSite } from './shoreline';
import { waterSourceRules } from './water-source-rules';
import { worldBuildings } from './world-catalogue';
import { recipes } from './catalog';
import type { World, Building } from './types';
type Point = { x: number; z: number };
type WaterKind = 'waterworks' | 'pumpHouse';
type Site = Point & { rotation: number };
const cache = new WeakMap<
  World,
  {
    key: string;
    landscape: World['landscape'];
    island: World['northernIsland'];
    coast: Site[];
    fresh: Site[];
  }
>();
/** Survey geometry once per terrain/rule edit. Occupancy is checked for every caller. */
function proposals(w: World) {
  const r = waterSourceRules(w.settings);
  const key = JSON.stringify([
    w.settings.seaLevel,
    w.settings.tidalRange,
    w.settings.mapSize,
    w.terrainMapSize,
    w.terrain,
    w.townLayout,
    w.springs,
    r,
  ]);
  const prior = cache.get(w);
  if (prior?.key === key && prior.landscape === w.landscape && prior.island === w.northernIsland)
    return prior;
  const coast: Site[] = [],
    fresh: Site[] = [];
  if (r.springsEnabled)
    for (const s of w.springs ?? [])
      for (let i = 0; i < 16; i++) {
        const rotation = (i * Math.PI) / 8,
          reach = (r.pumpIntakeMinReach + r.pumpIntakeMaxReach) / 2;
        fresh.push({
          x: s.x + Math.sin(rotation) * reach,
          z: s.z + Math.cos(rotation) * reach,
          rotation,
        });
      }
  for (const river of w.northernIsland?.rivers ?? []) {
    const banks = riverBanks(river.points);
    for (let i = 1; i < river.points.length - 1; i += 2)
      for (const side of ['left', 'right'] as const) {
        const p = river.points[i],
          bank = banks[i][side],
          d = Math.hypot(bank.x - p.x, bank.z - p.z);
        if (!d) continue;
        const nx = (bank.x - p.x) / d,
          nz = (bank.z - p.z) / d;
        for (const back of [4, 5, 6])
          fresh.push({
            x: bank.x + nx * back,
            z: bank.z + nz * back,
            rotation: Math.atan2(nx, nz),
          });
      }
  }
  for (const pond of w.northernIsland?.ponds ?? [])
    for (let i = 0; i < 64; i++)
      for (const back of [4, 6, 8]) {
        const angle = (i * Math.PI) / 32,
          nx = Math.sin(angle),
          nz = Math.cos(angle);
        fresh.push({
          x: pond.x + nx * (pond.rx + back),
          z: pond.z + nz * (pond.rz + back),
          rotation: angle,
        });
      }
  const bounds = landBounds(w),
    half = mapHalf(w) - 12;
  const minX = Math.max(-half, bounds.minX),
    maxX = Math.min(half, bounds.maxX),
    minZ = Math.max(-half, bounds.minZ),
    maxZ = Math.min(half, bounds.maxZ);
  const step = Math.max(8, Math.sqrt(((maxX - minX) * (maxZ - minZ)) / 4096)),
    level = highWater(w) + 0.5;
  const height = (p: Point) => terrainHeight(w, p.x, p.z);
  // Refine wet/dry crossings rather than multiplying a fine grid by a continent's area.
  for (let z = minZ; z <= maxZ; z += step)
    for (let x = minX; x <= maxX; x += step) {
      const a = { x, z },
        ah = height(a);
      for (const end of [
        { x: Math.min(maxX, x + step), z },
        { x, z: Math.min(maxZ, z + step) },
      ]) {
        const eh = height(end);
        if (ah >= level === eh >= level) continue;
        let dry = ah >= level ? a : end,
          wet = ah < level ? a : end;
        for (let j = 0; j < 12; j++) {
          const m = { x: (dry.x + wet.x) / 2, z: (dry.z + wet.z) / 2 };
          if (height(m) >= level) dry = m;
          else wet = m;
        }
        const dx = dry.x - wet.x,
          dz = dry.z - wet.z,
          rotation = Math.atan2(dx, dz);
        // Refine along and across the detected coast; orientation is refined by siting.
        for (const along of [-4, 0, 4])
          for (const back of [0, 2, 4])
            coast.push({
              x: dry.x + Math.sin(rotation) * back + Math.cos(rotation) * along,
              z: dry.z + Math.cos(rotation) * back - Math.sin(rotation) * along,
              rotation,
            });
      }
    }
  const result = { key, landscape: w.landscape, island: w.northernIsland, coast, fresh };
  cache.set(w, result);
  return result;
}
export function nearestWaterSite(w: World, p: Point, kind: WaterKind): Site | undefined {
  const list = proposals(w)[kind === 'pumpHouse' ? 'fresh' : 'coast'];
  const spacing = constructionRules(w.settings).constructionMinimumSpacing;
  for (const candidate of [...list].sort(
    (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )) {
    if (
      w.buildings.some(
        (b) => Math.hypot(b.x - candidate.x, b.z - candidate.z) <= Math.max(20, spacing),
      )
    )
      continue;
    if (
      w.zones.some(
        (z) => z.kind === 'noBuild' && Math.hypot(z.x - candidate.x, z.z - candidate.z) < z.radius,
      )
    )
      continue;
    const b = { id: 'construction', kind, ...candidate };
    const site = kind === 'pumpHouse' ? pumpHouseSite(w, b) : waterworksSite(w, b, undefined, true);
    if (!site) continue;
    const placed = { ...b, ...site };
    if (!constructionSiteReason(w, placed))
      return { x: placed.x, z: placed.z, rotation: placed.rotation };
  }
  return undefined;
}
/** Shorter supply journeys win; equal journeys prefer cheaper water per batch. */
export function preferredWaterProducer(w: World, p: Point): WaterKind | undefined {
  const defs = worldBuildings(w);
  return (['pumpHouse', 'waterworks'] as const)
    .flatMap((kind) => {
      const site = nearestWaterSite(w, p, kind);
      if (!site) return [];
      const pump =
        kind === 'pumpHouse' ? pumpHouseSite(w, { id: 'construction', kind, ...site }) : undefined;
      const recipe = pump
        ? pumpHouseRecipe(w, { waterSource: pump.waterSource } as Building)
        : recipes.waterworks;
      const unitCost =
        Object.entries(recipe.inputs).reduce(
          (n, [id, q]) => n + q * (defs[kind].buy[id] ?? 0),
          defs[kind].wage * (defs[kind].idealEmployees ?? 1),
        ) / recipe.outputs.water;
      return [{ kind, distance: Math.hypot(site.x - p.x, site.z - p.z), unitCost }];
    })
    .sort((a, b) => a.distance - b.distance || a.unitCost - b.unitCost)[0]?.kind;
}

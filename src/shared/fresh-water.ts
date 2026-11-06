// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog';
import { foundationProfile } from './construction-site';
import { constructionRules } from './construction-rules';
import { inlandWaterAt } from './inland-water';
import { mapHalf, terrainHeight } from './terrain';
import { waterworksSite } from './shoreline';
import { oceanConnected } from './ocean-connection';
import { waterSourceRules } from './water-source-rules';
import type { Building, Recipe, World } from './types';

type Site = Pick<
  Building,
  | 'id'
  | 'kind'
  | 'x'
  | 'z'
  | 'rotation'
  | 'architecture'
  | 'style'
  | 'size'
  | 'creatorBounds'
  | 'waterSource'
>;
export const freshWaterReason =
  'Pump-houses need fresh water; build a desalination plant on the coast. Choose an unused spring or a dry river/pond bank with a deep intake.';

/** A source is reserved, not the river reach: neighbouring docks and fords remain usable. */
function sourceAvailable(w: World, b: Site, source: NonNullable<Building['waterSource']>) {
  const r = waterSourceRules(w.settings);
  return !w.buildings.some(
    (o) =>
      o.id !== b.id &&
      o.kind === 'pumpHouse' &&
      ((source.spring && o.waterSource?.spring === source.spring) ||
        (source.river &&
          o.waterSource?.river === source.river &&
          Math.hypot(o.x - b.x, o.z - b.z) < r.pumpRiverSpacing)),
  );
}
function validFoundation(w: World, b: Site, level?: number) {
  const f = foundationProfile(w, b),
    edge = mapHalf(w);
  return (
    Math.abs(b.x) < edge &&
    Math.abs(b.z) < edge &&
    !f.wet &&
    f.rise <= constructionRules(w.settings).constructionMaximumRise &&
    (level === undefined || f.low >= level + waterSourceRules(w.settings).pumpFreeboard)
  );
}
function validSource(w: World, b: Site, source: NonNullable<Building['waterSource']>) {
  const r = waterSourceRules(w.settings),
    p = source.intake;
  const dx = p.x - b.x,
    dz = p.z - b.z;
  const across = dx * Math.cos(b.rotation) - dz * Math.sin(b.rotation);
  const behind = -(dx * Math.sin(b.rotation) + dz * Math.cos(b.rotation));
  if (
    Math.abs(across) > 0.01 ||
    behind < r.pumpIntakeMinReach - 1e-6 ||
    behind > r.pumpIntakeMaxReach + 1e-6
  )
    return false;
  if (source.spring) {
    const s = w.springs?.find((s) => s.id === source.spring);
    return !!(
      r.springsEnabled &&
      s &&
      Math.hypot(s.x - p.x, s.z - p.z) < 0.01 &&
      validFoundation(w, b, inlandWaterAt(w, p.x, p.z)?.level)
    );
  }
  const water = inlandWaterAt(w, p.x, p.z);
  return !!(
    water &&
    water.river === source.river &&
    water.depth >= r.pumpIntakeDepth &&
    water.level - terrainHeight(w, p.x, p.z) >= r.pumpIntakeDepth &&
    validFoundation(w, b, water.level)
  );
}
/** Placement may snap to a spring. Runtime validation uses the saved intake exactly. */
export function pumpHouseSite(w: World, b: Site) {
  if (b.kind !== 'pumpHouse') return undefined;
  const r = waterSourceRules(w.settings),
    sin = Math.sin(b.rotation),
    cos = Math.cos(b.rotation);
  const reaches = [
    r.pumpIntakeMinReach,
    (r.pumpIntakeMinReach + r.pumpIntakeMaxReach) / 2,
    r.pumpIntakeMaxReach,
  ];
  const candidates: {
    x: number;
    z: number;
    rotation: number;
    intake: { x: number; z: number };
    waterSource: NonNullable<Building['waterSource']>;
  }[] = [];
  for (const reach of reaches) {
    const intake = { x: b.x - sin * reach, z: b.z - cos * reach };
    if (r.springsEnabled)
      for (const spring of w.springs ?? []) {
        if (Math.hypot(spring.x - intake.x, spring.z - intake.z) > r.pumpSpringSnapRange) continue;
        const source = {
          intake: { x: spring.x, z: spring.z },
          spring: spring.id,
          river: spring.river,
        };
        const site = { ...b, x: spring.x + sin * reach, z: spring.z + cos * reach };
        if (validSource(w, site, source) && sourceAvailable(w, site, source))
          candidates.push({
            x: site.x,
            z: site.z,
            rotation: b.rotation,
            intake: source.intake,
            waterSource: source,
          });
      }
    const water = inlandWaterAt(w, intake.x, intake.z);
    const source = { intake, river: water?.river };
    if (water && validSource(w, b, source) && sourceAvailable(w, b, source))
      candidates.push({ x: b.x, z: b.z, rotation: b.rotation, intake, waterSource: source });
  }
  return candidates.sort(
    (a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z),
  )[0];
}
export function waterProductionBlocker(w: World, b: Building) {
  if (b.kind === 'waterworks') {
    const site = waterworksSite(w, b, b.rotation);
    if (!site) return 'Dry intake';
    if (
      w.waterSourcesVersion === 1 &&
      !b.legacyWaterIntake &&
      waterSourceRules(w.settings).desalinationRequiresOcean &&
      !oceanConnected(w, site.intake)
    )
      return 'Intake needs sea water';
  }
  if (b.kind === 'pumpHouse' && (!b.waterSource || !validSource(w, b, b.waterSource)))
    return 'Fresh water source or intake unavailable';
  return undefined;
}
export function pumpHouseRecipe(w: World, b: Building): Recipe {
  const r = waterSourceRules(w.settings),
    spring = w.springs?.find((s) => s.id === b.waterSource?.spring);
  const gravity = !!spring && r.pumpGravityEnabled;
  const water = gravity ? r.pumpGravityWaterPerBatch : r.pumpWaterPerBatch;
  return {
    ...recipes.pumpHouse,
    seconds: (recipes.pumpHouse.seconds / 600) * w.settings.productionSeconds,
    inputs: gravity || r.pumpFuelPerBatch === 0 ? {} : { fuel: r.pumpFuelPerBatch },
    outputs: {
      water: Math.max(1, Math.round(water * (r.pumpFlowScaling && spring ? spring.flow : 1))),
    },
  };
}
export function refreshPumpRecipes(w: World) {
  for (const b of w.buildings)
    if (
      b.kind === 'pumpHouse' &&
      b.recipe === 'pumpHouse' &&
      (!b.production || b.pumpRecipeManaged)
    ) {
      const recipe = pumpHouseRecipe(w, b);
      if (JSON.stringify(b.production) !== JSON.stringify(recipe)) b.production = recipe;
      b.pumpRecipeManaged = true;
    }
}

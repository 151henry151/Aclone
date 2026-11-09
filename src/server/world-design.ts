import { applyBuildingTemplate } from '../shared/world-catalogue';
import {
  automotiveSchema,
  automotiveConfig,
  validateAutomotiveReferences,
} from '../shared/automotive-config';
import { bridgeDesignSchema, exportBridges } from './bridge-design';
import { bridgeRuleFields } from '../shared/bridge-rules';
import { bridgeReservedFootprint } from '../shared/bridge-geometry';
import { rectanglesOverlap } from '../shared/vehicle-footprint';
import { finishRoadWork } from '../shared/road-work';
import { inspectBridgeSteps } from '../shared/bridge-inspection';
import { refreshPumpRecipes } from '../shared/fresh-water';
import { normalizeMeat } from '../shared/meat-freshness';
import { normalizeYoung } from '../shared/livestock';
import { meatRecipes, meatMenus } from '../shared/meat-recipes';
import { riverDockAccepts } from '../shared/river-dock';
import { boatLandings, landingAccepts } from '../shared/boathouse';
import { mooringKey } from '../shared/boats';
import { cargoAccepts } from '../shared/cargo-policy';
import { vehicleDef } from '../shared/vehicle-config';
import { landscapeRules, landscapeRuleCeilings } from '../shared/landscape-rules';
import { constructionRuleFields } from '../shared/construction-rules';
import { validFarmPlotCount } from '../shared/farm-land';
import {
  trailerTuningSchema,
  trailerAccepts,
  clearTrailer,
  type Trailer,
} from '../shared/trailers';
import { northernIslandSchema } from './northern-island-schema';
import { maxCoordinate } from '../shared/world-limits';
import {
  vehicleTuningSchema,
  vehicleSlotSchema,
  validateVehicleTuning,
} from '../shared/vehicle-config';
import { pastureBlocker } from '../shared/pastures';
import { isLivestockFarm } from '../shared/pasture-land';
import { validateFarmPolicy } from '../shared/farm-policy';
import { validateBulkDiscounts } from '../shared/bulk-discounts';
import { courseSchema, validateCourse } from '../shared/courses.ts';
import { roundCycleSchema } from '../shared/round-cycle.ts';
import { buildingArchitecture } from '../shared/building-architecture.ts';
import { buildingDesignQuote } from '../shared/building-designs.ts';
import { worldBuildings } from '../shared/world-catalogue.ts';
import { rulesets } from '../shared/rulesets.ts';
import {
  landscapeSchema,
  landscapeSchemaForRules,
  validateLandscape,
} from '../shared/landscape.ts';
import {
  catalogueSchema,
  catalogueItemId,
  catalogueSkillId,
  worldItems,
  worldSkills,
  validateRecipe,
  setCatalogue,
} from '../shared/world-catalogue.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { creatorSchema, defaultCreator, validateCreator } from '../shared/creator.ts';
import { act, addPlayer, makeBuilding } from '../shared/simulation.ts';
import { anchorTowns } from '../shared/civics.ts';
import { buildings as catalog, items, skills } from '../shared/catalog.ts';
import type { World, Player } from '../shared/types.ts';
const freightLifeSchema = z.object({
  young: z
    .array(
      z.object({
        item: z.enum(['calves', 'lambs', 'piglets', 'chicks']),
        count: z.number().int().min(1).max(1000000),
        born: z.number().finite().min(-1e12).max(0),
        grownDays: z.number().finite().min(0).max(1e9),
      }),
    )
    .max(10000)
    .optional(),
  meat: z
    .array(
      z.object({
        item: z.enum(['beef', 'pork', 'mutton', 'poultry']),
        count: z.number().int().min(1).max(1000000),
        agedDays: z.number().finite().min(0).max(1e9),
      }),
    )
    .max(10000)
    .optional(),
});
const coordinate = z.number().min(-maxCoordinate).max(maxCoordinate);
const stock = z.record(catalogueItemId, z.number().int().min(0).max(100000000));
const recipe = z
  .object({
    inputs: stock,
    outputs: stock,
    seconds: z.number().int().min(10).max(86400),
    skill: catalogueSkillId,
    tier: z.number().int().min(0).max(10),
  })
  .refine(
    (r) =>
      Object.keys(r.inputs).length <= 8 &&
      Object.keys(r.outputs).length > 0 &&
      Object.keys(r.outputs).length <= 8 &&
      [...Object.values(r.inputs), ...Object.values(r.outputs)].every((n) => n >= 1 && n <= 1000),
  );
const roadDesignSchema = z.object({
  a: z.object({ x: coordinate, z: coordinate }),
  b: z.object({ x: coordinate, z: coordinate }),
  width: z.number().finite().min(0.1).max(100),
});
const designSchema = z.object({
  bridges: z.array(bridgeDesignSchema).max(bridgeRuleFields.bridgeMaximumCount.max).optional(),
  townLayout: z.union([z.literal(1), z.literal(2)]).optional(),
  roads: z.array(roadDesignSchema).max(100000).optional(),
  retiredRoads: z.array(z.string().max(200)).max(100000).optional(),
  pavedRoads: z
    .array(
      roadDesignSchema.extend({
        town: z.string().max(120),
        source: z.string().max(200).optional(),
        kind: z.enum(['urban', 'trunk']),
      }),
    )
    .max(100000)
    .optional(),
  spaceportSite: z
    .object({
      layout: z.number().int().min(1).max(4).optional(),
      x: coordinate,
      z: coordinate,
      height: z.number().finite().min(-40).max(500),
      entryHeight: z.number().finite().min(-40).max(500).optional(),
      building: z.string().max(80),
      exclusion: z.number().min(500).max(5000),
      fence: z.number().min(100).max(1000),
      access: z
        .array(z.object({ x: coordinate, z: coordinate }))
        .min(2)
        .max(128)
        .optional(),
    })
    .refine((s) => s.fence <= s.exclusion)
    .optional(),
  springs: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^spring-[a-zA-Z0-9:_-]+$/)
          .max(120),
        x: coordinate,
        z: coordinate,
        flow: z.number().min(0.1).max(5),
        river: z.string().max(120).optional(),
      }),
    )
    .max(1000)
    .refine((s) => new Set(s.map((p) => p.id)).size === s.length, 'Duplicate spring IDs')
    .optional(),
  waterSourcesVersion: z.literal(1).optional(),
  northernIsland: northernIslandSchema.optional(),
  terrainMapSize: z.number().min(500).max(20000).optional(),
  additionalResources: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^extra-[a-zA-Z0-9:_-]+$/)
          .max(120),
        item: z.enum(['logs', 'stone', 'gravel', 'dirt']),
        name: z.string().min(1).max(100),
        x: coordinate,
        z: coordinate,
        capacity: z.number().int().min(1).max(10000),
        regrowth: z.number().int().min(10).max(86400),
      }),
    )
    .max(1024)
    .refine(
      (nodes) => new Set(nodes.map((n) => n.id)).size === nodes.length,
      'Duplicate gathering ground IDs',
    )
    .default([]),
  coastalBluffs: z
    .array(
      z.object({
        id: z.string().max(80),
        x: coordinate,
        z: coordinate,
        angle: z.number().finite(),
        width: z.number().min(80).max(700),
        inland: z.number().min(150).max(700),
        height: z.number().min(15).max(100),
        seed: z.number().finite(),
      }),
    )
    .max(64)
    .default([]),
  landscape: landscapeSchemaForRules(landscapeRuleCeilings).default(() =>
    landscapeSchema.parse({}),
  ),
  catalogue: catalogueSchema.default(() => catalogueSchema.parse({})),
  courses: z.array(courseSchema).max(16).default([]),
  roundCycle: roundCycleSchema.optional(),
  contractRules: z.object({ leases: z.boolean(), auctions: z.boolean() }).optional(),
  format: z.literal('aclone-world-design'),
  version: z.literal(1),
  settings: z
    .record(z.string(), z.union([z.number().finite(), z.boolean(), z.string()]))
    .default({}),
  townCharter: z.record(z.string(), z.unknown()).default({}),
  terrain: z
    .array(
      z.object({
        x: coordinate,
        z: coordinate,
        radius: z.number().min(1).max(100),
        height: z.number().min(-30).max(30),
      }),
    )
    .max(landscapeRuleCeilings.terrainStampLimit),
  zones: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        kind: z.enum(['safe', 'noBuild', 'spawn', 'game', 'script', 'vehicle']),
        x: coordinate,
        z: coordinate,
        radius: z.number().min(1).max(5000),
      }),
    )
    .max(128),
  buildings: z
    .array(
      z.object({
        id: z.string().regex(/^[\w-]{1,64}$/),
        kind: z.string().refine((v) => Object.hasOwn(catalog, v)),
        templateId: z
          .string()
          .regex(/^custom:[a-z][a-z0-9_-]{0,31}$/)
          .optional(),
        name: z.string().min(1).max(64),
        x: coordinate,
        z: coordinate,
        rotation: z
          .number()
          .min(-Math.PI * 2)
          .max(Math.PI * 2),
        launchOffset: z.object({ x: coordinate, y: coordinate, z: coordinate }).optional(),
        foundationY: z.number().finite().min(-maxCoordinate).max(maxCoordinate).optional(),
        creatorModel: z.string().max(64).optional(),
        style: z.string().max(40).optional(),
        architecture: z.string().max(40).optional(),
        size: z.enum(['standard', 'expanded', 'large']).optional(),
        buy: stock.optional(),
        sell: stock.optional(),
        bulkDiscounts: z
          .array(
            z.object({
              quantity: z.number().int().min(2).max(10000),
              percent: z.number().min(0).max(100),
            }),
          )
          .max(5)
          .refine((v) => {
            try {
              validateBulkDiscounts(v);
              return true;
            } catch {
              return false;
            }
          }, 'Invalid bulk discount levels')
          .transform(validateBulkDiscounts)
          .optional(),
        farmPlots: z
          .number()
          .refine(validFarmPlotCount, 'Invalid purchased farm plot count')
          .optional(),
        young: z
          .array(
            z.object({
              item: z.enum(['calves', 'lambs', 'piglets', 'chicks']),
              count: z.number().int().min(1).max(100000000),
              born: z.number().finite().min(-1e12).max(0),
              grownDays: z.number().finite().min(0).max(1e9),
            }),
          )
          .max(10000)
          .optional(),
        continuousBreeding: z.boolean().optional(),
        slaughterFees: z
          .partialRecord(
            z.enum(['cows', 'pigs', 'sheep', 'chickens']),
            z.number().int().min(0).max(100000000),
          )
          .optional(),
        menuRecipe: z
          .string()
          .refine((id) => Object.hasOwn(meatRecipes(), id), 'Unknown meat menu')
          .optional(),
        pasture: z
          .object({
            x: z.number().min(-100).max(100),
            z: z.number().min(-100).max(100),
            parcels: z.number().int().min(1).max(4),
            parcelSize: z
              .number()
              .int()
              .min(constructionRuleFields.pastureParcelSize.min)
              .max(constructionRuleFields.pastureParcelSize.max)
              .optional(),
          })
          .optional(),
        farmPolicy: z
          .object({
            crops: z.array(z.string()).max(20),
            dailyLimit: z.number().int().min(0).max(100000000).optional(),
            reserve: z.number().int().min(0).max(100000000),
          })
          .refine((v) => {
            try {
              validateFarmPolicy(v);
              return true;
            } catch {
              return false;
            }
          }, 'Invalid farm staff policy')
          .transform(validateFarmPolicy)
          .optional(),
        wage: z.number().int().min(0).max(100000000).optional(),
        price: z.number().int().min(0).max(100000000).optional(),
        production: recipe.optional(),
        legacyWaterIntake: z.boolean().optional(),
        waterSource: z
          .object({
            intake: z.object({ x: coordinate, z: coordinate }),
            spring: z.string().max(100).optional(),
            river: z.string().max(100).optional(),
          })
          .optional(),
        pumpRecipeManaged: z.boolean().optional(),
      }),
    )
    .max(500),
  tier: z.number().int().min(0).max(10).default(0),
  mooredFreight: z
    .array(
      z
        .object({
          slot: z.number().int().min(0),
          landing: z.string().min(1).max(100),
          paint: z.string().max(64),
          cargo: z.record(z.string(), z.number().int().min(0).max(1000000)),
          cargoLife: freightLifeSchema.optional(),
        })
        .strict(),
    )
    .max(100)
    .default([]),
  parkedFuelTankers: z
    .array(
      z
        .object({
          id: z.string().regex(/^trailer-[1-9]\d{0,8}$/),
          x: z.number().finite().min(-maxCoordinate).max(maxCoordinate),
          z: z.number().finite().min(-maxCoordinate).max(maxCoordinate),
          heading: z.number().finite(),
          cargo: z.object({ fuel: z.number().int().min(0).max(100000).optional() }).strict(),
          sellPrice: z.number().int().min(0).max(100000000).default(0),
        })
        .strict(),
    )
    .max(2000)
    .default([]),
  automotive: automotiveSchema.optional(),
  trailerTuning: trailerTuningSchema.default({}),
  vehicleTuning: z.record(vehicleSlotSchema, vehicleTuningSchema).default({}),
  creator: creatorSchema,
  script: z.string().max(16384).default(''),
});
export function exportDesign(w: World, includeMedia = false) {
  const creator = structuredClone(w.creator ?? defaultCreator());
  if (!includeMedia) {
    creator.terrainTextures = {};
    creator.ambience = (creator.ambience ?? []).filter((z) => z.source !== 'asset');
  }
  // Designs remain portable without copying arbitrary asset URLs or private server paths.
  for (const m of creator.models)
    if (!includeMedia && (m.asset || m.texture)) {
      delete m.asset;
      delete m.texture;
      if (!m.parts.length)
        m.parts = [
          {
            shape: 'box',
            color: '#9b9f96',
            x: 0,
            y: m.height / 2,
            z: 0,
            sx: m.width,
            sy: m.height,
            sz: m.depth,
            yaw: 0,
          },
        ];
    }
  const vehicleTuning = structuredClone(w.vehicleTuning ?? {});
  if (!includeMedia)
    for (const v of Object.values(vehicleTuning)) {
      delete v.dashboard;
      delete v.trackTexture;
    }
  return {
    catalogue: w.catalogue ?? catalogueSchema.parse({}),
    courses: w.courses?.map((c) => c.definition) ?? [],
    roundCycle: w.roundCycle?.rules,
    contractRules: w.contractRules,
    format: 'aclone-world-design',
    version: 1,
    tier: w.tier,
    vehicleTuning,
    automotive: structuredClone(automotiveConfig(w)),
    trailerTuning: structuredClone(w.trailerTuning ?? {}),
    mooredFreight: Object.values(w.mooredBoats ?? {})
      .filter((b) => b.owner === w.owner && b.cargo && b.landing)
      .map((b) => ({
        slot: b.slot,
        landing: b.landing,
        paint: b.paint,
        cargo: structuredClone(b.cargo!),
        cargoLife: b.cargoLife
          ? {
              young: b.cargoLife.young?.map(({ item, count, born, grownDays }) => ({
                item,
                count,
                born: Math.min(0, born - w.time),
                grownDays,
              })),
              meat: b.cargoLife.meat?.map(({ item, count, agedDays }) => ({
                item,
                count,
                agedDays,
              })),
            }
          : undefined,
      })),
    parkedFuelTankers: Object.values(w.trailers ?? {})
      .filter((t) => t.kind === 'fuel' && !t.attached)
      .map((t) => ({
        id: t.id,
        x: t.x,
        z: t.z,
        heading: t.heading,
        cargo: structuredClone(t.cargo),
        sellPrice: t.sellPrice ?? 0,
      })),
    settings: w.settings,
    townCharter: w.townCharter ?? {},
    terrain: w.terrain,
    coastalBluffs: w.coastalBluffs,
    spaceportSite: w.spaceportSite,
    additionalResources: w.additionalResources,
    springs: w.springs,
    waterSourcesVersion: w.waterSourcesVersion,
    terrainMapSize: w.terrainMapSize,
    northernIsland: w.northernIsland,
    landscape: w.landscape,
    roads: w.roads,
    townLayout: w.townLayout,
    retiredRoads: w.retiredRoads,
    pavedRoads: w.pavedRoads,
    bridges: exportBridges(w.bridges, w.time),
    zones: w.zones,
    creator,
    script: w.script,
    buildings: w.buildings.map(
      ({
        id,
        kind,
        name,
        x,
        z,
        rotation,
        foundationY,
        launchOffset,
        creatorModel,
        templateId,
        style,
        architecture,
        size,
        buy,
        sell,
        bulkDiscounts,
        farmPolicy,
        farmPlots,
        stock,
        young,
        continuousBreeding,
        slaughterFees,
        recipe,
        pasture,
        wage,
        price,
        production,
        legacyWaterIntake,
        waterSource,
        pumpRecipeManaged,
      }) => ({
        id,
        kind,
        name,
        x,
        z,
        rotation,
        foundationY,
        launchOffset,
        creatorModel,
        templateId,
        style,
        architecture,
        size,
        buy,
        sell,
        bulkDiscounts,
        farmPolicy,
        farmPlots,
        young: (() => {
          const holder = { stock, young: structuredClone(young) };
          normalizeYoung(holder, w.time);
          return holder.young?.map(({ careSince: _careSince, ...c }) => ({
            ...c,
            born: Math.min(0, c.born - w.time),
          }));
        })(),
        continuousBreeding,
        slaughterFees,
        menuRecipe: recipe && Object.hasOwn(meatRecipes(), recipe) ? recipe : undefined,
        pasture,
        wage,
        price,
        production,
        legacyWaterIntake,
        waterSource,
        pumpRecipeManaged,
      }),
    ),
  };
}
export function applyDesign(w: World, input: unknown) {
  const imported = structuredClone(w);
  applyValidatedDesign(imported, input);
  Object.assign(w, imported);
}
function applyValidatedDesign(w: World, input: unknown) {
  if (Object.keys(w.players).length) throw Error('Import designs into a new, unoccupied world');
  const d = designSchema.parse(input);
  if (
    new Set(d.buildings.map((b) => b.id)).size !== d.buildings.length ||
    new Set(d.zones.map((z) => z.id)).size !== d.zones.length
  )
    throw Error('Duplicate layout IDs');
  w.creator = d.creator;
  if (new Set(d.courses.map((c) => c.id)).size !== d.courses.length)
    throw Error('Duplicate course IDs');
  w.courses = d.courses.map((definition) => ({
    definition,
    sponsor: w.owner,
    pot: 0,
    allTime: {},
    week: 0,
    weekly: {},
    paid: {},
  }));
  w.contractRules = d.contractRules;
  if (d.roundCycle)
    w.roundCycle = {
      rules: d.roundCycle,
      start: w.time,
      phase: 'build',
      slot: 0,
      previousFighting: w.settings.fighting,
      history: [],
    };
  setCatalogue(w, { id: w.owner } as Player, d.catalogue);
  for (const b of d.buildings)
    if (b.templateId && !d.catalogue.templates[b.templateId])
      throw Error('Unknown building template');
  for (const b of d.buildings) {
    if (b.production) {
      if (b.kind === 'automotiveFactory')
        throw Error('Automotive factories use reserved assembly orders');
      validateRecipe(w, b.production);
    }
    for (const id of [...Object.keys(b.buy ?? {}), ...Object.keys(b.sell ?? {})])
      if (!Object.hasOwn(worldItems(w), id)) throw Error('Unknown world item: ' + id);
  }
  w.landscape = d.landscape;
  w.roads = d.roads;
  if (d.townLayout !== undefined) w.townLayout = d.townLayout;
  w.retiredRoads = d.retiredRoads;
  w.pavedRoads = d.pavedRoads;
  w.bridges = d.bridges?.map((b) => ({
    ...b,
    owner: w.owner,
    contributors: { [w.owner]: structuredClone(b.paid) },
    foundedAt: w.time + b.foundedAt,
    completedAt: b.completedAt === undefined ? undefined : w.time + b.completedAt,
    wearAt: w.time + b.wearAt,
  }));
  w.bridgeSequence = Math.max(0, ...(w.bridges ?? []).map((b) => Number(b.id.slice(7))));
  for (const [i, b] of (w.bridges ?? []).entries())
    if (
      w
        .bridges!.slice(0, i)
        .some(
          (other) =>
            b.id === other.id ||
            rectanglesOverlap(bridgeReservedFootprint(b), bridgeReservedFootprint(other)),
        )
    )
      throw Error('Duplicate or overlapping bridge sites');
  // Designs carry authored surfaces, not the previous simulation's evidence or
  // unfinished construction. Explicit undefined also clears the atomic copy-back.
  for (const key of [
    'cityDevelopment',
    'cityAssessedDay',
    'cityDayLength',
    'pavingEligibility',
    'pavingPolicy',
    'pavingDay',
    'pavingDue',
    'pavingDayLength',
    'pavingProjects',
    'pavingFeeders',
    'pavingStatus',
  ] as const)
    w[key] = undefined;
  w.landscapeHistory = [];
  w.terrain = d.terrain;
  w.coastalBluffs = d.coastalBluffs;
  w.spaceportSite = d.spaceportSite;
  w.additionalResources = d.additionalResources;
  w.springs = d.springs;
  w.waterSourcesVersion = d.waterSourcesVersion;
  w.terrainMapSize = d.terrainMapSize;
  w.northernIsland = d.northernIsland;
  w.zones = d.zones;
  w.tier = d.tier;
  w.vehicleTuning = d.vehicleTuning;
  w.trailerTuning = d.trailerTuning;
  w.automotive = d.automotive;
  validateAutomotiveReferences(automotiveConfig(w), worldItems(w), worldSkills(w));
  w.buildings = d.buildings.map((b) =>
    (() => {
      if (b.architecture && !buildingArchitecture(b.kind, b.architecture))
        throw Error('Invalid architectural model');
      if (b.farmPlots !== undefined && b.kind !== 'farm')
        throw Error('Only farms can have purchased plots');
      const result = makeBuilding(b.id, b.kind, b.x, b.z);
      if (b.kind === 'automotiveFactory') applyBuildingTemplate(w, result, b.templateId ?? b.kind);
      Object.assign(result, b, { owner: w.owner });
      if (b.slaughterFees && b.kind !== 'butcher')
        throw Error('Only butchers can set slaughter fees');
      if (b.menuRecipe) {
        if (
          b.production ||
          (b.menuRecipe.startsWith('butcher_')
            ? b.kind !== 'butcher'
            : !meatMenus[b.menuRecipe.slice(5)]?.kitchens.includes(b.kind))
        )
          throw Error('That meat menu is not available at this building');
        result.recipe = b.menuRecipe;
        delete (result as typeof result & { menuRecipe?: string }).menuRecipe;
      }
      if (b.continuousBreeding !== undefined && !isLivestockFarm(result))
        throw Error('Only livestock farms can enable continuous breeding');
      if (b.young) {
        result.young = b.young.map((c) => ({ ...c, born: w.time + c.born, careSince: w.time }));
        result.youngCareAt = w.time;
        for (const cohort of result.young)
          result.stock[cohort.item] = (result.stock[cohort.item] ?? 0) + cohort.count;
      }
      if (b.architecture || b.size) {
        const def = worldBuildings(w)[b.templateId ?? b.kind];
        result.capacity = buildingDesignQuote(
          b.kind,
          def,
          b.style,
          b.size,
          b.architecture,
        ).capacity;
      }
      return result;
    })(),
  );
  const claimedSprings = new Set<string>();
  for (const b of w.buildings)
    if (b.kind === 'pumpHouse' && b.waterSource?.spring) {
      if (claimedSprings.has(b.waterSource.spring))
        throw Error('A spring can be claimed by only one pump-house');
      claimedSprings.add(b.waterSource.spring);
    }
  w.creator = validateCreator(w, d.creator);
  for (const [slot, tuning] of Object.entries(w.vehicleTuning ?? {}))
    validateVehicleTuning(w, Number(slot), tuning);
  for (const b of w.buildings) {
    const m = w.creator.models.find((m) => m.id === b.creatorModel);
    if (m) b.creatorBounds = { width: m.width, depth: m.depth, height: m.height };
  }
  configureRules(w, d.settings, d.townCharter);
  refreshPumpRecipes(w);
  w.landscape = validateLandscape(w, d.landscape);
  for (const b of w.bridges ?? []) finishRoadWork(inspectBridgeSteps(w, b));
  if (w.terrain.length > landscapeRules(w.settings).terrainStampLimit)
    throw Error('Terrain stamp limit exceeded');
  const freight: NonNullable<World['mooredBoats']> = {};
  for (const input of d.mooredFreight) {
    const v = vehicleDef(w, input.slot),
      dock = boatLandings(w, input.slot).find((dock) => dock.id === input.landing);
    const key = mooringKey(w.owner, input.slot);
    if (freight[key])
      throw Error('A world design can place only one freight vessel of each class for its owner');
    if (!v?.holdCapacity || !dock || !landingAccepts(w, dock, input.slot))
      throw Error('Freight vessel needs a compatible landing');
    if (
      Object.entries(input.cargo).some(
        ([item, n]) =>
          !cargoAccepts(
            w,
            { kind: v.cargoKind ?? 'box', cargo: input.cargo },
            v.holdCapacity!,
            item,
            0,
          ),
      )
    )
      throw Error('Invalid freight hold cargo');
    if (Object.values(freight).some((b) => b.landing === dock.id))
      throw Error('Freight berth is occupied');
    const cargoLife = input.cargoLife
      ? {
          young: input.cargoLife.young?.map((c) => ({
            ...c,
            born: c.born + w.time,
            careSince: w.time,
          })),
          meat: input.cargoLife.meat?.map((lot) => ({ ...lot, checkedAt: w.time })),
        }
      : undefined;
    const holder = { stock: input.cargo, young: cargoLife?.young };
    if (cargoLife) {
      normalizeYoung(holder, w.time);
      cargoLife.young = holder.young;
      normalizeMeat(input.cargo, cargoLife, w.time);
    }
    freight[key] = { ...input, cargoLife, owner: w.owner, ...dock.berth, heading: dock.heading };
  }
  w.mooredBoats = freight;
  const placements: Record<string, Trailer> = {};
  for (const input of d.parkedFuelTankers) {
    if (placements[input.id]) throw Error('Duplicate tanker IDs');
    const t: Trailer = { ...input, kind: 'fuel', owner: w.owner };
    if (!trailerAccepts(w, { ...t, cargo: {} }, 'fuel', t.cargo.fuel ?? 0))
      throw Error('Fuel tanker load exceeds capacity');
    if (!clearTrailer({ ...w, trailers: placements }, t, t))
      throw Error('Fuel tanker needs clear dry ground inside the world');
    placements[t.id] = t;
  }
  w.trailers = placements;
  w.trailerSeq = Math.max(0, ...d.parkedFuelTankers.map((t) => Number(t.id.slice(8))));
  for (const b of w.buildings)
    if (b.pasture) {
      if (!isLivestockFarm(b)) throw Error('Only livestock farms can have pastures');
      const blocker = pastureBlocker(w, b, b.pasture, 0, undefined, undefined, true);
      if (blocker) throw Error(blocker);
    }
  w.script = d.script;
  anchorTowns(w);
  for (const c of w.courses ?? []) validateCourse(w, c.definition);
  if (w.roundCycle) {
    w.roundCycle.previousFighting = w.settings.fighting;
    w.settings.fighting = false;
  }
  w.revision++;
}
/** Creation-only validation: use the ordinary action on a disposable world copy
 * so its temporary player and money ledger cannot leak into the new world. */
export function configureRules(w: World, settings: unknown, charter?: unknown) {
  const validation = structuredClone(w),
    p = addPlayer(validation, w.owner, 'Creator');
  act(validation, p.id, { type: 'settings', patch: settings });
  if (charter) act(validation, p.id, { type: 'townCharter', patch: charter });
  w.settings = validation.settings;
  if (charter) w.townCharter = validation.townCharter;
}
export function applyPreset(w: World, preset: string) {
  w.creator = defaultCreator();
  Object.assign(w.settings, rulesets[preset]?.settings ?? {});
  if (['combat', 'ctf', 'capture', 'blank'].includes(preset)) {
    w.buildings = w.buildings.filter((b) => b.kind === 'starport');
    anchorTowns(w);
    w.zones = [];
    w.creator.scenery = false;
    w.creator.roads = false;
    w.settings.hungerRate = w.settings.thirstRate = 0;
  }
  if (['combat', 'ctf', 'capture'].includes(preset)) {
    w.settings.fighting = true;
    w.creator.arena.mode = preset === 'combat' ? 'deathmatch' : (preset as 'ctf' | 'capture');
    w.creator.arena.scoreLimit = preset === 'ctf' ? 3 : preset === 'capture' ? 120 : 10;
  }
}

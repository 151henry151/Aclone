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
import { landscapeSchema, validateLandscape } from '../shared/landscape.ts';
import {
  catalogueSchema,
  catalogueItemId,
  catalogueSkillId,
  worldItems,
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
const coordinate = z.number().min(-10000).max(10000);
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
const designSchema = z.object({
  spaceportSite: z
    .object({
      layout: z.number().int().min(1).max(3).optional(),
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
        width: z.number().min(80).max(250),
        inland: z.number().min(150).max(500),
        height: z.number().min(15).max(65),
        seed: z.number().finite(),
      }),
    )
    .max(32)
    .default([]),
  landscape: landscapeSchema.default(() => landscapeSchema.parse({})),
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
    .max(256),
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
        foundationY: z.number().finite().min(-10000).max(10000).optional(),
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
        pasture: z
          .object({
            x: z.number().min(-100).max(100),
            z: z.number().min(-100).max(100),
            parcels: z.number().int().min(1).max(4),
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
      }),
    )
    .max(500),
  tier: z.number().int().min(0).max(10).default(0),
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
    settings: w.settings,
    townCharter: w.townCharter ?? {},
    terrain: w.terrain,
    coastalBluffs: w.coastalBluffs,
    spaceportSite: w.spaceportSite,
    additionalResources: w.additionalResources,
    terrainMapSize: w.terrainMapSize,
    landscape: w.landscape,
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
        pasture,
        wage,
        price,
        production,
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
        pasture,
        wage,
        price,
        production,
      }),
    ),
  };
}
export function applyDesign(w: World, input: unknown) {
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
    if (b.production) validateRecipe(w, b.production);
    for (const id of [...Object.keys(b.buy ?? {}), ...Object.keys(b.sell ?? {})])
      if (!Object.hasOwn(worldItems(w), id)) throw Error('Unknown world item: ' + id);
  }
  w.landscape = validateLandscape(w, d.landscape);
  w.terrain = d.terrain;
  w.coastalBluffs = d.coastalBluffs;
  w.spaceportSite = d.spaceportSite;
  w.additionalResources = d.additionalResources;
  w.terrainMapSize = d.terrainMapSize;
  w.zones = d.zones;
  w.tier = d.tier;
  w.vehicleTuning = d.vehicleTuning;
  w.buildings = d.buildings.map((b) =>
    (() => {
      if (b.architecture && !buildingArchitecture(b.kind, b.architecture))
        throw Error('Invalid architectural model');
      const result = Object.assign(makeBuilding(b.id, b.kind, b.x, b.z), b, { owner: w.owner });
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
  w.creator = validateCreator(w, d.creator);
  for (const [slot, tuning] of Object.entries(w.vehicleTuning ?? {}))
    validateVehicleTuning(w, Number(slot), tuning);
  for (const b of w.buildings) {
    const m = w.creator.models.find((m) => m.id === b.creatorModel);
    if (m) b.creatorBounds = { width: m.width, depth: m.depth, height: m.height };
  }
  configureRules(w, d.settings, d.townCharter);
  for (const b of w.buildings)
    if (b.pasture) {
      if (!isLivestockFarm(b)) throw Error('Only livestock farms can have pastures');
      const blocker = pastureBlocker(w, b, b.pasture);
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

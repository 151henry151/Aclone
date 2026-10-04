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
import { buildings as catalog, items, skills } from '../shared/catalog.ts';
import type { World, Player } from '../shared/types.ts';
const coordinate = z.number().min(-250).max(250);
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
  landscape: landscapeSchema.default(() => landscapeSchema.parse({})),
  catalogue: catalogueSchema.default(() => catalogueSchema.parse({})),
  format: z.literal('aclone-world-design'),
  version: z.literal(1),
  settings: z
    .record(z.string(), z.union([z.number().finite(), z.boolean(), z.string()]))
    .default({}),
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
        radius: z.number().min(1).max(100),
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
        creatorModel: z.string().max(64).optional(),
        style: z.string().max(40).optional(),
        buy: stock.optional(),
        sell: stock.optional(),
        wage: z.number().int().min(0).max(100000000).optional(),
        price: z.number().int().min(0).max(100000000).optional(),
        production: recipe.optional(),
      }),
    )
    .max(500),
  tier: z.number().int().min(0).max(10).default(0),
  vehicleTuning: z
    .record(
      z.string().regex(/^([0-9]|1[0-9]|2[0-3])$/),
      z.object({
        speed: z.number().min(1).max(100),
        acceleration: z.number().min(1).max(50),
        turn: z.number().min(0.1).max(6),
        armour: z.number().min(10).max(1000),
        fuel: z.number().min(0).max(1),
      }),
    )
    .default({}),
  creator: creatorSchema,
  script: z.string().max(16384).default(''),
});
export function exportDesign(w: World, includeMedia = false) {
  const creator = structuredClone(w.creator ?? defaultCreator());
  if (!includeMedia) creator.terrainTextures = {};
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
  return {
    catalogue: w.catalogue ?? catalogueSchema.parse({}),
    format: 'aclone-world-design',
    version: 1,
    tier: w.tier,
    vehicleTuning: w.vehicleTuning ?? {},
    settings: w.settings,
    terrain: w.terrain,
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
        creatorModel,
        templateId,
        style,
        buy,
        sell,
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
        creatorModel,
        templateId,
        style,
        buy,
        sell,
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
  w.zones = d.zones;
  w.tier = d.tier;
  w.vehicleTuning = d.vehicleTuning;
  w.buildings = d.buildings.map((b) =>
    Object.assign(makeBuilding(b.id, b.kind, b.x, b.z), b, { owner: w.owner }),
  );
  w.creator = validateCreator(w, d.creator);
  for (const b of w.buildings) {
    const m = w.creator.models.find((m) => m.id === b.creatorModel);
    if (m) b.creatorBounds = { width: m.width, depth: m.depth, height: m.height };
  }
  w.script = d.script;
  configureRules(w, d.settings);
  w.revision++;
}
/** Creation-only validation: use the ordinary action on a disposable world copy
 * so its temporary player and money ledger cannot leak into the new world. */
export function configureRules(w: World, settings: unknown) {
  const validation = structuredClone(w),
    p = addPlayer(validation, w.owner, 'Creator');
  act(validation, p.id, { type: 'settings', patch: settings });
  w.settings = validation.settings;
}
export function applyPreset(w: World, preset: string) {
  w.creator = defaultCreator();
  Object.assign(w.settings, rulesets[preset]?.settings ?? {});
  if (['combat', 'ctf', 'capture', 'blank'].includes(preset)) {
    w.buildings = w.buildings.filter((b) => b.kind === 'starport');
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

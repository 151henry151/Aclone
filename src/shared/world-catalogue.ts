// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { items, skills, recipes, buildings } from './catalog.ts';
import type { World, Player, ItemDef, Building, Recipe, BuildingDef } from './types.ts';
import { taxTown } from './town-charter.ts';
export const customId = /^custom:[a-z][a-z0-9_-]{0,31}$/;
export const catalogueItemId = z
  .string()
  .refine((s) => Object.hasOwn(items, s) || customId.test(s));
export const catalogueSkillId = z.string().refine((s) => skills.includes(s) || customId.test(s));
const customKey = z.string().regex(customId, 'Use a custom:identifier');
const amounts = z
  .record(catalogueItemId, z.number().int().min(0).max(1000000))
  .refine((v) => Object.keys(v).length <= 32);
const production = z
  .object({
    inputs: amounts,
    outputs: amounts,
    skill: catalogueSkillId,
    seconds: z.number().int().min(10).max(86400),
    tier: z.number().int().min(0).max(10).default(0),
  })
  .refine(
    (r) =>
      Object.keys(r.inputs).length <= 8 &&
      Object.keys(r.outputs).length > 0 &&
      Object.keys(r.outputs).length <= 8 &&
      [...Object.values(r.inputs), ...Object.values(r.outputs)].every((n) => n > 0 && n <= 1000),
  );
export const catalogueSchema = z.object({
  templates: z
    .record(
      customKey,
      z.object({
        name: z.string().trim().min(1).max(64),
        base: z.string().refine((s) => Object.hasOwn(buildings, s)),
        price: z.number().int().min(1).max(100000000),
        wage: z.number().int().min(0).max(1000000),
        materials: amounts,
        buy: amounts.default({}),
        sell: amounts.default({}),
        production: production.optional(),
        creatorModel: z.string().max(64).optional(),
      }),
    )
    .refine((v) => Object.keys(v).length <= 32)
    .default({}),
  items: z
    .record(
      customKey,
      z.object({
        name: z.string().trim().min(1).max(64),
        icon: z.string().max(8).default(''),
        weight: z.number().int().min(1).max(1000),
        price: z.number().int().min(1).max(1000000),
        health: z.number().int().min(-6000).max(6000).optional(),
        maxHealth: z.number().int().min(-600).max(600).optional(),
        food: z.number().int().min(0).max(50000).optional(),
        drink: z.number().int().min(0).max(50000).optional(),
        fuel: z.number().int().min(0).max(64).optional(),
      }),
    )
    .refine((v) => Object.keys(v).length <= 32)
    .default({}),
  skills: z
    .record(
      customKey,
      z.object({
        name: z.string().trim().min(1).max(64),
        price: z.number().int().min(0).max(1000000),
        seconds: z.number().int().min(1).max(86400),
        prerequisites: z.array(catalogueSkillId).max(8).default([]),
      }),
    )
    .refine((v) => Object.keys(v).length <= 16)
    .default({}),
});
export type Catalogue = z.infer<typeof catalogueSchema>;
const cache = new WeakMap<Catalogue, Record<string, ItemDef>>();
export function worldItems(w?: Pick<World, 'catalogue'>): Record<string, ItemDef> {
  if (!w?.catalogue) return items;
  let result = cache.get(w.catalogue);
  if (!result) {
    result = { ...items, ...w.catalogue.items };
    cache.set(w.catalogue, result);
  }
  return result;
}
export function worldSkills(w?: Pick<World, 'catalogue'>) {
  return w?.catalogue ? [...skills, ...Object.keys(w.catalogue.skills)] : skills;
}
export function skillLesson(w: World, p: Player, id: string) {
  const def = w.catalogue?.skills[id];
  return (
    def ?? {
      name: id,
      price: p.skills.length ? 16000 : 8000,
      seconds: p.skills.length ? 2400 : 60,
      prerequisites: [],
    }
  );
}
export function validateRecipe(w: World, r: Pick<Recipe, 'inputs' | 'outputs' | 'skill'>) {
  for (const id of [...Object.keys(r.inputs), ...Object.keys(r.outputs)])
    if (!Object.hasOwn(worldItems(w), id)) throw Error('Unknown recipe item: ' + id);
  if (!worldSkills(w).includes(r.skill)) throw Error('Unknown recipe profession: ' + r.skill);
}
export function setCatalogue(w: World, p: Player, input: unknown) {
  if (w.owner !== p.id) throw Error('World owner required');
  const next = catalogueSchema.parse(input),
    known = new Set([...skills, ...Object.keys(next.skills)]);
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw Error('Profession prerequisite cycle');
    if (done.has(id)) return;
    visiting.add(id);
    for (const prerequisite of next.skills[id]?.prerequisites ?? []) {
      if (!known.has(prerequisite)) throw Error('Unknown prerequisite: ' + prerequisite);
      visit(prerequisite);
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const id of Object.keys(next.skills)) visit(id);
  const refs = JSON.stringify({
    players: w.players,
    buildings: w.buildings,
    creator: w.creator,
    templates: next.templates,
  });
  for (const id of [
    ...Object.keys(w.catalogue?.items ?? {}),
    ...Object.keys(w.catalogue?.skills ?? {}),
  ])
    if (
      !Object.hasOwn(next.items, id) &&
      !Object.hasOwn(next.skills, id) &&
      refs.includes(JSON.stringify(id))
    )
      throw Error('Definition is still used: ' + id);
  const probe = { ...w, catalogue: next };
  for (const [id, t] of Object.entries(next.templates)) {
    for (const item of [...Object.keys(t.materials), ...Object.keys(t.buy), ...Object.keys(t.sell)])
      if (!worldItems(probe)[item]) throw Error('Unknown template item: ' + item);
    if (t.production) {
      validateRecipe(probe, t.production);
      if (t.base === 'farm') throw Error('Farm templates use crop plots');
    }
    if (t.creatorModel && !w.creator?.models.some((m) => m.id === t.creatorModel))
      throw Error('Unknown template visual');
  }
  for (const id of Object.keys(w.catalogue?.templates ?? {}))
    if (!next.templates[id] && w.buildings.some((b) => b.templateId === id))
      throw Error('Template is still used: ' + id);
  for (const b of w.buildings) if (b.production) validateRecipe(probe, b.production);
  w.catalogue = next;
  w.revision++;
}
/** Quotes are local and editable. Report cash flow per fully staffed batch, not guaranteed profit. */
export function productionDiagnostics(w: World, b: Building) {
  const r = b.production ?? (b.recipe ? recipes[b.recipe] : undefined);
  if (!r) return { inputs: [], outputValue: 0, materials: 0, wages: 0, tax: 0, margin: 0 };
  const defs = worldItems(w),
    taxRate = Math.min(1, Math.max(0, w.settings.salesTax + (taxTown(w, b.x, b.z)?.salesTax ?? 0)));
  const inputs = Object.entries(r.inputs).map(([item, quantity]) => {
    const suppliers = w.buildings
      .filter((s) => s.id !== b.id && !s.construction && s.sell[item] !== undefined)
      .map((s) => ({ id: s.id, name: s.name, price: s.sell[item], stock: s.stock[item] ?? 0 }))
      .sort((a, b) => a.price - b.price);
    return { item, quantity, name: defs[item]?.name ?? item, bid: b.buy[item], suppliers };
  });
  const materials = inputs.reduce(
    (n, i) => n + i.quantity * (i.bid ?? defs[i.item]?.price ?? 0),
    0,
  );
  const outputValue = Object.entries(r.outputs).reduce(
    (n, [item, quantity]) => n + quantity * (b.sell[item] ?? 0),
    0,
  );
  const wages = b.wage * Math.max(1, b.employees.length),
    tax = Math.floor(outputValue * taxRate);
  return {
    inputs,
    outputValue,
    materials,
    wages,
    tax,
    margin: outputValue - materials - wages - tax,
  };
}

export function worldBuildings(w: World): Record<string, BuildingDef> {
  if (!Object.keys(w.catalogue?.templates ?? {}).length) return buildings;
  return {
    ...buildings,
    ...Object.fromEntries(
      Object.entries(w.catalogue!.templates).map(([id, t]) => [
        id,
        {
          ...buildings[t.base],
          name: t.name,
          price: t.price,
          wage: t.wage,
          materials: t.materials,
          buy: t.buy,
          sell: t.sell,
          stock: {},
        },
      ]),
    ),
  };
}
export function applyBuildingTemplate(w: World, b: Building, id: string) {
  const t = w.catalogue?.templates[id];
  if (!t) return;
  Object.assign(b, {
    templateId: id,
    name: t.name,
    price: t.price,
    wage: t.wage,
    stock: {},
    buy: { ...t.buy },
    sell: { ...t.sell },
  });
  if (t.production) {
    delete b.recipe;
    b.production = structuredClone(t.production);
  }
  if (t.creatorModel) {
    const m = w.creator!.models.find((m) => m.id === t.creatorModel)!;
    b.creatorModel = m.id;
    b.creatorBounds = { width: m.width, height: m.height, depth: m.depth };
  }
}

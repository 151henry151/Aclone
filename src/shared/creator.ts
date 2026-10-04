import { bookSchema, townEventSchema } from './world-stories.ts';
import { ambientSchema } from './ambient.ts';
import { maximumHealth } from './nutrition.ts';
import { landscapeBlocks, scatterObjects } from './landscape.ts';
import {
  catalogueItemId,
  catalogueSkillId,
  worldItems,
  worldSkills,
  validateRecipe,
} from './world-catalogue.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { questSchema, guardSchema, questEvent } from './quests.ts';
import type { World, Player, Action } from './types.ts';
import { items, vehicles, skills } from './catalog.ts';
import { terrainHeight } from './terrain.ts';
import { say } from './messages.ts';
const coordinate = z.number().finite().min(-240).max(240);
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const name = z.string().trim().min(1).max(64);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const point = z.object({ x: coordinate, z: coordinate });
export const arenaSchema = z.object({
  mode: z.enum(['open', 'deathmatch', 'capture', 'ctf']).default('open'),
  roundSeconds: z.number().int().min(30).max(3600).default(600),
  scoreLimit: z.number().int().min(1).max(1000).default(10),
  flagReturnSeconds: z.number().int().min(5).max(300).default(30),
  protectionSeconds: z.number().min(0).max(30).default(3),
  bases: z.tuple([point, point]).default([
    { x: -100, z: -110 },
    { x: 100, z: -110 },
  ]),
  capture: point
    .extend({ radius: z.number().min(3).max(50) })
    .default({ x: 0, z: -110, radius: 12 }),
  teams: z.tuple([name, name]).default(['Rust', 'Moss']),
  weapons: z
    .array(z.enum(['machine', 'grenade', 'plasma', 'rocket', 'javelin', 'mine']))
    .min(1)
    .max(6)
    .default(['machine', 'grenade', 'plasma', 'rocket', 'javelin', 'mine']),
});
const recipeStock = z
  .record(catalogueItemId, z.number().int().min(1).max(1000))
  .refine((v) => Object.keys(v).length <= 8);
export const creatorRecipeSchema = z.object({
  inputs: recipeStock,
  outputs: recipeStock.refine((v) => Object.keys(v).length > 0),
  seconds: z.number().int().min(10).max(86400),
  skill: catalogueSkillId,
});
export const partSchema = z.object({
  shape: z.enum(['box', 'sphere', 'cylinder', 'cone']),
  color: color.default('#b7ab87'),
  x: z.number().min(-30).max(30).default(0),
  y: z.number().min(-30).max(60).default(1),
  z: z.number().min(-30).max(30).default(0),
  sx: z.number().min(0.1).max(60).default(2),
  sy: z.number().min(0.1).max(60).default(2),
  sz: z.number().min(0.1).max(60).default(2),
  yaw: z.number().min(-360).max(360).default(0),
});
export const blueprintSchema = z
  .object({
    id,
    name,
    parts: z.array(partSchema).max(32).default([]),
    asset: z.string().max(64).optional(),
    texture: z.string().max(64).optional(),
    animation: z.number().int().min(-1).max(7).default(-1),
    animationSpeed: z.number().min(0.1).max(3).default(1),
    width: z.number().min(0.2).max(60).default(4),
    height: z.number().min(0.2).max(60).default(4),
    depth: z.number().min(0.2).max(60).default(4),
  })
  .refine((b) => b.parts.length > 0 || !!b.asset, 'Add a shape or choose an uploaded model/image');
export const objectSchema = z.object({
  id,
  name,
  model: id,
  x: coordinate,
  z: coordinate,
  y: z.number().min(-20).max(60).default(0),
  yaw: z.number().min(-360).max(360).default(0),
  scale: z.number().min(0.1).max(4).default(1),
  solid: z.boolean().default(false),
  visible: z.boolean().default(true),
  radius: z.number().min(0.2).max(30).default(2),
  prompt: z.string().max(80).default('Interact'),
});
export const effectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), text: z.string().min(1).max(300) }),
  z.object({ type: z.literal('heal'), amount: z.number().int().min(-60000).max(60000) }),
  z.object({ type: z.literal('needs'), amount: z.number().int().min(-50000).max(50000) }),
  z.object({
    type: z.literal('item'),
    item: catalogueItemId,
    quantity: z.number().int().min(-100).max(100),
  }),
  z.object({ type: z.literal('teleport'), x: coordinate, z: coordinate }),
  z.object({
    type: z.literal('score'),
    team: z.number().int().min(-1).max(1).default(-1),
    amount: z.number().int().min(-100).max(100),
  }),
  z.object({ type: z.literal('visibility'), object: id, visible: z.boolean() }),
]);
export type Effect = z.infer<typeof effectSchema>;
export const ruleSchema = z.object({
  id,
  name,
  enabled: z.boolean().default(true),
  event: z.enum(['interact', 'enter', 'timer', 'login', 'task']),
  target: z.string().max(64).default(''),
  cooldown: z.number().min(1).max(86400).default(30),
  team: z.number().int().min(-1).max(1).default(-1),
  requiredItem: z
    .string()
    .max(40)
    .default('')
    .refine((v) => !v || catalogueItemId.safeParse(v).success),
  effects: z.array(effectSchema).min(1).max(8),
});
export const creatorSchema = z.object({
  version: z.literal(1).default(1),
  scenery: z.boolean().default(true),
  roads: z.boolean().default(true),
  weather: z
    .enum(['natural', 'clear', 'rain', 'snow', 'thunderstorm', 'snowstorm'])
    .default('natural'),
  arena: arenaSchema.default(() => arenaSchema.parse({})),
  quests: z.array(questSchema).max(32).default([]),
  guards: z.array(guardSchema).max(32).default([]),
  models: z.array(blueprintSchema).max(64).default([]),
  objects: z.array(objectSchema).max(128).default([]),
  rules: z.array(ruleSchema).max(64).default([]),
  books: z.array(bookSchema).max(16).default([]),
  townEvents: z.array(townEventSchema).max(16).default([]),
  ambience: z.array(ambientSchema).max(32).default([]),
  terrainTextures: z.partialRecord(z.enum(['grass', 'gravel', 'soil', 'sand']), id).default({}),
  resourceModels: z.partialRecord(z.enum(['logs', 'stone', 'gravel', 'dirt']), id).default({}),
  vehicleModels: z.record(z.string().regex(/^([0-9]|1[0-9]|2[0-3])$/), id).default({}),
});
export type Creator = z.infer<typeof creatorSchema>;
export type Blueprint = z.infer<typeof blueprintSchema>;
export type CreatorObject = z.infer<typeof objectSchema>;
export type CreatorRule = z.infer<typeof ruleSchema>;
export const defaultCreator = () => creatorSchema.parse({});
export function validateCreator(w: World, input: unknown) {
  const c = creatorSchema.parse(input),
    defs = worldItems(w),
    professions = worldSkills(w);
  const item = (id: string) => {
    if (id && !Object.hasOwn(defs, id)) throw Error('Unknown world item: ' + id);
  };
  const skill = (id: string) => {
    if (id && !professions.includes(id)) throw Error('Unknown world profession: ' + id);
  };
  for (const r of c.rules) {
    item(r.requiredItem);
    for (const e of r.effects) if (e.type === 'item') item(e.item);
  }
  for (const q of c.quests) {
    for (const s of q.steps) {
      item(s.item);
      if (s.event === 'study' && s.target) skill(s.target);
    }
    for (const id of Object.keys(q.rewards)) item(id);
  }
  for (const book of c.books) item(book.item);
  for (const e of c.townEvents)
    if (e.quest && !c.quests.some((q) => q.id === e.quest)) throw Error('Event quest is missing');
  for (const g of c.guards) {
    item(g.item);
    skill(g.skill);
  }

  for (const list of [c.models, c.objects, c.rules, c.quests, c.guards, c.books, c.townEvents])
    if (new Set(list.map((v) => v.id)).size !== list.length)
      throw Error('Each object, model and rule needs a unique ID');
  for (const m of c.models)
    if (
      m.asset &&
      !w.assets.some(
        (a) =>
          a.id === m.asset &&
          ['image/png', 'image/jpeg', 'model/gltf-binary', 'model/obj'].includes(a.type),
      )
    )
      throw Error('Choose a visual asset uploaded to this world');
  for (const m of c.models)
    if (
      m.texture &&
      ((!!m.asset && !w.assets.some((a) => a.id === m.asset && a.type === 'model/obj')) ||
        !w.assets.some((a) => a.id === m.texture && ['image/png', 'image/jpeg'].includes(a.type)))
    )
      throw Error('Primitive/OBJ textures must be PNG/JPEG assets uploaded to this world');
  for (const asset of Object.values(c.terrainTextures))
    if (!w.assets.some((a) => a.id === asset && ['image/png', 'image/jpeg'].includes(a.type)))
      throw Error('Choose an uploaded terrain image');
  if (new Set(c.ambience.map((z) => z.id)).size !== c.ambience.length)
    throw Error('Duplicate audio zone');
  for (const zone of c.ambience) {
    if (zone.object && !c.objects.some((o) => o.id === zone.object))
      throw Error('Audio object is missing');
    if (
      zone.source === 'asset' &&
      !w.assets.some((a) => a.id === zone.asset && a.type === 'audio/mpeg')
    )
      throw Error('Choose uploaded MP3 audio');
  }
  const models = new Set(c.models.map((m) => m.id));
  for (const s of w.landscape?.scatter ?? [])
    if (!c.models.some((m) => m.id === s.model)) throw Error('Model is used by landscape scatter');
  for (const o of c.objects)
    if (!models.has(o.model)) throw Error('Object refers to a missing model');
  for (const model of [...Object.values(c.vehicleModels), ...Object.values(c.resourceModels)])
    if (!models.has(model)) throw Error('Vehicle refers to a missing model');
  for (const b of w.buildings)
    if (b.creatorModel && !models.has(b.creatorModel))
      throw Error('Unbind this model from its building before removing it');
  for (const t of Object.values(w.catalogue?.templates ?? {}))
    if (t.creatorModel && !models.has(t.creatorModel))
      throw Error('Unbind the template visual before removing its model');
  const targets = new Set([...c.objects, ...w.zones, ...w.buildings].map((v) => v.id));
  for (const r of c.rules) {
    if (['enter', 'interact'].includes(r.event) && !targets.has(r.target))
      throw Error('Choose an existing object, building or zone for this rule');
    if (r.event === 'timer' && r.cooldown < 5)
      throw Error('Timers run at most once every five seconds');
    for (const e of r.effects)
      if (e.type === 'visibility' && !c.objects.some((o) => o.id === e.object))
        throw Error('Visibility effect refers to a missing object');
  }
  if (
    Math.hypot(c.arena.bases[0].x - c.arena.bases[1].x, c.arena.bases[0].z - c.arena.bases[1].z) <
    20
  )
    throw Error('Team bases must be at least 20 metres apart');
  return c;
}
const eventQueues = new WeakMap<
  World,
  { event: string; data: Record<string, string | number> }[]
>();
export function queueCreatorScript(w: World, event: string, data: Record<string, string | number>) {
  if (!w.script.includes(event)) return;
  const queue = eventQueues.get(w) ?? [];
  if (queue.length < 32)
    queue.push({
      event,
      data: {
        ...data,
        ...(typeof data.id === 'string' && w.players[data.id]
          ? { life: w.players[data.id].deaths }
          : {}),
      },
    });
  eventQueues.set(w, queue);
}
export function drainCreatorScripts(w: World) {
  const q = eventQueues.get(w) ?? [];
  eventQueues.delete(w);
  return q;
}
const runtimes = new WeakMap<
  World,
  { second: number; inside: Set<string>; times: Map<string, number> }
>();
function runtime(w: World) {
  let r = runtimes.get(w);
  if (!r) {
    r = { second: -1, inside: new Set(), times: new Map() };
    runtimes.set(w, r);
  }
  return r;
}
export function resetCreatorRuntime(w: World) {
  runtimes.delete(w);
}
export function validateEffect(w: World, effect: unknown) {
  const e = effectSchema.parse(effect);
  if (e.type === 'item' && !Object.hasOwn(worldItems(w), e.item)) throw Error('Unknown world item');
  return e;
}
export function applyEffect(w: World, p: Player | undefined, effect: Effect) {
  const e = validateEffect(w, effect),
    items = worldItems(w);
  if (e.type === 'message') say(w, 'World behavior', e.text, 'notice', p?.id);
  else if (e.type === 'visibility') {
    const o = w.creator?.objects.find((o) => o.id === e.object);
    if (o && o.visible !== e.visible) {
      o.visible = e.visible;
      w.revision++;
    }
  } else if (e.type === 'score') {
    const team = e.team === -1 ? p?.team : e.team;
    if (team === 0 || team === 1) {
      const scores = w.combat?.scores ?? w.scores;
      scores[team] = Math.max(0, scores[team] + e.amount);
    }
  } else if (p) {
    if (e.type === 'heal') p.health = Math.max(1, Math.min(maximumHealth(p), p.health + e.amount));
    if (e.type === 'needs') {
      p.hunger = Math.max(0, Math.min(50000, p.hunger + e.amount));
      p.thirst = Math.max(0, Math.min(50000, p.thirst + e.amount));
    }
    if (e.type === 'teleport' && !p.task && !p.atHome && !p.hitch && !p.crowBody) {
      p.x = e.x;
      p.z = e.z;
      p.y = terrainHeight(w, e.x, e.z);
      p.speed = 0;
    }
    if (e.type === 'item') {
      const have = p.inventory[e.item] ?? 0;
      const weight = Object.entries(p.inventory).reduce(
        (n, [key, q]) => n + (items[key]?.weight ?? 0) * q,
        0,
      );
      const capacity = vehicles[p.vehicle].capacity;
      if (
        have + e.quantity >= 0 &&
        (e.quantity <= 0 || weight + items[e.item].weight * e.quantity <= capacity)
      )
        p.inventory[e.item] = have + e.quantity;
    }
  }
}
export function creatorEvent(w: World, event: CreatorRule['event'], p: Player, target = '') {
  const rt = runtime(w);
  const scriptName = (
    {
      interact: 'ObjectInteract',
      enter: 'ZoneEnter',
      task: 'TaskComplete',
      login: 'PlayerLogin',
      timer: '',
    } as const
  )[event];
  if (scriptName && event !== 'login') queueCreatorScript(w, scriptName, { id: p.id, target });
  for (const r of w.creator?.rules ?? []) {
    if (
      !r.enabled ||
      r.event !== event ||
      (['enter', 'interact', 'task'].includes(event) && !!r.target && r.target !== target) ||
      (r.team !== -1 && r.team !== p.team) ||
      (r.requiredItem && !(p.inventory[r.requiredItem] > 0))
    )
      continue;
    const key = r.id + ':' + p.id;
    if (w.time - (rt.times.get(key) ?? -Infinity) < r.cooldown) continue;
    rt.times.set(key, w.time);
    for (const effect of r.effects) applyEffect(w, p, effect);
  }
}
export function tickCreator(w: World) {
  const scripted = w.script.includes('ZoneEnter');
  if (
    !scripted &&
    !w.creator?.rules.some((r) => r.enabled && (r.event === 'enter' || r.event === 'timer'))
  )
    return;
  const rt = runtime(w),
    second = Math.floor(w.time);
  if (rt.second === second) return;
  rt.second = second;
  const targets = new Set([
    ...(w.creator?.rules.filter((r) => r.enabled && r.event === 'enter').map((r) => r.target) ??
      []),
    ...(scripted ? w.zones.map((z) => z.id) : []),
  ]);
  const inside = new Set<string>();
  for (const p of Object.values(w.players).filter((p) => p.online && !p.atHome && !p.crowBody)) {
    creatorEvent(w, 'timer', p);
    for (const target of targets) {
      const t =
        w.creator?.objects.find((o) => o.id === target && o.visible) ??
        w.zones.find((z) => z.id === target) ??
        w.buildings.find((b) => b.id === target);
      const key = target + ':' + p.id;
      if (
        t &&
        Math.hypot(t.x - p.x, t.z - p.z) <
          ('radius' in t ? t.radius * ('scale' in t ? t.scale : 1) : 12) &&
        Math.abs(p.y - terrainHeight(w, t.x, t.z)) < 10
      ) {
        inside.add(key);
        if (!rt.inside.has(key)) creatorEvent(w, 'enter', p, target);
      }
    }
  }
  rt.inside = inside;
  if (rt.times.size > 8192) rt.times.clear();
}
export function creatorBlocks(w: World, x: number, z: number, y: number, padding: number) {
  return creatorBlocksSegment(w, { x, y, z }, { x, y, z }, padding);
}
/** Swept cylinder bounds keep fast vehicles and rounds from tunnelling through small props. */
export function creatorBlocksSegment(
  w: World,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  padding: number,
  allowEscape = false,
) {
  return (
    landscapeBlocks(w, from, to, padding, allowEscape) ||
    [...(w.creator?.objects ?? []), ...scatterObjects(w)].some((o) => {
      if (!o.visible || !o.solid) return false;
      const radius = o.radius * o.scale + padding,
        dx = to.x - from.x,
        dz = to.z - from.z,
        length = dx * dx + dz * dz;
      const startDistance = Math.hypot(from.x - o.x, from.z - o.z);
      if (
        allowEscape &&
        startDistance < radius &&
        Math.hypot(to.x - o.x, to.z - o.z) > startDistance
      )
        return false;
      const t = length
        ? Math.max(0, Math.min(1, ((o.x - from.x) * dx + (o.z - from.z) * dz) / length))
        : 0;
      const y = from.y + (to.y - from.y) * t,
        bottom = terrainHeight(w, o.x, o.z) + o.y;
      return (
        Math.hypot(from.x + t * dx - o.x, from.z + t * dz - o.z) < radius &&
        y >= bottom - 2 &&
        y < bottom + (w.creator!.models.find((m) => m.id === o.model)?.height ?? 4) * o.scale
      );
    })
  );
}
export function creatorAction(w: World, p: Player, a: Action) {
  if (a.type === 'interactObject') {
    const o =
      w.creator?.objects.find((o) => o.id === a.object && o.visible) ??
      w.buildings.find((b) => b.id === a.object);
    if (
      !o ||
      Math.hypot(p.x - o.x, p.z - o.z) > ('radius' in o ? o.radius * o.scale : 0) + 12 ||
      p.atHome ||
      p.task ||
      p.crowBody
    )
      throw Error('Approach this object to interact');
    creatorEvent(w, 'interact', p, o.id);
    questEvent(w, p, 'interact', o.id);
    return '';
  }
  if (w.owner !== p.id) throw Error('World owner required');
  if (a.type === 'creator') {
    const c = validateCreator(w, a.creator);
    const oldArena = JSON.stringify(w.creator?.arena);
    w.creator = c;
    for (const b of w.buildings)
      if (b.creatorModel) {
        const m = c.models.find((m) => m.id === b.creatorModel)!;
        b.creatorBounds = { width: m.width, depth: m.depth, height: m.height };
      }
    // Editing a running arena starts a fresh match, never leaves stale carriers.
    if (w.combat && JSON.stringify(c.arena) !== oldArena) {
      delete w.combat;
      for (const q of Object.values(w.players))
        if (q.game === 'combat') {
          delete q.game;
          delete q.weaponCharge;
        }
      w.projectiles = [];
    }
    resetCreatorRuntime(w);
    w.revision++;
    return 'World workshop saved.';
  }
  if (a.type === 'creatorRemove') {
    if (a.kind === 'zone') {
      w.zones = w.zones.filter((z) => z.id !== a.id);
      if (w.creator) w.creator.rules = w.creator.rules.filter((r) => r.target !== a.id);
    } else if (a.kind === 'terrain') {
      const n = Number(a.id);
      if (!Number.isInteger(n) || n < 0 || n >= w.terrain.length) throw Error('Unknown brush');
      w.terrain.splice(n, 1);
    } else throw Error('Unknown layout type');
    w.revision++;
    return 'Layout updated.';
  }
  if (a.type === 'creatorRecipe') {
    const b = w.buildings.find((b) => b.id === a.building);
    if (!b || b.kind === 'farm') throw Error('Choose a production building; farms use crop plots');
    const recipe = creatorRecipeSchema.parse(a.recipe);
    validateRecipe(w, recipe);
    if (Object.values(recipe.outputs).reduce((n, q) => n + q, 0) > b.capacity)
      throw Error('Output batch exceeds building storage');
    b.production = { ...recipe, tier: 0 };
    b.progress = 0;
    w.revision++;
    return 'Production recipe saved.';
  }
  if (a.type === 'creatorBuilding') {
    const b = w.buildings.find((b) => b.id === a.building);
    if (!b) throw Error('Unknown building');
    const patch = z
      .object({
        name: name.optional(),
        x: coordinate.optional(),
        z: coordinate.optional(),
        rotation: z.number().min(-360).max(360).optional(),
        model: z.string().max(64).optional(),
      })
      .parse(a.patch);
    const model = patch.model ? w.creator?.models.find((m) => m.id === patch.model) : undefined;
    if (patch.model && !model) throw Error('Unknown model');
    if ((patch.x !== undefined && patch.x !== b.x) || (patch.z !== undefined && patch.z !== b.z)) {
      if (
        Object.values(w.players).some(
          (q) => (q.atHome && q.home === b.id) || q.task?.building === b.id,
        )
      )
        throw Error('Wait until occupants and workers leave before moving this building');
    }
    if (patch.name) b.name = patch.name;
    if (patch.x !== undefined) b.x = patch.x;
    if (patch.z !== undefined) b.z = patch.z;
    if (patch.rotation !== undefined) b.rotation = (patch.rotation * Math.PI) / 180;
    if (patch.model !== undefined) {
      const m = w.creator?.models.find((m) => m.id === patch.model);
      if (patch.model && !m) throw Error('Unknown model');
      b.creatorModel = m?.id;
      b.creatorBounds = m ? { width: m.width, depth: m.depth, height: m.height } : undefined;
    }
    w.revision++;
    return 'Building updated.';
  }
  throw Error('Unknown creator action');
}

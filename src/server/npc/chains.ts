// SPDX-License-Identifier: GPL-3.0-or-later
import { worldBuildings, worldItems } from '../../shared/world-catalogue.ts';
import { recipes } from '../../shared/catalog.ts';
import { crops } from '../../shared/farming.ts';
import { gatheringSites } from '../../shared/resources.ts';
import { nearestWaterworksSite } from '../../shared/shoreline.ts';
import { distance } from '../../shared/simulation.ts';
import type { Building, Player, Recipe, World } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { travelPrep, livingReserve } from './travel.ts';
import { operation } from './player-operations.ts';
import { anotherFounding } from './cooperation.ts';
import { blockedStep } from './recovery.ts';

const civicKinds = new Set([
  'market',
  'school',
  'pub',
  'garage',
  'workhouse',
  'starport',
  'bank',
  'town',
  'home',
  'warehouse',
]);

export type ResidentNeed = 'food' | 'drink' | 'fuel' | false;

export type GoodLink = {
  item: string;
  producerKinds: string[];
  consumerKinds: string[];
  gather: boolean;
  farmCrop: boolean;
  residentNeed: ResidentNeed;
  construction: boolean;
};

export function kindRecipe(w: World, kind: string): Recipe | undefined {
  const template = w.catalogue?.templates[kind];
  if (template?.production) return template.production;
  const def = worldBuildings(w)[kind];
  return def?.recipe ? recipes[def.recipe] : undefined;
}

function buildingRecipe(b: Building): Recipe | undefined {
  return b.production ?? recipes[b.recipe ?? ''];
}

function residentNeed(
  def: { food?: number; drink?: number; fuel?: number } | undefined,
): ResidentNeed {
  if (!def) return false;
  if (def.food) return 'food';
  if (def.drink) return 'drink';
  if (def.fuel) return 'fuel';
  return false;
}

/** Sources and sinks for every good, from recipes, farms, gathering, construction and needs. */
export function recipeGraph(w: World): Record<string, GoodLink> {
  const items = worldItems(w);
  const graph: Record<string, GoodLink> = {};
  const link = (item: string): GoodLink =>
    (graph[item] ??= {
      item,
      producerKinds: [],
      consumerKinds: [],
      gather: false,
      farmCrop: false,
      residentNeed: residentNeed(items[item]),
      construction: false,
    });
  for (const item of Object.keys(items)) link(item);
  for (const [kind, def] of Object.entries(worldBuildings(w))) {
    const recipe = kindRecipe(w, kind);
    if (recipe) {
      for (const item of Object.keys(recipe.outputs)) {
        const row = link(item);
        if (!row.producerKinds.includes(kind)) row.producerKinds.push(kind);
      }
      for (const item of Object.keys(recipe.inputs)) {
        const row = link(item);
        if (!row.consumerKinds.includes(kind)) row.consumerKinds.push(kind);
      }
    }
    for (const item of Object.keys(def.materials ?? {})) {
      link(item).construction = true;
    }
  }
  for (const crop of Object.keys(crops)) {
    const row = link(crop);
    row.farmCrop = true;
    if (!row.producerKinds.includes('farm')) row.producerKinds.push('farm');
  }
  for (const item of Object.keys(gatheringSites)) link(item).gather = true;
  return graph;
}

export function pickBuildSite(w: World, p: Player, kind: string) {
  if (kind === 'waterworks') return nearestWaterworksSite(w, p);
  return [
    { x: p.x + 24, z: p.z },
    { x: p.x - 24, z: p.z },
    { x: p.x, z: p.z - 24 },
    { x: 90, z: -110 },
    { x: -90, z: -110 },
  ].find(
    (v) =>
      Math.abs(v.x) < 230 &&
      v.z > -230 &&
      v.z < 115 &&
      w.buildings.every((b) => distance(v, b) > 20) &&
      !w.zones.some((z) => z.kind === 'noBuild' && distance(v, z) < z.radius),
  );
}

function localProducers(w: World, item: string, graph: Record<string, GoodLink>) {
  return w.buildings.filter((b) => {
    if (b.construction) return false;
    if (b.kind === 'farm' && graph[item]?.farmCrop) return true;
    const recipe = buildingRecipe(b);
    return !!(recipe && recipe.outputs[item]);
  });
}

function localConsumers(w: World, item: string) {
  return w.buildings.filter((b) => {
    if (b.construction) return false;
    const recipe = buildingRecipe(b);
    return !!(recipe && recipe.inputs[item]);
  });
}

function inputAvailable(w: World, item: string, graph: Record<string, GoodLink>) {
  if (localProducers(w, item, graph).length) return true;
  if (graph[item]?.gather) return true;
  if (graph[item]?.farmCrop && w.buildings.some((b) => b.kind === 'farm' && !b.construction))
    return true;
  return w.buildings.some(
    (b) => !b.construction && (b.stock[item] ?? 0) > 0 && (b.sell[item] ?? 0) > 0,
  );
}

function foundingSteps(w: World, p: Player, kind: string): Step[] | undefined {
  const def = worldBuildings(w)[kind];
  if (!def || def.tier > w.tier || p.cash <= def.price + 20000) return;
  const location = pickBuildSite(w, p, kind);
  if (!location) return;
  const owned = w.buildings.filter(
    (b) => b.owner === p.id && !['home', 'warehouse'].includes(b.kind),
  ).length;
  if (owned >= w.settings.maxBuildings) return;
  return [
    ...travelPrep(p),
    { kind: 'move', ...location },
    operation('construct', {
      kind,
      ...(kind === 'waterworks' ? location : {}),
    }),
  ];
}

/** One legal next step per parish gap: found a missing kind, or post a missing bid. */
export function inventChainPlans(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  const ideas: FarmerChoice[] = [];
  const graph = recipeGraph(w);
  const add = (description: string, plan: Step[]) => {
    if (
      plan.length < 1 ||
      plan.length > 12 ||
      plan.some((s) => blockedStep(state.recovery, s, w.time))
    )
      return;
    ideas.push({
      id: `chain_${ideas.length}`,
      description,
      plan,
      reconsiderSeconds: 180,
    });
  };

  const unfinished = w.buildings.some((b) => b.owner === p.id && b.construction);
  if (!unfinished) {
    type Candidate = { kind: string; item: string; score: number; reason: string };
    const found: Candidate[] = [];
    for (const [kind, def] of Object.entries(worldBuildings(w))) {
      if (civicKinds.has(kind) || def.tier > w.tier) continue;
      const recipe = kindRecipe(w, kind);
      if (!recipe) continue;
      if (w.buildings.some((b) => b.kind === kind)) continue;
      if (anotherFounding(w, p, kind)) continue;
      const outputs = Object.keys(recipe.outputs);
      const localSink = outputs.some((item) => localConsumers(w, item).length > 0);
      const needSink = outputs.some((item) => graph[item]?.residentNeed);
      const constructionSink = outputs.some((item) => graph[item]?.construction);
      if (!localSink && !needSink && !constructionSink) continue;
      const inputsReady = Object.keys(recipe.inputs).every((item) =>
        inputAvailable(w, item, graph),
      );
      if (!inputsReady && !needSink) continue;
      const item = outputs.find((i) => localConsumers(w, i).length) ?? outputs[0];
      const reason = localSink
        ? `${item} is needed by local shops that cannot make it`
        : needSink
          ? `${item} is needed for ${graph[item]?.residentNeed || 'daily life'}`
          : `${item} is used to build`;
      found.push({
        kind,
        item,
        score: localSink ? 3 : needSink ? 2 : 1,
        reason,
      });
    }
    found.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    for (const c of found) {
      if (seen.has(c.kind) || seen.size >= 8) continue;
      const plan = foundingSteps(w, p, c.kind);
      if (!plan) continue;
      seen.add(c.kind);
      const def = worldBuildings(w)[c.kind];
      add(
        `Found a ${def.name}: ${c.reason}. Base ${def.price} plus town tax and materials; an unfinished site earns nothing.`,
        plan,
      );
    }
  }

  const items = worldItems(w);
  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    const recipe = buildingRecipe(b);
    if (!recipe || b.kind === 'farm') continue;
    for (const item of Object.keys(recipe.inputs)) {
      if ((b.buy[item] ?? 0) > 0) continue;
      if (!localProducers(w, item, graph).length && !inputAvailable(w, item, graph)) continue;
      const price = b.buy[item] || worldBuildings(w)[b.kind]?.buy[item] || items[item]?.price;
      if (!price) continue;
      const deposit = Math.min(
        10000,
        Math.max(price * 4, 2000),
        Math.max(0, p.cash - (p.hunger >= 25000 || p.thirst >= 25000 ? 0 : livingReserve(w, p))),
      );
      const steps: Step[] = [
        ...travelPrep(p),
        ...(distance(p, b) >= 14 ? [{ kind: 'travel' as const, destination: b.id }] : []),
        operation('buildingAdmin', { building: b.id, item, side: 'buy', price }),
      ];
      if (deposit >= price && b.investment < price)
        steps.push({
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'deposit', amount: deposit },
        });
      add(
        `Close the ${item} loop: post a ${item} bid of ${price} at my ${b.name} so neighbours can sell here.`,
        steps,
      );
    }
  }

  return ideas;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import {
  worldResources,
  gatheringStatus,
  gatheringImplements,
  resourceAmount,
} from '../../shared/resources.ts';
import { terrainHeight } from '../../shared/terrain.ts';
import { travelPrep } from './travel.ts';
import type { Step } from './decision.ts';
import { buildingDesignQuote } from '../../shared/building-designs';
import { herdSpec } from '../../shared/livestock.ts';
import { worldBuildings, worldItems } from '../../shared/world-catalogue.ts';
import { recipes } from '../../shared/catalog.ts';
import { constructionTerms } from '../../shared/civics.ts';
import { canCarry } from '../../shared/simulation.ts';
import type { World, Player } from '../../shared/types.ts';
import { householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

/** Raw construction materials can be gathered using a bought or owned implement.
 * Resource locations are public; shop stock still comes only from the caller's known markets. */
function materialGather(w: World, p: Player, item: string) {
  const implement = gatheringImplements[item];
  if (!implement) return;
  const tool = implement.item;
  const shop =
    (p.inventory[tool] ?? 0) > 0
      ? undefined
      : w.buildings
          .filter(
            (b) => !b.construction && b.stock[tool] > 0 && (b.owner === p.id || b.sell[tool] >= 0),
          )
          .sort(
            (a, b) => (a.owner === p.id ? 0 : a.sell[tool]) - (b.owner === p.id ? 0 : b.sell[tool]),
          )[0];
  if (!(p.inventory[tool] > 0) && !shop) return;
  const inventory = { ...p.inventory, [tool]: Math.max(1, p.inventory[tool] ?? 0) };
  for (const node of worldResources(w)
    .filter((n) => n.item === item)
    .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))) {
    if (terrainHeight(w, node.x, node.z) <= w.settings.seaLevel) continue;
    const status = gatheringStatus(
      w,
      { ...p, x: node.x, z: node.z, y: terrainHeight(w, node.x, node.z), inventory },
      node,
    );
    if (status.reason) continue;
    return { node, status, shop, tool, cost: shop && shop.owner !== p.id ? shop.sell[tool] : 0 };
  }
}

/** A foundation is not a business. Budget known material offers, tax, household
 * costs and initial production funding before committing to a construction site. */
export function constructionBudget(
  w: World,
  p: Player,
  kind: string,
  site: { x: number; z: number },
  style?: string,
) {
  const source = worldBuildings(w)[kind];
  if (!source) return;
  const def = {
    ...source,
    ...buildingDesignQuote(w.catalogue?.templates[kind]?.base ?? kind, source, style),
  };
  let materialCost = 0;
  for (const [item, total] of Object.entries(def.materials ?? {})) {
    let missing = Math.max(0, total - (p.inventory[item] ?? 0));
    const shops = w.buildings
      .filter(
        (b) =>
          !b.construction && (b.owner === p.id || b.sell[item] >= 0) && (b.stock[item] ?? 0) > 0,
      )
      .sort(
        (a, b) => (a.owner === p.id ? 0 : a.sell[item]) - (b.owner === p.id ? 0 : b.sell[item]),
      );
    for (const b of shops) {
      const n = Math.min(missing, b.stock[item]);
      materialCost += n * (b.owner === p.id ? 0 : b.sell[item]);
      missing -= n;
    }
    if (missing) {
      const gather = materialGather(w, p, item);
      if (!gather || resourceAmount(w, gather.node) < missing) return;
      materialCost += gather.cost;
    }
  }
  let tax: number;
  try {
    tax = constructionTerms(w, p, kind, site, def.price).tax;
  } catch {
    return;
  }
  const recipe =
    w.catalogue?.templates[kind]?.production ?? (def.recipe ? recipes[def.recipe] : undefined);
  // Empty sheds cannot produce: account for the initial breeding herd as well
  // as construction materials. Only observed, available animals are budgeted.
  const herd = herdSpec({ kind });
  let livestockCost = 0;
  if (herd) {
    let missing = Math.max(0, herd.minimum - (p.inventory[herd.animal] ?? 0));
    const shops = w.buildings
      .filter(
        (b) =>
          !b.construction &&
          b.owner !== p.id &&
          b.sell[herd.animal] >= 0 &&
          b.stock[herd.animal] > 0,
      )
      .sort((a, b) => a.sell[herd.animal] - b.sell[herd.animal]);
    for (const b of shops) {
      const n = Math.min(missing, b.stock[herd.animal]);
      livestockCost += n * b.sell[herd.animal];
      missing -= n;
    }
    if (missing) return;
  }
  const operating = recipe
    ? 3 *
      (def.wage * (def.idealEmployees ?? 1) +
        Object.entries(recipe.inputs).reduce(
          (sum, [item, n]) => sum + n * (def.buy[item] || worldItems(w)[item]?.price || 0),
          0,
        ))
    : 0;
  const living = householdBudget(w, p, 86400).reserve;
  return {
    materialCost,
    tax,
    operating,
    livestockCost,
    living,
    total: def.price + tax + Math.ceil(materialCost * 1.1) + operating + livestockCost + living,
  };
}

/** One fresh procurement/delivery leg at a time; ordinary stock and construction
 * actions retain all ownership, capacity, price and location checks. */
export function constructionChoices(w: World, p: Player): FarmerChoice[] {
  const result: FarmerChoice[] = [];
  for (const b of w.buildings.filter((b) => b.owner === p.id && b.construction)) {
    const goal = {
      kind: b.kind === 'home' ? ('housing' as const) : ('business' as const),
      target: b.id,
    };
    const carried = Object.entries(b.construction!).some(
      ([item, need]) => need > 0 && (p.inventory[item] ?? 0) > 0,
    );
    if (carried) {
      result.push({
        id: `finish_${b.id}`,
        description: `Finish my ${b.name}: deliver construction materials already aboard.`,
        careerGoal: goal,
        plan: visitBuilding(p, b, [operation('supply', { building: b.id })]),
      });
      continue;
    }
    for (const [item, need] of Object.entries(b.construction!)) {
      if (need <= 0) continue;
      const shops = w.buildings
        .filter(
          (s) =>
            !s.construction && (s.stock[item] ?? 0) > 0 && (s.owner === p.id || s.sell[item] >= 0),
        )
        .sort(
          (a, b) => (a.owner === p.id ? 0 : a.sell[item]) - (b.owner === p.id ? 0 : b.sell[item]),
        );
      const shop = shops[0];
      if (!shop) {
        const gather = materialGather(w, p, item);
        if (!gather || gather.cost > Math.max(0, p.cash - householdBudget(w, p).reserve)) continue;
        const prep: Step[] = gather.shop
          ? visitBuilding(p, gather.shop, [
              {
                kind: 'act',
                action:
                  gather.shop.owner === p.id
                    ? {
                        type: 'stock',
                        building: gather.shop.id,
                        item: gather.tool,
                        quantity: 1,
                        direction: 'withdraw',
                      }
                    : {
                        type: 'trade',
                        building: gather.shop.id,
                        item: gather.tool,
                        quantity: 1,
                        direction: 'buy',
                      },
              },
            ])
          : travelPrep(p);
        result.push({
          id: `finish_gather_${b.id}_${item}`,
          description: `Finish my ${b.name}: gather ${gather.status.amount} ${item} with ${gather.tool}, then deliver it. Implement cost ${gather.cost}.`,
          careerGoal: goal,
          plan: [
            ...prep,
            { kind: 'move', x: gather.node.x, z: gather.node.z },
            { kind: 'act', action: { type: 'gather', node: gather.node.id } },
            { kind: 'wait', seconds: gather.status.seconds + 1 },
            { kind: 'travel', destination: b.id },
            operation('supply', { building: b.id }),
          ],
        });
        break;
      }
      const own = shop.owner === p.id;
      const price = own ? 0 : shop.sell[item];
      const surplus = Math.max(0, p.cash - householdBudget(w, p).reserve);
      let quantity = Math.min(
        need,
        20,
        shop.stock[item],
        price ? Math.floor(surplus / price) : need,
      );
      while (quantity > 0 && !canCarry(p, item, quantity, w)) quantity--;
      if (!quantity) continue;
      result.push({
        id: `finish_${b.id}_${item}`,
        description: `Finish my ${b.name}: obtain ${quantity} ${item} for ${quantity * price} and deliver it.`,
        careerGoal: goal,
        plan: [
          ...visitBuilding(p, shop, [
            {
              kind: 'act',
              action: own
                ? { type: 'stock', building: shop.id, item, quantity, direction: 'withdraw' }
                : { type: 'trade', building: shop.id, item, quantity, direction: 'buy' },
            },
          ]),
          { kind: 'travel', destination: b.id },
          operation('supply', { building: b.id }),
        ],
      });
      break;
    }
  }
  return result;
}

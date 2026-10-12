// SPDX-License-Identifier: GPL-3.0-or-later
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

/** A foundation is not a business. Budget known material offers, tax, household
 * costs and initial production funding before committing to a construction site. */
export function constructionBudget(
  w: World,
  p: Player,
  kind: string,
  site: { x: number; z: number },
) {
  const def = worldBuildings(w)[kind];
  if (!def) return;
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
    if (missing) return;
  }
  let tax: number;
  try {
    tax = constructionTerms(w, p, kind, site).tax;
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
      if (!shop) continue;
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

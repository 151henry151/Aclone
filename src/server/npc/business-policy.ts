import { settleBusinessProceeds } from './business-freight.ts';
import { farmPlotCount } from '../../shared/farm-land.ts';
import { livestockSupplyInputs } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../../shared/types.ts';
import { worldBuildings } from '../../shared/world-catalogue.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { crops } from '../../shared/farming.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { portableReserve } from './cargo.ts';
import { recipes } from '../../shared/catalog.ts';
import {
  productionStaff,
  productionStaffing,
  productionEfficiency,
} from '../../shared/sound-state.ts';
import { taxTown } from '../../shared/town-charter.ts';
import { productionInterval, distance, canCarry } from '../../shared/simulation.ts';
import { household, householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import { blockedStep } from './recovery.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';

/** Separate shop retail receipts from direct wholesale export. Tax is withheld
 * from shop receipts, not added to a player's posted purchase price. */
export function productionBudget(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm') return;
  const tax = Math.min(1, w.settings.salesTax + (taxTown(w, b.x, b.z)?.salesTax ?? 0));
  const inputs = Object.entries(livestockSupplyInputs(w, b, recipe.inputs)).reduce(
    (sum, [item, n]) => sum + n * (b.buy[item] || worldItems(w)[item]?.price || 0),
    0,
  );
  const retailReceipts = Object.entries(recipe.outputs).reduce(
    (sum, [item, n]) => sum + Math.floor(n * (b.sell[item] ?? 0) * (1 - tax)),
    0,
  );
  const next = (Math.floor(w.time / productionInterval(w, b)) + 1) * productionInterval(w, b);
  const staff = productionStaff(w, b, next).length;
  const payroll = b.wage * Math.max(1, staff);
  const idealWorkers = productionStaffing(w, b, staff, next).ideal;
  return {
    inputs,
    retailReceipts,
    payroll,
    margin: retailReceipts - inputs - payroll,
    oneWorkerMargin: retailReceipts - inputs - b.wage,
    reserve: Math.ceil((inputs + b.wage * Math.max(idealWorkers, staff)) * 3),
    activeWorkers: staff,
    idealWorkers,
    idealMargin: retailReceipts - inputs - b.wage * idealWorkers,
    efficiency: productionEfficiency(w, b, staff, next),
  };
}
/** Renew useful workers; fill vacancies only up to the ideal active crew. Farms
 * have independent manual tasks rather than an automatic batch-efficiency curve. */
export function usefulShift(w: World, p: Player, b: Building) {
  if (b.kind === 'farm') return true;
  const interval = productionInterval(w, b),
    next = (Math.floor(w.time / interval) + 1) * interval;
  const staff = productionStaff(w, b, next);
  const index = staff.findIndex((q) => q.id === p.id);
  const current = productionStaffing(w, b, staff.length, next);
  if (index >= 0) return index < current.ideal - Number(current.ownerOperating);
  const others = staff.length;
  const crew = productionStaffing(w, b, others, next);
  return crew.active < crew.ideal;
}

/** Keep enough cash in the business before paying its owner for household needs. */
export function retainedCapital(w: World, b: Building) {
  if (b.kind === 'haybarn') return Math.max(2000, 40 * (b.buy.hay ?? 0));
  return b.kind === 'farm'
    ? farmPlotCount(b) * Math.max(b.wage, ...Object.values(crops).map((c) => c.seed + b.wage))
    : (productionBudget(w, b)?.reserve ?? Math.max(2000, b.wage * 3));
}
export function ownerLivingDraw(w: World, p: Player, b: Building) {
  if (b.owner !== p.id || b.construction || b.government) return 0;
  let target = householdBudget(w, p, 86400).reserve;
  // A viable owner needs somewhere to live. Save toward a modest cottage rather
  // than reinvesting every penny forever; this is a savings target, not a quote.
  const home = worldBuildings(w).home;
  if (!household(w, p) && home)
    target +=
      home.price +
      Object.entries(home.materials ?? {}).reduce(
        (n, [id, quantity]) => n + quantity * (worldItems(w)[id]?.price ?? 0),
        0,
      );
  return Math.min(
    10_000_000,
    Math.max(0, target - p.cash),
    ownerWithdrawable(w, b),
    Math.max(0, b.investment - remainingClaim(b) - retainedCapital(w, b)),
  );
}

/** Maintain a solvent business before discretionary personal spending. */
export function ownerRoutine(w: World, p: Player, state?: ResidentState): Step[] {
  if (p.task || p.learning) return [];
  const settlement = state ? settleBusinessProceeds(w, p, state) : [];
  if (settlement.length) return settlement;
  const living = householdBudget(w, p).reserve;
  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    const draw = ownerLivingDraw(w, p, b);
    if (draw > 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'withdraw', amount: draw },
        },
      ]);
    const budget = productionBudget(w, b);
    if (!budget) continue;
    // Never pour fresh capital into production with a structurally negative margin.
    const amount = Math.min(
      10_000_000,
      Math.max(0, budget.reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (amount > 0 && budget.idealMargin >= 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'deposit', amount },
        },
      ]);
  }
  return [];
}

/** Unload surplus provisions, or ordinary freight that prevents buying a meal.
 * Uses known buyers/owned storage; keeps tools and emergency supplies. */
export function cargoRelief(w: World, p: Player, state?: ResidentState): Step[] {
  const catalogue = worldItems(w);
  const crowded = !canCarry(p, 'water', 2, w) || !canCarry(p, 'bread', 1, w);
  const candidates = Object.entries(p.inventory)
    .flatMap(([item, count]) => {
      const def = catalogue[item];
      if (!def || !count) return [];
      const keep = portableReserve(item, w);
      const excess = count - keep;
      if (excess <= 0 || (!crowded && (!(def.food || def.drink) || excess < 3))) return [];
      return [{ item, excess, weight: def.weight }];
    })
    .sort((a, b) => b.weight * b.excess - a.weight * a.excess);
  for (const { item, excess } of candidates) {
    const candidates = w.buildings
      .filter(
        (b) =>
          !b.construction &&
          !blockedStep(state?.recovery, { kind: 'travel', destination: b.id }, w.time) &&
          (b.stock[item] ?? 0) < b.capacity &&
          (b.owner === p.id || (b.buy[item] > 0 && b.investment >= b.buy[item])),
      )
      .sort((a, b) => distance(p, a) - distance(p, b));
    const b = candidates[0];
    if (!b) continue;
    const own = b.owner === p.id;
    const n = Math.min(
      excess,
      20,
      b.capacity - (b.stock[item] ?? 0),
      own ? Infinity : Math.floor(b.investment / b.buy[item]),
    );
    if (n > 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: own
            ? { type: 'stock', building: b.id, item, quantity: n, direction: 'deposit' }
            : { type: 'trade', building: b.id, item, quantity: n, direction: 'sell' },
        },
      ]);
  }
  return [];
}

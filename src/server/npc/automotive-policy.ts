// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from '../../shared/types';
import { automotiveConfig, automotiveProducts } from '../../shared/automotive-config';
import { automotiveExportQuote } from '../../shared/automotive-exports';
import { automotivePrice } from '../../shared/automotive-sales';
import { manufacturingStaffing } from '../../shared/automotive-manufacturing';
import { factoryIdealEmployees } from '../../shared/staffing';
import { salesReceipt } from '../../shared/taxes';
import { worldItems } from '../../shared/world-catalogue';
import { npcBusinessRules } from '../../shared/npc-business-rules';
import { HIGHWAY_TRACTOR, semiProducts } from '../../shared/highway-definitions';
import { operation } from './player-operations';
import { visitBuilding } from './care';
import { livingReserve } from './travel';
import type { Step } from './decision';
import type { AddChoice } from './economy-choices';

/** A conservative one-line plan against an observable external outlet. This is
 * only advice: assembly still reserves real materials and wages via player actions. */
export function automotiveProduction(w: World, b: Building) {
  if (
    b.kind !== 'automotiveFactory' ||
    b.construction ||
    b.condition <= 0 ||
    b.manufacturing?.orders.length ||
    b.manufacturing?.ready.length
  )
    return;
  const r = automotiveConfig(w),
    ideal = factoryIdealEmployees(w, b);
  return automotiveProducts
    .flatMap((product) => {
      const quote = automotiveExportQuote(w, product),
        recipe = r.products[product];
      if (!quote.available) return [];
      const inputPrice = (item: string) =>
        b.buy[item] || b.pausedPrices?.buy?.[item] || worldItems(w)[item]?.price || 0;
      const inputs = Object.entries(recipe.inputs).reduce(
        (sum, [id, n]) => sum + n * inputPrice(id),
        0,
      );
      const net = salesReceipt(w, b, quote.price).net,
        payroll = ideal * b.wage;
      if (net <= inputs + payroll) return [];
      const batches = Math.min(
        r.factory.readyCapacity,
        quote.available,
        npcBusinessRules(w.settings).npcInputReserveBatches,
      );
      const targets = Object.fromEntries(
        Object.entries(recipe.inputs).map(([id, n]) => [id, Math.min(b.capacity, n * batches)]),
      );
      const reserve =
        Object.entries(targets).reduce(
          (sum, [id, n]) => sum + Math.max(0, n - (b.stock[id] ?? 0)) * inputPrice(id),
          0,
        ) +
        payroll * Math.max(1, npcBusinessRules(w.settings).npcPayrollReserveBatches);
      return [
        {
          product,
          recipe,
          targets,
          inputs,
          payroll,
          net,
          reserve,
          ideal,
          margin: net - inputs - payroll,
          supplied: Object.entries(recipe.inputs).every(([id, n]) => (b.stock[id] ?? 0) >= n),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.supplied) - Number(a.supplied) ||
        b.margin / b.recipe.seconds - a.margin / a.recipe.seconds,
    )[0];
}
export function automotiveBudget(w: World, b: Building) {
  const plan = automotiveProduction(w, b);
  if (!plan) return;
  const crew = manufacturingStaffing(w, b);
  return {
    inputs: plan.inputs,
    retailReceipts: plan.net,
    payroll: plan.payroll,
    margin: plan.margin,
    oneWorkerMargin: plan.net - plan.inputs - b.wage,
    reserve: plan.reserve,
    activeWorkers: crew.active,
    idealWorkers: plan.ideal,
    idealMargin: plan.margin,
    economics: null,
    efficiency: crew.active / plan.ideal,
  };
}
export function automotiveOwnerRoutine(w: World, p: Player): Step[] {
  for (const b of w.buildings) {
    if (b.kind !== 'automotiveFactory' || b.owner !== p.id || b.construction) continue;
    const ready = b.manufacturing?.ready[0];
    if (ready) {
      const quote = automotiveExportQuote(w, ready.product);
      if (quote.available && quote.price > 0)
        return visitBuilding(p, b, [
          operation('manufacturing', {
            building: b.id,
            op: 'export',
            unit: ready.id,
            expectedPrice: quote.price,
          }),
        ]);
    }
    const order = b.manufacturing?.orders[0];
    if (
      order &&
      w.settings.ownerOperation &&
      p.skills.includes(order.skill) &&
      w.settings.activeWork &&
      (b.ownerActiveUntil ?? 0) <= w.time
    )
      return visitBuilding(p, b, [{ kind: 'act', action: { type: 'work', building: b.id } }]);
    const plan = automotiveProduction(w, b);
    if (plan?.supplied && b.investment >= plan.payroll)
      return visitBuilding(p, b, [
        operation('manufacturing', { building: b.id, op: 'queue', product: plan.product }),
      ]);
  }
  return [];
}
export function automotivePurchaseChoices(
  w: World,
  p: Player,
  buildings: Building[],
  add: AddChoice,
  visit: (b: Building, steps: Step[]) => Step[],
) {
  if (
    !automotiveConfig(w).enabled ||
    !buildings.some(
      (b) => b.owner === p.id && !b.construction && !['home', 'warehouse'].includes(b.kind),
    )
  )
    return;
  for (const b of buildings) {
    if (b.kind !== 'automotiveFactory' || b.construction) continue;
    for (const unit of b.manufacturing?.ready ?? []) {
      const price = automotivePrice(w, b, unit.product);
      if (price === null || p.cash - price < livingReserve(w, p)) continue;
      if (
        unit.product === 'tractor'
          ? p.fleet?.includes(HIGHWAY_TRACTOR)
          : !p.fleet?.includes(HIGHWAY_TRACTOR) ||
            Object.values(w.trailers ?? {}).some(
              (t) =>
                t.owner === p.id &&
                semiProducts[t.kind as keyof typeof semiProducts] === unit.product,
            )
      )
        continue;
      add(
        `Buy manufactured ${automotiveConfig(w).products[unit.product].name} from ${b.name} for ${price}. Actual completed unit; empty fuel/cargo. Collection needs clear space. Decide whether this capital purchase serves my business; no future earnings are promised.`,
        visit(b, [
          operation('manufacturing', {
            building: b.id,
            op: 'buy',
            unit: unit.id,
            expectedPrice: price,
          }),
        ]),
      );
    }
  }
}

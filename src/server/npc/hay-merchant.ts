// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { propertyQuote } from '../../shared/property.ts';
import { taxTown } from '../../shared/town-charter.ts';
import { canCarry } from '../../shared/simulation.ts';
import { householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
/** Storage is a merchant business: no imaginary production recipe or paid idle job. */
export function hayMerchantChoices(w: World, p: Player): FarmerChoice[] {
  if (p.task || p.learning) return [];
  const choices: FarmerChoice[] = [],
    living = householdBudget(w, p, 86400).reserve;
  for (const b of w.buildings.filter(
    (b) => b.kind === 'haybarn' && !b.construction && !b.government,
  )) {
    const reserve = 40 * (b.buy.hay ?? 0);
    const add = (description: string, plan: Step[]) =>
      choices.push({
        id: `hay_merchant_${b.id}_${choices.length}`,
        description,
        plan,
        careerGoal: { kind: 'business', target: b.id },
        reconsiderSeconds: 300,
      });
    const tax = Math.min(1, w.settings.salesTax + (taxTown(w, b.x, b.z)?.salesTax ?? 0));
    const supplier = w.buildings
      .filter(
        (s) =>
          s.id !== b.id && s.owner !== p.id && !s.construction && s.stock.hay > 0 && s.sell.hay > 0,
      )
      .sort((a, b) => a.sell.hay - b.sell.hay)[0];
    const customers = w.buildings.some(
      (s) =>
        s.id !== b.id &&
        !s.construction &&
        s.buy.hay > b.sell.hay &&
        s.investment >= s.buy.hay * 10 &&
        (s.stock.hay ?? 0) < 40,
    );
    const margin = b.sell.hay * (1 - tax) - (supplier?.sell.hay ?? Infinity);
    if (b.owner !== p.id) {
      if (
        (!b.owner || b.forSale) &&
        customers &&
        margin > 0 &&
        reserve > 0 &&
        p.cash >= propertyQuote(w, b).total + reserve + living &&
        w.buildings.filter((s) => s.owner === p.id && !['home', 'warehouse'].includes(s.kind))
          .length < w.settings.maxBuildings
      )
        add(
          `Acquire and fund ${b.name}: store seasonal hay for observed livestock customers; preserve household funds.`,
          visitBuilding(p, b, [{ kind: 'act', action: { type: 'buyBuilding', building: b.id } }]),
        );
      continue;
    }
    const deposit = Math.min(
      10_000_000,
      Math.max(0, reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (deposit > 0 && customers && b.sell.hay * (1 - tax) > b.buy.hay)
      add(
        `Fund my ${b.name}: ${deposit} for buying hay, keeping a household reserve.`,
        visitBuilding(p, b, [
          {
            kind: 'act',
            action: { type: 'investment', building: b.id, direction: 'deposit', amount: deposit },
          },
        ]),
      );
    // Retain a modest seasonal buffer rather than filling 3,000 slots speculatively.
    let quantity = Math.min(40 - (b.stock.hay ?? 0), b.capacity - (b.stock.hay ?? 0));
    const held = Math.min(quantity, p.inventory.hay ?? 0);
    if (held > 0)
      add(
        `Supply my ${b.name}: store ${held} carried hay for sale.`,
        visitBuilding(p, b, [
          {
            kind: 'act',
            action: {
              type: 'stock',
              building: b.id,
              item: 'hay',
              quantity: held,
              direction: 'deposit',
            },
          },
        ]),
      );
    else if (supplier && customers && margin > 0) {
      quantity = Math.min(
        quantity,
        supplier.stock.hay,
        Math.floor(Math.max(0, p.cash - living) / supplier.sell.hay),
      );
      while (quantity > 0 && !canCarry(p, 'hay', quantity, w)) quantity--;
      if (quantity > 0)
        add(
          `Supply my ${b.name}: buy ${quantity} hay at ${supplier.name}, store it for livestock customers; estimated retail margin ${Math.floor(margin * quantity)} before travel.`,
          [
            ...visitBuilding(p, supplier, [
              {
                kind: 'act',
                action: {
                  type: 'trade',
                  building: supplier.id,
                  item: 'hay',
                  quantity,
                  direction: 'buy',
                },
              },
            ]),
            { kind: 'travel', destination: b.id },
            {
              kind: 'act',
              action: {
                type: 'stock',
                building: b.id,
                item: 'hay',
                quantity,
                direction: 'deposit',
              },
            },
          ],
        );
    }
  }
  return choices;
}

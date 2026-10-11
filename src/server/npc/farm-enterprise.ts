import { farmPlotCount, farmExpansionCost, farmExpansionBlocker } from '../../shared/farm-land.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { calendar, DAY_SECONDS } from '../../shared/environment.ts';
import { crops, winterDeadline } from '../../shared/farming.ts';
import { canCarry } from '../../shared/simulation.ts';
import { skillLesson } from '../../shared/world-catalogue.ts';
import { taxTown } from '../../shared/town-charter.ts';
import { propertyQuote } from '../../shared/property.ts';
import type { World, Player } from '../../shared/types.ts';
import { householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import { farmDuty, type FarmerChoice } from './farmer.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';

/** Seasonal farms require seed/harvest capital and hands-on plot work. They must
 * not disappear when automatic factory purchases are replaced by costed plans. */
export function farmEnterprises(w: World, p: Player): FarmerChoice[] {
  const choices: FarmerChoice[] = [];
  if (p.task || p.learning) return choices;
  const living = householdBudget(w, p, 86400).reserve;
  for (const b of w.buildings.filter(
    (b) => b.kind === 'farm' && !b.construction && !b.government,
  )) {
    const tax = Math.min(1, w.settings.salesTax + (taxTown(w, b.x, b.z)?.salesTax ?? 0));
    const growing = Object.entries(crops).filter(
      ([item, crop]) =>
        crop.seasons.includes(calendar(w).season) &&
        w.time + crop.days * DAY_SECONDS + 15 < winterDeadline(w.time) &&
        (b.stock[item] ?? 0) + crop.yield <= b.capacity &&
        Math.floor(crop.yield * 0.5) * (b.sell[item] ?? 0) * (1 - tax) > crop.seed + b.wage,
    );
    if (!growing.length && b.owner !== p.id) continue;
    const reserve = farmPlotCount(b) * Math.max(b.wage, ...growing.map(([, c]) => c.seed + b.wage));
    const add = (description: string, plan: Step[]) => {
      if (plan.length && plan.length <= 12)
        choices.push({
          id: `farm_enterprise_${b.id}_${choices.length}`,
          description,
          plan,
          careerGoal: { kind: 'business', target: b.id },
          reconsiderSeconds: 300,
        });
    };
    if (b.owner !== p.id) {
      const count = w.buildings.filter(
        (s) => s.owner === p.id && !['home', 'warehouse'].includes(s.kind),
      ).length;
      const deposit = Math.max(0, reserve - b.investment);
      if (
        (!b.owner || b.forSale) &&
        count < w.settings.maxBuildings &&
        deposit <= 80000 &&
        p.cash >= propertyQuote(w, b).total + deposit + living
      )
        add(
          `Acquire and fund ${b.name}: price ${propertyQuote(w, b).total}, seed and harvest deposit ${deposit}. Seasonal crops require tending, harvesting and buyers; they are not automatic wheat batches.`,
          visitBuilding(p, b, [
            { kind: 'act', action: { type: 'buyBuilding', building: b.id } },
            ...Array.from({ length: Math.ceil(deposit / 10000) }, (_, i): Step => ({
              kind: 'act',
              action: {
                type: 'investment',
                building: b.id,
                direction: 'deposit',
                amount: Math.min(10000, deposit - i * 10000),
              },
            })),
          ]),
        );
      continue;
    }
    const deposit = Math.min(
      10000,
      Math.max(0, reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (deposit)
      add(
        `Fund my ${b.name}: reserve seed and harvest wages for four seasonal plots.`,
        visitBuilding(p, b, [
          {
            kind: 'act',
            action: { type: 'investment', building: b.id, direction: 'deposit', amount: deposit },
          },
        ]),
      );
    // Expand only a busy, funded farm with proven sales and unsatisfied observed demand.
    if (
      b.owner === p.id &&
      p.skills.includes('farmer') &&
      (b.plots ?? []).filter((plot) => plot.crop).length === farmPlotCount(b) &&
      (b.accounts?.receipts ?? 0) > 0 &&
      b.investment >= reserve &&
      p.cash >= living + reserve + farmExpansionCost(b) &&
      !farmExpansionBlocker(w, b) &&
      growing.some(([item]) =>
        w.buildings.some(
          (s) =>
            s.id !== b.id &&
            s.buy[item] > 0 &&
            s.investment >= s.buy[item] * 20 &&
            (s.stock[item] ?? 0) < 20,
        ),
      )
    )
      add(
        `Expand my busy ${b.name} by four plots for ${farmExpansionCost(b)}, preserving household and crop capital.`,
        visitBuilding(p, b, [
          {
            kind: 'act',
            action: { type: 'farm', building: b.id, operation: 'expand', plot: 0, crop: null },
          },
        ]),
      );
    if (p.skills.includes('farmer')) {
      const plan = farmDuty(w, p, b, { plan: [], index: 0 } as unknown as ResidentState);
      add(
        `Supply my ${b.name}: tend or harvest my seasonal plots; owners earn from produce sales, not their own wages.`,
        plan,
      );
    } else {
      const school = w.buildings.find((b) => b.kind === 'school' && !b.construction);
      const lesson = skillLesson(w, p, 'farmer');
      if (school && p.skills.length < w.settings.maxSkills && p.cash >= lesson.price + living)
        add(
          `Supply my ${b.name}: learn farmer so I can tend my own plots.`,
          visitBuilding(p, school, [
            { kind: 'act', action: { type: 'learn', building: school.id, skill: 'farmer' } },
            { kind: 'wait', seconds: 60 },
          ]),
        );
    }
    for (const item of Object.keys(crops)) {
      const buyer = w.buildings
        .filter(
          (s) =>
            s.owner !== p.id &&
            !s.construction &&
            s.buy[item] > 0 &&
            s.investment >= s.buy[item] &&
            (s.stock[item] ?? 0) < s.capacity,
        )
        .sort((a, b) => b.buy[item] - a.buy[item])[0];
      if (!buyer) continue;
      let n = Math.min(
        20,
        b.stock[item] ?? 0,
        buyer.capacity - (buyer.stock[item] ?? 0),
        Math.floor(buyer.investment / buyer.buy[item]),
        Math.floor(10000 / buyer.buy[item]),
      );
      while (n > 0 && !canCarry(p, item, n, w)) n--;
      if (n > 0)
        add(
          `Sell my output: haul ${n} ${item} from ${b.name} to ${buyer.name}, returning receipts to the farm till.`,
          [
            ...visitBuilding(p, b, [
              {
                kind: 'act',
                action: { type: 'stock', building: b.id, item, quantity: n, direction: 'withdraw' },
              },
            ]),
            { kind: 'travel', destination: buyer.id },
            {
              kind: 'act',
              action: { type: 'trade', building: buyer.id, item, quantity: n, direction: 'sell' },
            },
            { kind: 'travel', destination: b.id },
            {
              kind: 'act',
              action: {
                type: 'investment',
                building: b.id,
                amount: n * buyer.buy[item],
                direction: 'deposit',
              },
            },
          ],
        );
    }
  }
  return choices;
}

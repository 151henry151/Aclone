import { jobVacancy } from '../../shared/staffing.ts';
import { livestockSupplyInputs } from '../../shared/livestock.ts';
import { herdSpec } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { propertyQuote } from '../../shared/property.ts';
import type { World, Player, Building } from '../../shared/types.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { items, recipes } from '../../shared/catalog.ts';
import { worldResources, resourceAmount, gatheringImplements } from '../../shared/resources.ts';
import type { Step } from './decision.ts';
import { spareSupplies } from './strategy.ts';
import { inputStockTarget, productionBudget } from './business-policy.ts';
import { workplace, shiftBlocker } from './workplace.ts';
import { travelPrep, livingReserve, affordableLoad } from './travel.ts';
type Act = Extract<Step, { kind: 'act' }>['action'];
export type AddChoice = (description: string, plan: Step[], reconsiderSeconds?: number) => void;
const act = (action: Act): Step => ({ kind: 'act', action });

/** Production uses the same live diagnosis as the worker UI, never personal crafting. */
export function economyChoices(
  w: World,
  p: Player,
  buildings: Building[],
  add: AddChoice,
  visit: (b: Building, steps: Step[]) => Step[],
) {
  for (const b of buildings
    .filter((b) => b.kind !== 'farm' && (b.production || b.recipe))
    .slice(0, 12)) {
    const job = workplace(w, p, b)!;
    const recipe = b.production ?? recipes[b.recipe!];
    if (!recipe) continue;
    if (b.owner !== p.id && job.qualified && !shiftBlocker(w, p, b)) {
      const wait = Math.max(1, Math.min(600, job.nextCycleInSeconds + 1));
      if (job.employedHere) {
        if (
          !job.workActiveNextCycle ||
          (w.settings.activeWork && p.activeUntil - w.time < job.intervalSeconds)
        )
          add(
            `Renew my shift at ${b.name} (${b.id}), then wait for production. ${job.summary}`,
            visit(b, [act({ type: 'work', building: b.id }), { kind: 'wait', seconds: wait }]),
            Math.min(1200, wait + 30),
          );
        else
          add(
            `Keep my active job at ${b.name}; wait ${wait}s for the next production check. ${job.summary}`,
            [{ kind: 'wait', seconds: wait }],
            wait + 5,
          );
      } else if (jobVacancy(w, b, p.id))
        add(
          `Accept employment at ${b.name} (${b.id}), gross wage ${b.wage} per ${job.intervalSeconds}s. ${p.job ? 'This quits my previous job.' : ''} ${job.summary}`,
          visit(b, [
            ...(p.job ? [act({ type: 'quit' })] : []),
            act({ type: 'job', building: b.id }),
            { kind: 'wait', seconds: wait },
          ]),
          Math.min(1200, wait + 30),
        );
    }
    if (b.owner === p.id) {
      const budget = productionBudget(w, b);
      const capital =
        budget && budget.margin >= 0 && budget.idealMargin >= 0
          ? Math.min(
              10_000_000,
              Math.max(0, budget.reserve - b.investment),
              Math.max(0, p.cash - livingReserve(w, p)),
            )
          : 0;
      if (capital > 0)
        add(
          `Invest ${capital} in my ${b.name}, preserving household reserves.`,
          visit(b, [
            act({ type: 'investment', building: b.id, direction: 'deposit', amount: capital }),
          ]),
        );
      for (const [item, quantity] of Object.entries({
        ...livestockSupplyInputs(w, b, recipe.inputs),
        ...(herdSpec(b) ? { [herdSpec(b)!.animal]: herdSpec(b)!.minimum / 2 } : {}),
      })) {
        const missing = Math.min(
          (inputStockTarget(b, item) ?? quantity * 2) - (b.stock[item] ?? 0),
          b.capacity - (b.stock[item] ?? 0),
        );
        const seller = buildings
          .filter(
            (v) =>
              v.owner !== p.id &&
              v.kind !== 'starport' &&
              v.stock[item] > 0 &&
              Number.isSafeInteger(v.sell[item]) &&
              v.sell[item] >= 0,
          )
          .sort((a, b) => a.sell[item] - b.sell[item])[0];
        if (missing > 0 && seller && budget && budget.idealMargin >= 0 && budget.margin >= 0) {
          let load = Math.min(
            missing,
            seller.stock[item],
            seller.sell[item]
              ? affordableLoad(p.cash, seller.sell[item], livingReserve(w, p), missing)
              : missing,
          );
          while (load > 0 && !canCarry(p, item, load, w)) load--;
          if (load > 0)
            add(
              `Supply my ${b.name}: buy and deliver ${load} ${item} from ${seller.name}, cost ${load * seller.sell[item]}, cash left ${p.cash - load * seller.sell[item]}. Building still needs funded workers and output buyers.`,
              [
                ...visit(seller, [
                  act({
                    type: 'trade',
                    building: seller.id,
                    direction: 'buy',
                    item,
                    quantity: load,
                  }),
                ]),
                { kind: 'travel', destination: b.id },
                act({ type: 'stock', building: b.id, direction: 'deposit', item, quantity: load }),
              ],
            );
        }
        const n = Math.min(
          spareSupplies(p, item, w),
          b.capacity - (b.stock[item] ?? 0),
          Math.max(0, (inputStockTarget(b, item) ?? quantity * 4) - (b.stock[item] ?? 0)),
        );
        if (n > 0)
          add(
            `Deposit ${n} carried ${item} into my ${b.name}'s stockroom for production.`,
            visit(b, [
              act({ type: 'stock', building: b.id, direction: 'deposit', item, quantity: n }),
            ]),
          );
      }
      for (const item of Object.keys(recipe.outputs)) {
        let n = Math.min(b.stock[item] ?? 0, 20);
        while (n > 0 && !canCarry(p, item, n, w)) n--;
        if (n > 0)
          add(
            `Collect ${n} ${item} from my ${b.name} for sale or personal use.`,
            visit(b, [
              act({ type: 'stock', building: b.id, direction: 'withdraw', item, quantity: n }),
            ]),
          );
      }
    } else if (
      !b.government &&
      (!b.owner || b.forSale) &&
      p.cash >=
        propertyQuote(w, b).total +
          livingReserve(w, p) +
          (productionBudget(w, b)?.reserve ?? 20000) &&
      w.buildings.filter((v) => v.owner === p.id && !['home', 'warehouse'].includes(v.kind))
        .length < w.settings.maxBuildings
    )
      add(
        `Buy ${b.name} (${b.id}) for ${propertyQuote(w, b).total}, retaining household and business working capital.`,
        visit(b, [act({ type: 'buyBuilding', building: b.id })]),
      );
  }
  // A small, affordable cargo choice per owned recipe; never buy employer inputs already in its stockroom.
  const needed = new Set<string>(
    [...new Set(Object.values(gatheringImplements).map((v) => v.item))].filter(
      (item) => !(p.inventory[item] > 0),
    ),
  );
  for (const b of buildings.filter((b) => b.owner === p.id)) {
    const recipe = b.production ?? recipes[b.recipe ?? ''];
    for (const item of Object.keys(recipe?.inputs ?? {}))
      if (
        (b.stock[item] ?? 0) <
          Math.min(recipe.inputs[item] * 2, inputStockTarget(b, item) ?? Infinity) &&
        !(p.inventory[item] > 0) &&
        (productionBudget(w, b)?.idealMargin ?? -1) >= 0
      )
        needed.add(item);
  }
  for (const item of [...needed].slice(0, 6)) {
    for (const b of buildings
      .filter(
        (b) =>
          b.owner !== p.id &&
          b.kind !== 'starport' &&
          Number.isSafeInteger(b.sell[item]) &&
          b.sell[item] >= 0 &&
          b.stock[item] > 0,
      )
      .slice(0, 1)) {
      const n = Math.min(
        item === 'tools' || Object.values(gatheringImplements).some((v) => v.item === item) ? 1 : 5,
        b.stock[item],
        b.sell[item] ? affordableLoad(p.cash, b.sell[item], livingReserve(w, p), 5) : 5,
      );
      if (n > 0 && canCarry(p, item, n, w))
        add(
          `Buy ${n} ${item} from ${b.name} for ${n * b.sell[item]} for gathering or supplying my business; preserve living cash.`,
          visit(b, [act({ type: 'trade', building: b.id, direction: 'buy', item, quantity: n })]),
        );
    }
  }
  for (const [item, count] of Object.entries(p.inventory)
    .filter(
      ([item, count]) =>
        count > 0 &&
        ![
          'bread',
          'water',
          'fuel',
          'tools',
          'pickaxe',
          'chainsaw',
          'shovel',
          'tackle',
          'rc',
        ].includes(item),
    )
    .slice(0, 8)) {
    const b = buildings.find(
      (b) =>
        b.owner !== p.id &&
        b.buy[item] > 0 &&
        b.investment >= b.buy[item] &&
        (b.stock[item] ?? 0) < b.capacity,
    );
    if (!b) continue;
    const n = Math.min(
      spareSupplies(p, item, w),
      25,
      Math.floor(b.investment / b.buy[item]),
      b.capacity - (b.stock[item] ?? 0),
    );
    if (n <= 0) continue;
    add(
      `Sell ${n} carried ${items[item]?.name ?? item} at ${b.name} for ${n * b.buy[item]}.`,
      visit(b, [act({ type: 'trade', building: b.id, direction: 'sell', item, quantity: n })]),
    );
  }
  for (const n of [...worldResources(w)]
    .sort((a, b) => distance(p, a) - distance(p, b))
    .filter(
      (n) =>
        (p.inventory[gatheringImplements[n.item]?.item] ?? 0) > 0 &&
        resourceAmount(w, n) >=
          (p.skills.includes(n.item === 'logs' ? 'forester' : 'excavator') ? 6 : 3) &&
        !w.buildings.some((b) => distance(b, n) < 12) &&
        canCarry(
          p,
          n.item,
          p.skills.includes(n.item === 'logs' ? 'forester' : 'excavator') ? 6 : 3,
          w,
        ),
    )
    .slice(0, 4)) {
    // Resource travel has a tighter interaction radius; Navigator handles the node ID.
    const prep = travelPrep(p);
    add(`Gather ${n.item} at ${n.id} using the proper implement, capacity and skill rules.`, [
      ...prep,
      { kind: 'travel', destination: n.id },
      act({ type: 'gather', node: n.id }),
      { kind: 'wait', seconds: 20 },
    ]);
  }
  for (const b of buildings.filter((b) => b.kind === 'home' && b.owner === p.id).slice(0, 2))
    if (!p.atHome)
      add(
        `Rest in my home ${b.name}; its stored food supports ordinary home life.`,
        visit(b, [act({ type: 'home', building: b.id }), { kind: 'wait', seconds: 300 }]),
        600,
      );
  if (p.atHome) add('Go outside my home to resume work or travel.', [act({ type: 'outside' })]);
  const bank = buildings.find((b) => b.kind === 'bank');
  const reserve = Math.max(40000, livingReserve(w, p));
  const deposit = Math.min(10_000_000, Math.floor(Math.max(0, p.cash - reserve) / 2));
  if (bank && deposit >= 1000)
    add(
      `Deposit ${deposit / 100}d of spare cash at the bank; retain living and opportunity funds.`,
      visit(bank, [
        act({ type: 'bank', building: bank.id, direction: 'deposit', amount: deposit }),
      ]),
    );
  if (bank && p.cash < reserve && p.bank > 0)
    add(
      'Withdraw savings to pay for food or tuition.',
      visit(bank, [
        act({
          type: 'bank',
          building: bank.id,
          direction: 'withdraw',
          amount: Math.min(10_000_000, p.bank, reserve - p.cash),
        }),
      ]),
    );
}

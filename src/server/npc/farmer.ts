import { worldItems } from '../../shared/world-catalogue.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { propertyQuote } from '../../shared/property.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { economyChoices } from './economy-choices.ts';
import { nextNutrition, spareSupplies } from './strategy.ts';
import { items, skills } from '../../shared/catalog.ts';
import { calendar } from '../../shared/environment.ts';
import { crops, cropStatus, fertilizerPrice } from '../../shared/farming.ts';
import type { ResidentState } from './memory.ts';
import { blockedStep } from './recovery.ts';
import type { Step } from './decision.ts';
import { travelPrep } from './travel.ts';
import { visitBuilding } from './care.ts';

export interface FarmerChoice {
  supplyGoal?: import('./survival.ts').SupplyGoal;
  id: string;
  description: string;
  plan: Step[];
  reconsiderSeconds?: number;
  expectedCash?: number;
  idea?: string;
}
/** Supply feasible plans, not a scripted priority order: Jev chooses the goal.
 * Eligibility is only a snapshot; every step still passes ordinary act validation. */
export function gameplayChoices(
  w: World,
  p: Player,
  state: ResidentState,
  vocation: 'general' | 'baker' | 'farmer' | 'independent',
): FarmerChoice[] {
  const items = worldItems(w);
  const choices: FarmerChoice[] = [];
  const add = (description: string, plan: Step[], reconsiderSeconds?: number) => {
    if (choices.length < 100 && !plan.some((s) => blockedStep(state.recovery, s, w.time)))
      choices.push({
        id: `option_${choices.length}`,
        description,
        plan,
        ...(reconsiderSeconds ? { reconsiderSeconds } : {}),
      });
  };
  const visit = (b: Building, actions: Step[]): Step[] => [
    ...travelPrep(p),
    ...(distance(p, b) >= 14 ? [{ kind: 'travel', destination: b.id } as Step] : []),
    ...actions,
  ];
  const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({
    kind: 'act',
    action: a,
  });
  const mentioned = `${state.helpQuestion ?? ''} ${state.intent}`.toLowerCase();
  const buildings = w.buildings
    .filter((b) => !b.construction)
    .sort((a, b) => {
      const priority = (v: Building) =>
        v.id === p.job
          ? 4
          : mentioned.includes(v.name.toLowerCase())
            ? 3
            : v.owner === p.id
              ? 2
              : vocation === 'baker' && v.kind === 'bakery'
                ? 1
                : 0;
      return priority(b) - priority(a) || distance(p, a) - distance(p, b);
    });
  const restSeconds = p.task ? Math.max(1, Math.min(600, Math.ceil(p.task.end - w.time))) : 180;
  add(
    p.task
      ? 'Finish the current timed task before doing anything else.'
      : 'Rest for three minutes; reassess changing needs, crops and instructions.',
    [{ kind: 'wait', seconds: restSeconds }],
    Math.max(10, restSeconds + 5),
  );
  if (p.task) return choices;
  for (const [item, n] of Object.entries(p.inventory)) {
    const def = items[item];
    if (
      n > 0 &&
      def &&
      ((def.food && p.hunger >= Math.min(15000, def.food / 2)) ||
        (def.drink && p.thirst >= Math.min(15000, def.drink / 2)) ||
        (def.fuel && p.fuel <= 64 - def.fuel))
    )
      add(
        `Use carried ${def.name}: reduces hunger by ${nextNutrition(p, item, w).food}, thirst by ${nextNutrition(p, item, w).drink}, or adds ${def.fuel ?? 0} fuel. Current deficits: hunger ${p.hunger}, thirst ${p.thirst}, fuel ${p.fuel}.`,
        [action({ type: 'use', item })],
      );
  }
  // Compare ALL stocked sources before bounding alternatives; include varied diets.
  for (const [item, def] of Object.entries(items).filter(([, d]) => d.food || d.drink || d.fuel)) {
    const target = def.fuel ? 2 : def.drink ? 6 : 3;
    const nutrient = def.fuel ? 'fuel' : def.drink ? 'drink' : 'food';
    const carried = Object.entries(p.inventory).reduce(
      (sum, [id, n]) => sum + (items[id]?.[nutrient] ? n : 0),
      0,
    );
    const needed = target - carried;
    if (needed <= 0) continue;
    const nutrition = nextNutrition(p, item, w);
    const consume =
      !def.fuel &&
      ((nutrition.food > 0 && p.hunger >= Math.min(15000, nutrition.food / 2)) ||
        (nutrition.drink > 0 && p.thirst >= Math.min(15000, nutrition.drink / 2)));
    const shops = buildings.filter(
      (b) =>
        b.owner !== p.id &&
        b.stock[item] > 0 &&
        Number.isSafeInteger(b.sell[item]) &&
        b.sell[item] >= 0 &&
        p.cash >= b.sell[item],
    );
    const nearest = [...shops].sort((a, b) => distance(p, a) - distance(p, b))[0];
    const cheapest = [...shops].sort((a, b) => a.sell[item] - b.sell[item])[0];
    for (const b of new Set([nearest, cheapest])) {
      if (!b) continue;
      let n = Math.min(
        consume ? 1 : needed,
        b.stock[item],
        b.sell[item] ? Math.floor(p.cash / b.sell[item]) : needed,
      );
      while (n > 0 && !canCarry(p, item, n, w)) n--;
      if (n)
        add(
          `${consume ? 'Buy and consume' : 'Restock'} ${item}: ${n} for ${n * b.sell[item]} at ${b.name} (${Math.round(distance(p, b))}m); next serving restores ${nutrition.food} hunger / ${nutrition.drink} thirst. Cash left ${p.cash - n * b.sell[item]}.`,
          visit(b, [
            action({ type: 'trade', building: b.id, item, quantity: n, direction: 'buy' }),
            ...(consume ? [action({ type: 'use', item })] : []),
          ]),
        );
    }
  }
  for (const b of buildings.filter((b) => b.kind === 'workhouse' && b.owner !== p.id).slice(0, 2))
    add(
      `Earn 4500 cash with a 15-second public labour shift at ${b.name}; useful for tuition and supplies.`,
      visit(b, [
        action({ type: 'task', building: b.id, task: 'labour' }),
        { kind: 'wait', seconds: 15 },
      ]),
    );
  if (
    !p.learning &&
    p.skills.length < w.settings.maxSkills &&
    p.cash >= (p.skills.length ? 16000 : 8000)
  )
    for (const skill of skills.filter((skill) => !p.skills.includes(skill)))
      for (const b of buildings.filter((b) => b.kind === 'school').slice(0, 1))
        add(
          `Learn ${skill} at ${b.name}; tuition ${p.skills.length ? 16000 : 8000}. Training takes ${p.skills.length ? 2400 : 60} seconds.`,
          visit(b, [
            action({ type: 'learn', building: b.id, skill }),
            { kind: 'wait', seconds: 60 },
          ]),
        );
  economyChoices(w, p, buildings, add, visit);
  const farms = buildings
    .filter(
      (b) =>
        b.kind === 'farm' &&
        (vocation === 'farmer' || p.skills.includes('farmer') || b.owner === p.id),
    )
    .sort(
      (a, b) =>
        Number(b.owner === p.id || b.id === p.job) - Number(a.owner === p.id || a.id === p.job),
    )
    .slice(0, 4);
  for (const b of farms) {
    const own = b.owner === p.id;
    if (
      !own &&
      !b.government &&
      (!b.owner || b.forSale) &&
      p.cash >= propertyQuote(w, b).total + 20000 &&
      w.buildings.filter((v) => v.owner === p.id && !['home', 'warehouse'].includes(v.kind))
        .length < w.settings.maxBuildings
    )
      add(
        `Buy ${b.name} for ${propertyQuote(w, b).total}; retain at least 20000 for living and seed costs.`,
        visit(b, [action({ type: 'buyBuilding', building: b.id })]),
      );
    if (own && b.investment < 10000 && p.cash > 15000)
      add(
        `Fund seeds and fertilizer at my farm ${b.name}: deposit 5000 cash units.`,
        visit(b, [
          action({ type: 'investment', building: b.id, direction: 'deposit', amount: 5000 }),
        ]),
      );
    if (p.skills.includes('farmer') && !own && p.job !== b.id && b.employees.length < 16)
      add(
        `Accept farm employment at ${b.name} (${b.id}); harvest wages ${b.wage}, investment ${b.investment}. ${p.job ? 'Quit the previous job first.' : ''}`,
        visit(b, [
          ...(p.job ? [action({ type: 'quit' })] : []),
          action({ type: 'job', building: b.id }),
        ]),
      );
    if (p.skills.includes('farmer') && (own || b.employees.includes(p.id))) {
      for (let plot = 0; plot < 4; plot++) {
        const current = b.plots?.[plot],
          status = cropStatus(w, b, plot);
        if (current?.harvest) continue;
        const farm = (
          operation: 'plant' | 'water' | 'fertilize' | 'harvest',
          crop: string | null = null,
        ) => action({ type: 'farm', building: b.id, plot, operation, crop });
        if (status.state === 'empty') {
          for (const [crop, def] of Object.entries(crops))
            if (def.seasons.includes(calendar(w).season) && b.investment >= def.seed)
              add(
                `Plant ${crop} in ${b.name} plot ${plot + 1}: ${def.days} game days, base yield ${def.yield}, seed ${def.seed} from FARM investment, family ${def.family}; previous crop ${current?.previous ?? 'none'}. ${def.description}`,
                visit(b, [farm('plant', crop)]),
              );
        } else if (status.state === 'growing') {
          if ((current?.water ?? 0) < 3 && spareSupplies(p, 'water', w) >= 3)
            add(
              `Water ${current!.crop} at ${b.name} plot ${plot + 1}; consumes 3 carried water, keeping 2 to drink. Moisture ${Math.round(status.water * 100)}%; ${status.days} days remain.`,
              visit(b, [farm('water')]),
            );
          if (
            !current!.fertilized &&
            ((p.inventory.compost ?? 0) > 0 || b.investment >= fertilizerPrice)
          )
            add(
              `Fertilize ${current!.crop} at ${b.name} plot ${plot + 1}; costs one carried compost or ${fertilizerPrice} farm investment; increases yield.`,
              visit(b, [farm('fertilize')]),
            );
        } else if (
          (b.stock[current!.crop!] ?? 0) + status.yield <= b.capacity &&
          b.investment >= (own ? 0 : b.wage)
        )
          add(
            `Harvest ${current!.crop} at ${b.name} plot ${plot + 1}: ${status.yield} into FARM stock; ${own ? 0 : b.wage} gross wages; takes 15 seconds.`,
            visit(b, [farm('harvest'), { kind: 'wait', seconds: 15 }]),
          );
      }
    }
    if (own)
      for (const crop of Object.keys(crops)) {
        let n = Math.min(b.stock[crop] ?? 0, 25);
        while (n && !canCarry(p, crop, n, w)) n--;
        if (n)
          add(
            `Collect ${n} ${crop} from my farm ${b.name} for sale elsewhere.`,
            visit(b, [
              action({
                type: 'stock',
                building: b.id,
                direction: 'withdraw',
                item: crop,
                quantity: n,
              }),
            ]),
          );
      }
  }
  for (const crop of Object.keys(crops)) {
    const n = p.inventory[crop] ?? 0;
    if (!n) continue;
    for (const b of buildings
      .filter(
        (b) =>
          b.owner !== p.id &&
          b.buy[crop] > 0 &&
          b.investment >= b.buy[crop] &&
          (b.stock[crop] ?? 0) < b.capacity,
      )
      .slice(0, 2)) {
      const quantity = Math.min(
        n,
        Math.floor(b.investment / b.buy[crop]),
        b.capacity - (b.stock[crop] ?? 0),
      );
      add(
        `Sell ${quantity} carried ${crop} at ${b.name} for ${quantity * b.buy[crop]}.`,
        visit(b, [
          action({ type: 'trade', building: b.id, direction: 'sell', item: crop, quantity }),
        ]),
      );
    }
  }
  if (state.helpQuestion && !state.recall?.length)
    add('Recall past interactions relevant to the current conversation from my own journal.', [
      { kind: 'recall', query: state.helpQuestion.slice(0, 200), before: null },
    ]);
  return choices;
}

/** Plant, tend or harvest at the farm I already work — one plot, this visit. */
export function farmDuty(w: World, p: Player, b: Building, state: ResidentState): Step[] {
  if (b.kind !== 'farm' || !p.skills.includes('farmer')) return [];
  if (b.owner !== p.id && !b.employees.includes(p.id)) return [];
  const own = b.owner === p.id;
  const season = calendar(w).season;
  const buyers = new Set(
    w.buildings.flatMap((shop) =>
      Object.entries(shop.buy)
        .filter(([, price]) => Number.isSafeInteger(price) && (price as number) > 0)
        .map(([item]) => item),
    ),
  );
  const farm = (
    plot: number,
    operation: 'plant' | 'water' | 'fertilize' | 'harvest',
    crop: string | null = null,
  ): Step => ({ kind: 'act', action: { type: 'farm', building: b.id, plot, operation, crop } });
  const take = (steps: Step[]) => {
    const plan = visitBuilding(p, b, steps);
    return plan.some((s) => blockedStep(state.recovery, s, w.time)) ? [] : plan;
  };
  for (let plot = 0; plot < 4; plot++) {
    const current = b.plots?.[plot];
    if (current?.harvest) continue;
    const status = cropStatus(w, b, plot);
    if (
      status.state === 'ripe' &&
      (b.stock[current!.crop!] ?? 0) + status.yield <= b.capacity &&
      b.investment >= (own ? 0 : b.wage)
    )
      return take([farm(plot, 'harvest'), { kind: 'wait', seconds: 15 }]);
  }
  for (let plot = 0; plot < 4; plot++) {
    const current = b.plots?.[plot];
    if (current?.harvest || cropStatus(w, b, plot).state !== 'growing') continue;
    if ((current?.water ?? 0) < 3 && spareSupplies(p, 'water', w) >= 3)
      return take([farm(plot, 'water')]);
    if (!current!.fertilized && ((p.inventory.compost ?? 0) > 0 || b.investment >= fertilizerPrice))
      return take([farm(plot, 'fertilize')]);
  }
  for (let plot = 0; plot < 4; plot++) {
    if (cropStatus(w, b, plot).state !== 'empty') continue;
    const previous = b.plots?.[plot]?.previous;
    const previousFamily = previous ? crops[previous]?.family : undefined;
    const crop = Object.entries(crops)
      .filter(([, def]) => def.seasons.includes(season) && b.investment >= def.seed)
      .sort(([a, da], [bName, db]) => {
        const demand = Number(buyers.has(bName)) - Number(buyers.has(a));
        const rotate =
          Number(previousFamily !== undefined && db.family !== previousFamily) -
          Number(previousFamily !== undefined && da.family !== previousFamily);
        return demand || rotate || da.seed - db.seed;
      })[0]?.[0];
    if (crop) return take([farm(plot, 'plant', crop)]);
  }
  return [];
}

/** Backwards-compatible farmer entry point used by the standalone crop tests. */
export function farmerChoices(w: World, p: Player, state: ResidentState) {
  return gameplayChoices(w, p, state, 'farmer');
}

/** Compact crop feedback includes blocked farms, even when they have no viable action. */
export function farmerSituation(w: World, p: Player) {
  return w.buildings
    .filter((b) => b.kind === 'farm')
    .sort(
      (a, b) =>
        Number(b.owner === p.id || b.id === p.job) - Number(a.owner === p.id || a.id === p.job) ||
        distance(p, a) - distance(p, b),
    )
    .slice(0, 4)
    .map((b) => ({
      id: b.id,
      name: b.name,
      distance: Math.round(distance(p, b)),
      owned: b.owner === p.id,
      employed: b.employees.includes(p.id),
      investment: b.investment,
      wage: b.wage,
      stock: b.stock,
      capacity: b.capacity,
      construction: b.construction,
      plots: Array.from({ length: 4 }, (_, i) => ({
        plot: i,
        ...b.plots?.[i],
        ...cropStatus(w, b, i),
      })),
    }));
}

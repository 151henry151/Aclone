// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from '../../shared/types.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { items } from '../../shared/catalog.ts';
import { calendar } from '../../shared/environment.ts';
import { crops, cropStatus } from '../../shared/farming.ts';
import type { ResidentState } from './memory.ts';
import { blockedStep } from './recovery.ts';
import type { Step } from './decision.ts';

export interface FarmerChoice {
  id: string;
  description: string;
  plan: Step[];
}
/** Supply feasible plans, not a scripted priority order: Jev chooses the goal.
 * Eligibility is only a snapshot; every step still passes ordinary act validation. */
export function farmerChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  const choices: FarmerChoice[] = [];
  const add = (description: string, plan: Step[]) => {
    if (choices.length < 100 && !plan.some((s) => blockedStep(state.recovery, s, w.time)))
      choices.push({ id: `option_${choices.length}`, description, plan });
  };
  const visit = (b: Building, actions: Step[]): Step[] => [
    ...(p.atHome ? [{ kind: 'act', action: { type: 'outside' } } as Step] : []),
    ...(distance(p, b) >= 14
      ? [
          ...(p.vehicle !== 5 && p.fuel <= 0
            ? [{ kind: 'act', action: { type: 'vehicle', slot: 5 } } as Step]
            : p.vehicle !== 5 && !p.engine
              ? [{ kind: 'act', action: { type: 'engine' } } as Step]
              : []),
          { kind: 'travel', destination: b.id } as Step,
        ]
      : []),
    ...actions,
  ];
  const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({
    kind: 'act',
    action: a,
  });
  const buildings = w.buildings
    .filter((b) => !b.construction)
    .sort((a, b) => distance(p, a) - distance(p, b));
  add(
    p.task
      ? 'Finish the current timed task before doing anything else.'
      : 'Rest for a minute; reassess changing needs, crops and instructions.',
    [{ kind: 'wait', seconds: 60 }],
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
        `Use carried ${def.name}: reduces hunger by ${def.food ?? 0}, thirst by ${def.drink ?? 0}, or adds ${def.fuel ?? 0} fuel. Current deficits: hunger ${p.hunger}, thirst ${p.thirst}, fuel ${p.fuel}.`,
        [action({ type: 'use', item })],
      );
  }
  // Stock only modest reserves, including water for crops; never endlessly buy supplies.
  for (const [item, target] of [
    ['bread', 3],
    ['water', 9],
    ['fuel', 2],
  ] as const) {
    const needed = target - (p.inventory[item] ?? 0);
    if (needed <= 0) continue;
    for (const b of buildings
      .filter(
        (b) =>
          b.owner !== p.id &&
          b.kind !== 'starport' &&
          Number.isSafeInteger(b.sell[item]) &&
          b.sell[item] >= 0,
      )
      .slice(0, 2)) {
      let n = Math.min(
        needed,
        b.stock[item] ?? 0,
        b.sell[item] ? Math.floor(p.cash / b.sell[item]) : needed,
      );
      while (n > 0 && !canCarry(p, item, n)) n--;
      if (n)
        add(
          `Buy ${n} ${item} at ${b.name} (${b.id}) for ${n * b.sell[item]} cash units.`,
          visit(b, [
            action({ type: 'trade', building: b.id, item, quantity: n, direction: 'buy' }),
          ]),
        );
    }
  }
  for (const b of buildings.filter((b) => b.kind === 'workhouse' && b.owner !== p.id).slice(0, 2))
    add(
      `Earn cash with a 15-second public labour shift at ${b.name}; useful for tuition and supplies.`,
      visit(b, [
        action({ type: 'task', building: b.id, task: 'labour' }),
        { kind: 'wait', seconds: 15 },
      ]),
    );
  if (
    !p.skills.includes('farmer') &&
    !p.learning &&
    p.skills.length < w.settings.maxSkills &&
    p.cash >= (p.skills.length ? 16000 : 8000)
  )
    for (const b of buildings.filter((b) => b.kind === 'school').slice(0, 2))
      add(
        `Learn farmer at ${b.name}; tuition ${p.skills.length ? 16000 : 8000}. Training takes ${p.skills.length ? 2400 : 60} seconds.`,
        visit(b, [
          action({ type: 'learn', building: b.id, skill: 'farmer' }),
          { kind: 'wait', seconds: 60 },
        ]),
      );
  const farms = buildings
    .filter((b) => b.kind === 'farm')
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
      p.cash >= b.price + 20000 &&
      w.buildings.filter((v) => v.owner === p.id && !['home', 'warehouse'].includes(v.kind))
        .length < w.settings.maxBuildings
    )
      add(
        `Buy ${b.name} for ${b.price}; retain at least 20000 for living and seed costs.`,
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
          if ((current?.water ?? 0) < 3 && (p.inventory.water ?? 0) >= 3)
            add(
              `Water ${current!.crop} at ${b.name} plot ${plot + 1}; consumes 3 carried water. Moisture ${Math.round(status.water * 100)}%; ${status.days} days remain.`,
              visit(b, [farm('water')]),
            );
          if (!current!.fertilized && ((p.inventory.compost ?? 0) > 0 || b.investment >= 1000))
            add(
              `Fertilize ${current!.crop} at ${b.name} plot ${plot + 1}; costs one carried compost or 1000 farm investment; increases yield.`,
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
        while (n && !canCarry(p, crop, n)) n--;
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

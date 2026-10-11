import { livestockInputs } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { skillLesson } from '../../shared/world-catalogue.ts';
import { portableReserve } from './cargo.ts';
import { farmDuty } from './farmer.ts';
import { vehicles, recipes } from '../../shared/catalog.ts';
import { worldResources, resourceAmount, gatheringImplements } from '../../shared/resources.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { visitBuilding } from './care.ts';
import { livingReserve, travelPrep, affordableLoad } from './travel.ts';
import { usefulShift } from './business-policy.ts';
import { workplace } from './workplace.ts';
import { blockedStep } from './recovery.ts';

export interface CareerGoal {
  kind: 'gather' | 'trade' | 'employment' | 'business' | 'housing';
  target: string;
  source?: string;
  item?: string;
}
export interface CareerProject extends CareerGoal {
  world: string;
  deaths: number;
  started: number;
  reviewAt: number;
  completed: number;
  failures: number;
  cashAtStart: number;
  receipts: number;
  spending: number;
  lastReceipt?: number;
}
const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });

/** Conservative distance allowance; quoted product spread alone is not profit. */
export function journeyEstimate(w: World, p: Player, points: { x: number; z: number }[]) {
  let metres = 0,
    previous = { x: p.x, z: p.z };
  for (const point of points) {
    metres += distance(previous, point);
    previous = point;
  }
  const slot = p.fuel > 0 ? (p.vehicle === 5 ? 0 : p.vehicle) : 5;
  const v = { ...vehicles[slot], ...w.vehicleTuning?.[slot] };
  const seconds = (metres * 1.5) / Math.max(1, v.speed * 0.6);
  const prices = w.buildings
    .filter((b) => b.sell.fuel > 0 && (b.stock.fuel ?? 0) > 0)
    .map((b) => b.sell.fuel);
  const cost =
    p.fuel > 0
      ? Math.ceil(((seconds * v.fuel) / 8) * (prices.length ? Math.min(...prices) : 4500))
      : 0;
  return { seconds, cost };
}

/** Complete career loops use observed quotes and ordinary actions. The goal, not
 * an old purchase instruction, survives logout: every continuation is rebuilt. */
export function careerChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  if (p.task || p.learning) return [];
  const result: FarmerChoice[] = [];
  const reserve = livingReserve(w, p);
  const add = (goal: CareerGoal, description: string, plan: Step[], expectedCash: number) => {
    if (plan.length <= 12 && !plan.some((s) => blockedStep(state.recovery, s, w.time)))
      result.push({
        id: `career_${goal.kind}_${goal.source ?? ''}_${goal.target}_${goal.item ?? ''}`,
        description,
        plan,
        careerGoal: goal,
        expectedCash,
        reconsiderSeconds: 600,
      });
  };
  const shops = w.buildings.filter((b) => !b.construction && b.owner !== p.id);
  for (const node of worldResources(w)
    .filter((n) => resourceAmount(w, n) >= 3 || (p.inventory[n.item] ?? 0) >= 3)
    .sort((a, b) => distance(p, a) - distance(p, b))
    .slice(0, 12)) {
    const tool = gatheringImplements[node.item]?.item;
    if (!tool) continue;
    const quantity = p.skills.includes(node.item === 'logs' ? 'forester' : 'excavator') ? 6 : 3;
    if (
      ((p.inventory[node.item] ?? 0) < quantity && resourceAmount(w, node) < quantity) ||
      w.buildings.some((b) => distance(b, node) < 12)
    )
      continue;
    const buyer = shops
      .filter(
        (b) =>
          b.buy[node.item] > 0 &&
          b.investment >= b.buy[node.item] * quantity &&
          (b.stock[node.item] ?? 0) + quantity <= b.capacity,
      )
      .sort((a, b) => b.buy[node.item] - a.buy[node.item])[0];
    if (!buyer) continue;
    const owned = (p.inventory[tool] ?? 0) > 0;
    const seller = owned
      ? undefined
      : shops
          .filter((b) => (b.stock[tool] ?? 0) > 0 && b.sell[tool] > 0)
          .sort((a, b) => a.sell[tool] - b.sell[tool])[0];
    if (!owned && !seller) continue;
    const equipment = owned ? 0 : seller!.sell[tool];
    const carry = {
      ...p,
      inventory: { ...p.inventory, [tool]: Math.max(1, p.inventory[tool] ?? 0) },
    };
    if (
      (p.inventory[node.item] ?? 0) < quantity &&
      (p.cash - equipment < reserve || !canCarry(carry, node.item, quantity, w))
    )
      continue;
    const trip = journeyEstimate(w, p, [...(seller ? [seller] : []), node, buyer]);
    const earned = quantity * buyer.buy[node.item] - trip.cost;
    if (earned <= 0 || equipment > earned * 8) continue;
    const carried = Math.min(quantity, p.inventory[node.item] ?? 0);
    const plan: Step[] =
      carried >= quantity
        ? visitBuilding(p, buyer, [
            act({
              type: 'trade',
              building: buyer.id,
              item: node.item,
              quantity,
              direction: 'sell',
            }),
          ])
        : [
            ...(seller
              ? visitBuilding(p, seller, [
                  act({
                    type: 'trade',
                    building: seller.id,
                    item: tool,
                    quantity: 1,
                    direction: 'buy',
                  }),
                ])
              : travelPrep(p)),
            { kind: 'travel', destination: node.id },
            act({ type: 'gather', node: node.id }),
            { kind: 'wait', seconds: quantity === 6 ? 12 : 20 },
            { kind: 'travel', destination: buyer.id },
            act({
              type: 'trade',
              building: buyer.id,
              item: node.item,
              quantity,
              direction: 'sell',
            }),
          ];
    add(
      { kind: 'gather', target: node.id, source: buyer.id, item: node.item },
      `Gathering career: ${owned ? 'use my' : `buy a ${equipment}-unit`} ${tool}, gather ${quantity} ${node.item}, deliver to ${buyer.name}. Estimated net ${earned} per load after travel; equipment pays back in ${Math.ceil(equipment / earned)} loads. Keep household reserve ${reserve}.`,
      plan,
      earned - equipment,
    );
  }
  for (const source of shops)
    for (const [item, price] of Object.entries(source.sell)) {
      if (!(price > 0)) continue;
      const buyer = shops
        .filter(
          (b) =>
            b.id !== source.id &&
            b.buy[item] > price &&
            b.investment >= b.buy[item] &&
            (b.stock[item] ?? 0) < b.capacity,
        )
        .sort((a, b) => b.buy[item] - a.buy[item])[0];
      if (!buyer) continue;
      const carried = p.inventory[item] ?? 0;
      // Personal provisions are never silently converted into trading stock.
      const keep = portableReserve(item, w);
      const available = Math.max(0, carried - keep);
      let n = Math.min(
        8,
        available || (source.stock[item] ?? 0),
        Math.floor(buyer.investment / buyer.buy[item]),
        buyer.capacity - (buyer.stock[item] ?? 0),
        available || affordableLoad(p.cash, price, reserve, 8),
      );
      while (n > 0 && !available && !canCarry(p, item, n, w)) n--;
      if (!n) continue;
      const trip = journeyEstimate(w, p, available ? [buyer] : [source, buyer]);
      const margin = n * (buyer.buy[item] - price) - trip.cost;
      if (margin <= 0) continue;
      const plan = available
        ? visitBuilding(p, buyer, [
            act({ type: 'trade', building: buyer.id, item, quantity: n, direction: 'sell' }),
          ])
        : [
            ...visitBuilding(p, source, [
              act({ type: 'trade', building: source.id, item, quantity: n, direction: 'buy' }),
            ]),
            { kind: 'travel' as const, destination: buyer.id },
            act({ type: 'trade', building: buyer.id, item, quantity: n, direction: 'sell' }),
          ];
      add(
        { kind: 'trade', source: source.id, target: buyer.id, item },
        `Trading career: ${n} ${item}, ${source.name} → ${buyer.name}; estimated margin ${margin} after travel, household reserve ${reserve}. Inspect changed quotes before spending.`,
        plan,
        margin,
      );
    }
  for (const b of shops) {
    const recipe = b.kind === 'farm' ? recipes.farm : (b.production ?? recipes[b.recipe ?? '']);
    if (!recipe || !usefulShift(w, p, b)) continue;
    const job = workplace(w, p, b)!;
    if (
      job.ifYouWork.capitalShortfall ||
      (b.kind !== 'farm' &&
        Object.entries(livestockInputs(b, recipe.inputs)).some(([i, n]) => (b.stock[i] ?? 0) < n))
    )
      continue;
    if (!p.skills.includes(recipe.skill)) {
      const school = shops.find((b) => b.kind === 'school');
      let skill = recipe.skill;
      for (let i = 0; i < 20; i++) {
        const next = skillLesson(w, p, skill).prerequisites.find((s) => !p.skills.includes(s));
        if (!next) break;
        skill = next;
      }
      const tuition = skillLesson(w, p, skill).price;
      if (!school || p.skills.length >= w.settings.maxSkills || p.cash - tuition < reserve)
        continue;
      add(
        { kind: 'employment', target: b.id },
        `Employment career: learn ${skill} for a funded vacancy at ${b.name}, then take and renew the job. Tuition ${tuition}; wage ${b.wage}. Supplement wages with hauling or public work to cover living costs.`,
        visitBuilding(p, school, [
          act({ type: 'learn', building: school.id, skill }),
          { kind: 'wait', seconds: 60 },
        ]),
        -tuition,
      );
    } else if (b.kind === 'farm' && p.job === b.id) {
      const duty = farmDuty(w, p, b, state);
      if (duty.length)
        add(
          { kind: 'employment', target: b.id },
          `Farming career: tend and harvest at ${b.name}, using observed demand and protecting harvest wages.`,
          duty,
          Math.floor(b.wage * (1 - w.settings.wageTax)),
        );
    } else
      add(
        { kind: 'employment', target: b.id },
        `Employment career: maintain a useful funded shift at ${b.name}, wage ${b.wage} ${b.kind === 'farm' ? 'per harvested plot' : `per completed batch at ${Math.round(job.efficiencyIfYouWork * 100)}% production speed, ideal crew ${job.idealEmployees}`}; use the time between renewals for other earnings.`,
        visitBuilding(p, b, [
          ...(p.job && p.job !== b.id ? [act({ type: 'quit' })] : []),
          act({ type: p.job === b.id ? 'work' : 'job', building: b.id }),
        ]),
        Math.floor(
          b.wage * (1 - w.settings.wageTax) * (b.kind === 'farm' ? 1 : job.efficiencyIfYouWork),
        ),
      );
  }
  // A large market catalogue must not crowd employment out of the planner.
  const groups = ['gather', 'trade', 'employment'].map((kind) =>
    result.filter((c) => c.careerGoal?.kind === kind),
  );
  const balanced: FarmerChoice[] = [];
  for (let i = 0; i < 60 && balanced.length < 60; i++)
    for (const group of groups) if (group[i] && balanced.length < 60) balanced.push(group[i]);
  return balanced;
}
export function startCareer(w: World, p: Player, state: ResidentState, goal: CareerGoal) {
  if (
    state.career &&
    sameGoal(state.career, goal) &&
    state.career.world === w.id &&
    state.career.deaths === p.deaths
  )
    return;
  state.career = {
    ...goal,
    world: w.id,
    deaths: p.deaths,
    started: w.time,
    reviewAt: w.time + 86400,
    completed: 0,
    failures: 0,
    cashAtStart: p.cash,
    receipts: 0,
    spending: 0,
  };
}
const sameGoal = (a: CareerGoal, b: CareerGoal) =>
  a.kind === b.kind && a.target === b.target && a.source === b.source && a.item === b.item;
export function continueCareer(
  w: World,
  p: Player,
  state: ResidentState,
  other: FarmerChoice[] = [],
) {
  const c = state.career;
  if (!c) return;
  // Accepted player requests get the next decision; keep the career for later.
  if (state.commitments?.some((deal) => deal.world === w.id && deal.status === 'pending')) return;
  if (p.task || p.learning) return;
  if (c.world !== w.id || c.deaths !== p.deaths || c.reviewAt <= w.time || c.failures >= 3) {
    delete state.career;
    return;
  }
  if (
    c.kind === 'employment' &&
    p.job === c.target &&
    p.activeUntil > w.time + 600 &&
    w.buildings.find((b) => b.id === c.target)?.kind !== 'farm'
  )
    return;
  const next = [...careerChoices(w, p, state), ...other].find(
    (o) => o.careerGoal && sameGoal(o.careerGoal, c),
  );
  if (next) return next;
  // A vanished quote or completed housing errand needs a fresh strategic choice.
  delete state.career;
}

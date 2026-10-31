import { householdBudget } from './household.ts';
import { jobVacancy } from '../../shared/staffing.ts';
import { livestockSupplyInputs } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World, Player } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';
import { blockedStep } from './recovery.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { recipes } from '../../shared/catalog.ts';
import { workplace } from './workplace.ts';
import { visitBuilding } from './care.ts';
import { inspectionChoices } from './perception.ts';
import { farmDuty } from './farmer.ts';
import { careerChoices, startCareer } from './projects.ts';
import { usefulShift, ownerRoutine, cargoRelief } from './business-policy.ts';
import { affordableLoad, livingReserve } from './travel.ts';
import { homecomingPlan } from './homecoming.ts';
import { travelPrep } from './travel.ts';
import { operationAction } from './player-operations.ts';
import { worldResources } from '../../shared/resources.ts';

const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });
/** A meal is an interruption, not cancellation of an accepted goal. Keep just
 * the unexecuted tail, world/life identity and a bounded in-game expiry. */
export function suspendPlan(w: World, p: Player, state: ResidentState) {
  if (state.routine || state.suspendedPlan || state.index >= state.plan.length) return;
  state.suspendedPlan = {
    tradeQuotes: state.tradeQuotes,
    world: w.id,
    deaths: p.deaths,
    intent: state.intent,
    plan: structuredClone(state.plan.slice(state.index)),
    expiresAt: w.time + 7 * 86400,
  };
}
export function resumePlan(w: World, p: Player, state: ResidentState) {
  const saved = state.suspendedPlan;
  delete state.suspendedPlan;
  if (
    !saved ||
    saved.world !== w.id ||
    saved.deaths !== p.deaths ||
    saved.expiresAt <= w.time ||
    saved.plan.some((s) => blockedStep(state.recovery, s, w.time))
  )
    return false;
  // A meal may move us away after the original travel step completed.
  // Re-approach the first pending building action; do not repeat completed trades.
  const first = saved.plan[0];
  const firstAction =
    first?.kind === 'act'
      ? first.action
      : first?.kind === 'operation'
        ? operationAction(first)
        : undefined;
  const building =
    firstAction && 'building' in firstAction
      ? w.buildings.find((b) => b.id === firstAction.building)
      : undefined;
  const node =
    firstAction?.type === 'gather'
      ? worldResources(w).find((n) => n.id === firstAction.node)
      : undefined;
  const site =
    firstAction?.type === 'construct' && state.followThrough?.kind === 'construction'
      ? state.followThrough.site
      : undefined;
  const plan = site
    ? [...travelPrep(p), { kind: 'move' as const, ...site }, ...saved.plan]
    : building && (distance(p, building) >= 18 || p.atHome)
      ? visitBuilding(p, building, saved.plan)
      : node && (distance(p, node) >= 8 || p.atHome)
        ? [...travelPrep(p), { kind: 'move' as const, x: node.x, z: node.z }, ...saved.plan]
        : saved.plan;
  if (plan.some((s) => blockedStep(state.recovery, s, w.time))) return false;
  state.plan = plan;
  state.intent = saved.intent;
  state.tradeQuotes = saved.tradeQuotes;
  state.index = 0;
  state.repeats = 1;
  state.waitUntil = 0;
  return true;
}
function fetchWorkplaceInputs(w: World, p: Player, b: Building, state: ResidentState): Step[] {
  const recipe = b.production ?? (b.recipe && recipes[b.recipe]);
  if (!recipe) return [];
  const reserve = livingReserve(w, p);
  for (const [item, need] of Object.entries(livestockSupplyInputs(w, b, recipe.inputs))) {
    const have = b.stock[item] ?? 0;
    if (have >= need) continue;
    const bid = b.buy[item];
    const payroll = workplace(w, p, b)?.ifYouWork.wagesRequired ?? b.wage;
    const available = Math.max(0, b.investment - payroll);
    if (!Number.isSafeInteger(bid) || bid <= 0 || available < bid) continue;
    if (have >= b.capacity) continue;
    const carried = p.inventory[item] ?? 0;
    if (carried > 0) {
      const n = Math.min(carried, need - have, b.capacity - have, Math.floor(available / bid));
      if (n <= 0) continue;
      const plan = visitBuilding(p, b, [
        act({ type: 'trade', building: b.id, item, quantity: n, direction: 'sell' }),
      ]);
      if (!plan.some((s) => blockedStep(state.recovery, s, w.time))) return plan;
      continue;
    }
    if (!canCarry(p, item, 1, w)) continue;
    const seller = w.buildings
      .filter(
        (shop) =>
          shop.id !== b.id &&
          shop.owner !== p.id &&
          !shop.construction &&
          (shop.stock[item] ?? 0) > 0 &&
          Number.isSafeInteger(shop.sell[item]) &&
          shop.sell[item] > 0 &&
          p.cash >= shop.sell[item],
      )
      .sort((a, c) => a.sell[item] - c.sell[item])[0];
    if (!seller || seller.owner === p.id || seller.sell[item] > bid) continue;
    const n = Math.min(
      need - have,
      seller.stock[item],
      b.capacity - have,
      Math.floor(available / bid),
      affordableLoad(p.cash, seller.sell[item], reserve, need - have),
    );
    if (n <= 0) continue;
    const plan = [
      ...visitBuilding(p, seller, [
        act({ type: 'trade', building: seller.id, item, quantity: n, direction: 'buy' }),
      ]),
      { kind: 'travel' as const, destination: b.id },
      act({ type: 'trade', building: b.id, item, quantity: n, direction: 'sell' }),
    ];
    if (!plan.some((s) => blockedStep(state.recovery, s, w.time))) return plan;
  }
  return [];
}

/** Honour the job already held: tend plots, fetch one missing bid-priced input, or renew the shift. */
export function employmentRoutine(w: World, p: Player, state: ResidentState): Step[] {
  if (!p.job || p.task || p.learning) return [];
  const b = w.buildings.find((b) => b.id === p.job);
  if (!b) return [];
  const job = workplace(w, p, b);
  if (!job?.qualified || !job.employedHere) return [];
  if (b.kind === 'farm') return farmDuty(w, p, b, state);
  if (!usefulShift(w, p, b)) {
    // Keep the existing wage unless a known, funded vacancy can actually use
    // this worker. Moving one surplus employee improves both workplaces.
    const alternative = careerChoices(w, p, state).find(
      (c) =>
        c.careerGoal?.kind === 'employment' &&
        c.careerGoal.target !== b.id &&
        c.plan.some((s) => s.kind === 'act' && s.action.type === 'job') &&
        !c.plan.some((s) => s.kind === 'act' && s.action.type === 'learn'),
    );
    return alternative?.plan ?? [];
  }
  if (job.ifYouWork.capitalShortfall) return [];
  const stuck = job.blockers.filter(
    (line) => !line.startsWith('No active employees') && !line.startsWith('Missing'),
  );
  if (stuck.length) return [];
  if (job.blockers.some((line) => line.startsWith('Missing')))
    return fetchWorkplaceInputs(w, p, b, state);
  if (job.workActiveNextCycle) return [];
  const plan = visitBuilding(p, b, [{ kind: 'act', action: { type: 'work', building: b.id } }]);
  return plan.some((s) => blockedStep(state.recovery, s, w.time)) ? [] : plan;
}

/** Work a viable job once while still comfortable; then stock the house and leave. */
export function preparingDuty(w: World, p: Player, state: ResidentState): Step[] {
  if (p.hunger >= 25000 || p.thirst >= 25000 || state.routine === 'employment') return [];
  return employmentRoutine(w, p, state);
}

export function preparingPlan(
  w: World,
  p: Player,
  awaySeconds: number,
  state: ResidentState,
): { plan: Step[]; routine?: 'employment' } {
  const duty = preparingDuty(w, p, state);
  if (duty.length) return { plan: duty, routine: 'employment' };
  return { plan: homecomingPlan(w, p, awaySeconds, state) };
}
/** Periodic visitors stay busy while online. Mabel, logout prep and the last eight minutes may rest. */
export function visitorShouldHustle(
  id: string,
  presence?: { phase: string; endsAt: number; preparationUntil?: number },
  now = Date.now(),
) {
  if (id === 'mabel') return false;
  if (!presence || presence.phase !== 'playing') return false;
  return presence.endsAt - now >= 8 * 60_000;
}

/** Earn toward a cottage and a shop: honour a live job, sell, gather, or work a public shift. */
export function hustleRoutine(w: World, p: Player, state: ResidentState): Step[] {
  if (p.task || p.learning) return [];
  const maintenance = cargoRelief(w, p, state).length
    ? cargoRelief(w, p, state)
    : ownerRoutine(w, p, state);
  if (maintenance.length) return maintenance;
  const duty = employmentRoutine(w, p, state);
  if (duty.length) return duty;
  // In persistent-employment worlds a funded job keeps paying while doing
  // errands. Fill an idle qualified vacancy before choosing a hauling loop.
  // Never abandon an existing job or use shift-renewal worlds this way.
  if (!p.job && !w.settings.activeWork) {
    const employment = careerChoices(w, p, state).find(
      (c) =>
        c.careerGoal?.kind === 'employment' &&
        w.buildings.some(
          (b) => b.id === c.careerGoal?.target && b.kind !== 'farm' && jobVacancy(w, b, p.id),
        ) &&
        c.plan.some((s) => s.kind === 'act' && s.action.type === 'job') &&
        !c.plan.some((s) => s.kind === 'act' && s.action.type === 'learn'),
    );
    if (employment) return employment.plan;
  }
  const hauling = careerChoices(w, p, state)
    .filter(
      (c) => ['gather', 'trade'].includes(c.careerGoal?.kind ?? '') && (c.expectedCash ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (b.expectedCash ?? 0) / Math.max(30, b.durationSeconds ?? 600) -
        (a.expectedCash ?? 0) / Math.max(30, a.durationSeconds ?? 600),
    )[0];
  if (hauling) {
    // Outage work can become a repeatable career rather than one unremembered trip.
    if (hauling.careerGoal && !state.career) startCareer(w, p, state, hauling.careerGoal);
    return hauling.plan;
  }
  const office = w.buildings.find((b) => b.kind === 'workhouse' && !b.construction);
  if (!office || p.cash + p.bank > householdBudget(w, p).reserve) return [];
  const plan = visitBuilding(p, office, [
    { kind: 'act', action: { type: 'task', building: office.id, task: 'labour' } },
  ]);
  return plan.some((s) => blockedStep(state.recovery, s, w.time)) ? [] : plan;
}

/** Walk the parish to refresh last-known prices. Survival and shift work come first. */
export function exploreRoutine(w: World, p: Player, state: ResidentState): Step[] {
  if (p.task || p.learning) return [];
  const choice = inspectionChoices(w, p, state)[0];
  if (!choice) return [];
  return choice.plan.some((s) => blockedStep(state.recovery, s, w.time)) ? [] : choice.plan;
}

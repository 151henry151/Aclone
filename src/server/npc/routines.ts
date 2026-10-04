// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';
import { blockedStep } from './recovery.ts';
import { distance } from '../../shared/simulation.ts';
import { workplace } from './workplace.ts';
import { visitBuilding } from './care.ts';
/** A meal is an interruption, not cancellation of an accepted goal. Keep just
 * the unexecuted tail, world/life identity and a bounded in-game expiry. */
export function suspendPlan(w: World, p: Player, state: ResidentState) {
  if (state.routine || state.suspendedPlan || state.index >= state.plan.length) return;
  state.suspendedPlan = {
    world: w.id,
    deaths: p.deaths,
    intent: state.intent,
    plan: structuredClone(state.plan.slice(state.index)),
    expiresAt: w.time + 7200,
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
  const building =
    first?.kind === 'act' && 'building' in first.action
      ? w.buildings.find((b) => b.id === (first.action as { building: string }).building)
      : undefined;
  const plan =
    building && (distance(p, building) >= 18 || p.atHome)
      ? visitBuilding(p, building, saved.plan)
      : saved.plan;
  if (plan.some((s) => blockedStep(state.recovery, s, w.time))) return false;
  state.plan = plan;
  state.intent = saved.intent;
  state.index = 0;
  state.repeats = 1;
  state.waitUntil = 0;
  return true;
}
/** Keep an already chosen viable job operating through model outages and errands.
 * No automatic career switch, pay, production or goods are granted. */
export function employmentRoutine(w: World, p: Player, state: ResidentState): Step[] {
  if (!p.job || p.task || p.learning) return [];
  const b = w.buildings.find((b) => b.id === p.job);
  if (!b || b.kind === 'farm') return [];
  const job = workplace(w, p, b);
  if (
    !job?.qualified ||
    !job.employedHere ||
    job.workActiveNextCycle ||
    job.ifYouWork.capitalShortfall ||
    job.blockers.some((b) => !b.startsWith('No active employees'))
  )
    return [];
  const plan = visitBuilding(p, b, [{ kind: 'act', action: { type: 'work', building: b.id } }]);
  return plan.some((s) => blockedStep(state.recovery, s, w.time)) ? [] : plan;
}

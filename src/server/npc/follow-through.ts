// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import type { ResidentState } from './memory.ts';
import type { CareerGoal } from './projects.ts';
import { recipes } from '../../shared/catalog.ts';
import { ownerOperating, jobVacancy } from '../../shared/staffing.ts';
import { worldBuildings } from '../../shared/world-catalogue.ts';
import { constructionSiteReason } from '../../shared/construction-site.ts';
import { jobTraining } from './job-training.ts';
import { shiftBlocker, workplace } from './workplace.ts';
import { constructionBudget, constructionChoices } from './construction-projects.ts';
import { fundProject } from './project-funding.ts';
import { visitBuilding } from './care.ts';
import { travelPrep } from './travel.ts';
import { blockedStep } from './recovery.ts';

/** An accepted prerequisite must lead to its outcome, even across meals and visits.
 * This is bounded intent, not permission to bypass ordinary action validation. */
export type FollowThrough = {
  world: string;
  deaths: number;
  expires: number;
  failures: number;
  retryAt?: number;
} & (
  | { kind: 'training'; target: string; owner: boolean }
  | {
      kind: 'construction';
      site: { x: number; z: number };
      buildingKind: string;
      style?: string;
      construct: Extract<Step, { kind: 'operation' }>;
      building?: string;
    }
);

export function rememberFollowThrough(
  w: World,
  p: Player,
  state: ResidentState,
  plan: Step[],
  goal?: CareerGoal,
) {
  const identity = { world: w.id, deaths: p.deaths, expires: w.time + 7 * 86400, failures: 0 };
  if (
    goal &&
    ['employment', 'business'].includes(goal.kind) &&
    plan.some((s) => s.kind === 'act' && s.action.type === 'learn')
  ) {
    state.followThrough = {
      ...identity,
      kind: 'training',
      target: goal.target,
      owner: goal.kind === 'business',
    };
    return;
  }
  const index = plan.findIndex((s) => s.kind === 'operation' && s.operation === 'construct');
  const construct = plan[index];
  const site = plan.slice(0, index).findLast((s) => s.kind === 'move');
  if (construct?.kind !== 'operation' || site?.kind !== 'move') return;
  const kind = construct.parameters.find((v) => v.name === 'kind')?.value;
  const style = construct.parameters.find((v) => v.name === 'style')?.value;
  if (typeof kind !== 'string') return;
  state.followThrough = {
    ...identity,
    kind: 'construction',
    site: { x: site.x, z: site.z },
    buildingKind: kind,
    style: typeof style === 'string' ? style : undefined,
    construct: structuredClone(construct),
  };
}

function valid(w: World, p: Player, state: ResidentState) {
  const f = state.followThrough;
  return !!f && f.world === w.id && f.deaths === p.deaths && f.expires > w.time && f.failures < 3;
}

/** Suppress timer-only replanning during a selected trip or lesson, not dialogue,
 * survival, accepted player requests, failed actions or unrelated errands. */
export function pursuingFollowThrough(w: World, p: Player, state: ResidentState) {
  if (
    !valid(w, p, state) ||
    state.routine ||
    state.helpQuestion ||
    state.commitments?.some((c) => c.world === w.id && c.status === 'pending')
  )
    return false;
  const f = state.followThrough!;
  if (
    f.kind === 'training' &&
    state.plan.slice(state.index).some((s) => s.kind === 'travel' && s.destination === f.target)
  )
    return true;
  if (f.kind === 'training' && p.learning) return true;
  if (
    f.kind === 'construction' &&
    f.building &&
    state.plan.slice(state.index).some((s) => s.kind === 'travel' && s.destination === f.building)
  )
    return true;
  return state.plan.slice(state.index).some((s) => {
    if (f.kind === 'construction') {
      return (
        s.kind === 'operation' &&
        ((s.operation === 'construct' &&
          s.parameters.some((v) => v.name === 'kind' && v.value === f.buildingKind)) ||
          (s.operation === 'supply' &&
            s.parameters.some((v) => v.name === 'building' && v.value === f.building)))
      );
    }
    return (
      s.kind === 'act' &&
      (s.action.type === 'learn' ||
        (['job', 'work'].includes(s.action.type) &&
          'building' in s.action &&
          s.action.building === f.target))
    );
  });
}

/** Rebuild from current knowledge rather than replaying paid tuition, purchases,
 * funding withdrawals or a construction action that already succeeded. */
export function followThroughPlan(w: World, p: Player, state: ResidentState): Step[] | undefined {
  if (!valid(w, p, state)) {
    delete state.followThrough;
    return;
  }
  const f = state.followThrough!;
  if (
    p.task ||
    p.learning ||
    state.helpQuestion ||
    state.presence?.phase === 'preparing' ||
    state.commitments?.some((c) => c.world === w.id && c.status === 'pending') ||
    w.time < (f.retryAt ?? 0)
  )
    return;
  let plan: Step[] | undefined;
  if (f.kind === 'training') {
    const b = w.buildings.find((b) => b.id === f.target);
    // A scheduled absence can outlast market memory. Inspect the named workplace
    // again; do not invent a fresh quote or silently forget the paid-for lesson.
    if (!b) {
      const travel: Step = { kind: 'travel', destination: f.target };
      if (blockedStep(state.recovery, travel, w.time)) {
        f.retryAt = w.time + 60;
        return;
      }
      return [...travelPrep(p), travel];
    }
    if (b.construction || (b.owner === p.id) !== f.owner) {
      delete state.followThrough;
      return;
    }
    const recipe = b.production ?? recipes[b.recipe ?? ''];
    if (!recipe) {
      delete state.followThrough;
      return;
    }
    if (
      (f.owner && ownerOperating(w, b)) ||
      (!f.owner && workplace(w, p, b)?.workActiveNextCycle)
    ) {
      delete state.followThrough;
      return;
    }
    if (!p.skills.includes(recipe.skill)) plan = jobTraining(w, p, b)?.plan;
    else if (f.owner)
      plan = visitBuilding(p, b, [{ kind: 'act', action: { type: 'work', building: b.id } }]);
    else if (jobVacancy(w, b, p.id) && !shiftBlocker(w, p, b))
      plan = visitBuilding(p, b, [
        ...(p.job && p.job !== b.id
          ? [{ kind: 'act' as const, action: { type: 'quit' as const } }]
          : []),
        { kind: 'act', action: { type: p.job === b.id ? 'work' : 'job', building: b.id } },
      ]);
  } else if (f.building) {
    const b = w.buildings.find((b) => b.id === f.building);
    if (!b) {
      // An expired observation is not evidence that the site was completed or
      // sold. Revisit it, just as we do for an unobserved training destination.
      const travel: Step = { kind: 'travel', destination: f.building };
      if (blockedStep(state.recovery, travel, w.time)) {
        f.retryAt = w.time + 60;
        return;
      }
      return [...travelPrep(p), travel];
    }
    if (b.owner !== p.id || !b.construction) {
      delete state.followThrough;
      return;
    }
    plan = constructionChoices(w, p).find((c) => c.careerGoal?.target === b.id)?.plan;
  } else {
    const def = worldBuildings(w)[f.buildingKind];
    const owned = w.buildings.filter(
      (b) =>
        (b.owner === p.id || b.operatingLease?.landlord === p.id) &&
        !['home', 'warehouse'].includes(b.kind),
    ).length;
    if (
      !def ||
      def.tier > w.tier ||
      (!['home', 'warehouse'].includes(f.buildingKind) && owned >= w.settings.maxBuildings) ||
      constructionSiteReason(w, {
        id: 'planned',
        kind: f.buildingKind,
        style: f.style,
        ...f.site,
        rotation: 0,
      })
    ) {
      delete state.followThrough;
      return;
    }
    const budget = constructionBudget(w, p, f.buildingKind, f.site, f.style);
    if (budget)
      plan = fundProject(w, p, budget.total, (funded) => [
        ...travelPrep(funded),
        { kind: 'move', ...f.site },
        structuredClone(f.construct),
      ]);
  }
  if (!plan?.length || plan.some((s) => blockedStep(state.recovery, s, w.time))) {
    f.retryAt = w.time + 60;
    return;
  }
  delete f.retryAt;
  return plan;
}

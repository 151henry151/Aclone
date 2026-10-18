import { constructionBudget } from './construction-projects.ts';
import { pickBuildSite } from './chains.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { retainedCapital } from './business-policy.ts';
import { householdBudget, household, dailyLivingCost } from './household.ts';
import { visitBuilding } from './care.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';

/** Record what actually reached the planner, so missing choices can be
 * distinguished from declined opportunities without recording private chat. */
export function opportunityCounts(choices: FarmerChoice[]) {
  const counts = {
    earning: 0,
    housing: 0,
    construction: 0,
    acquisition: 0,
    expansion: 0,
    civic: 0,
  };
  for (const c of choices) {
    if ((c.expectedCash ?? 0) > 0) counts.earning++;
    if (
      c.careerGoal?.kind === 'housing' ||
      c.id.startsWith('housing_') ||
      c.id.startsWith('household_')
    )
      counts.housing++;
    if (c.plan.some((s) => s.kind === 'operation' && ['construct', 'supply'].includes(s.operation)))
      counts.construction++;
    if (c.plan.some((s) => s.kind === 'act' && s.action.type === 'buyBuilding'))
      counts.acquisition++;
    if (
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'expand',
      )
    )
      counts.expansion++;
    if (c.plan.some((s) => s.kind === 'operation' && ['town', 'foundTown'].includes(s.operation)))
      counts.civic++;
  }
  return counts;
}

/** Stagger reviews without changing the resident's chosen career or making extra chat calls. */
export function reviewInterval(id: string, preference = 'balanced') {
  let hash = 0;
  for (const c of id) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return (preference === 'employee' ? 2700 : 1500) + (hash % 601);
}
export function strategicReviewDue(w: World, p: Player, state: ResidentState, preference?: string) {
  if (
    p.task ||
    p.learning ||
    state.supplyGoal ||
    state.routine ||
    state.helpQuestion ||
    state.presence?.phase === 'preparing'
  )
    return false;
  if (state.index < state.plan.length) return false;
  const previous = state.strategyReviewedAt ?? state.evaluation?.time ?? state.career?.started;
  return previous !== undefined && w.time >= previous + reviewInterval(p.id, preference);
}

/** Only the caller's observed shops and their own accounts are used here. */
export function prosperityBriefing(w: World, p: Player, choices: FarmerChoice[] = []) {
  const reserve = householdBudget(w, p, 86400).reserve;
  const businesses = w.buildings.filter(
    (b) => b.owner === p.id && !b.government && !['home', 'warehouse'].includes(b.kind),
  );
  return {
    householdReserve: reserve,
    liquidSurplus: Math.max(0, p.cash - reserve),
    housed: !!household(w, p),
    dailyReplacementCost: dailyLivingCost(w, p).reserve,
    opportunities: choices
      .filter((c) =>
        c.plan.some(
          (s) =>
            (s.kind === 'act' &&
              (s.action.type === 'buyBuilding' ||
                (s.action.type === 'farm' && s.action.operation === 'expand'))) ||
            (s.kind === 'operation' &&
              ['construct', 'supply', 'foundTown', 'town'].includes(s.operation)),
        ),
      )
      .slice(0, 8)
      .map((c) => ({ choice: c.id, project: c.description.slice(0, 300) })),
    earningOptions: choices
      .filter((c) => (c.expectedCash ?? 0) > 0 && c.durationSeconds)
      .sort(
        (a, b) =>
          b.expectedCash! / Math.max(30, b.durationSeconds!) -
          a.expectedCash! / Math.max(30, a.durationSeconds!),
      )
      .slice(0, 3)
      .map((c) => ({
        choice: c.id,
        netPerTrip: c.expectedCash,
        minutes: Math.ceil(c.durationSeconds! / 60),
        tripsForDailyMeals: Math.ceil(dailyLivingCost(w, p).reserve / c.expectedCash!),
      })),
    holdings: businesses.map((b) => ({
      id: b.id,
      kind: b.kind,
      unfinished: !!b.construction,
      operatingReserve: retainedCapital(w, b),
      investment: b.investment,
      drawableSurplus: b.construction
        ? 0
        : Math.max(
            0,
            Math.min(
              ownerWithdrawable(w, b),
              b.investment - remainingClaim(b) - retainedCapital(w, b),
            ),
          ),
    })),
    rule: 'Daily replacement cost persists even with a full pantry; earning estimates assume observed quotes hold and exclude living costs. Compare net earnings per minute and daily trips needed, not just gross wages. Build savings toward an affordable listed project, complete it, then review again. Cash surplus is not verified profit; preserve household and business reserves. Unsold goods have no guaranteed cash value.',
  };
}

/** Drawing surplus is an optional strategic choice, not an automatic raid on tills. */
export function capitalChoices(w: World, p: Player): FarmerChoice[] {
  if (p.task || p.learning) return [];
  const status = prosperityBriefing(w, p);
  const kind = status.housed ? 'farm' : 'home';
  const site = pickBuildSite(w, p, kind);
  const target = site ? constructionBudget(w, p, kind, site)?.total : undefined;
  const shortfall = Math.max(0, (target ?? status.householdReserve) - p.cash);
  if (!shortfall) return [];
  return status.holdings.flatMap((h) => {
    const amount = Math.min(10_000_000, shortfall, h.drawableSurplus);
    if (amount < 1000) return [];
    const b = w.buildings.find((b) => b.id === h.id)!;
    return [
      {
        id: `capital_${b.id}`,
        description: `Fund my next ${kind}: draw ${amount} surplus from my ${b.name}; keep ${h.operatingReserve} operating capital and all investor claims. This is a transfer, not new profit; compare expansion, another business, a home or a town charter.`,
        plan: visitBuilding(p, b, [
          {
            kind: 'act' as const,
            action: {
              type: 'investment' as const,
              building: b.id,
              direction: 'withdraw' as const,
              amount,
            },
          },
        ]),
      },
    ];
  });
}

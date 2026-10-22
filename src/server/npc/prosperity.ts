import { constructionBudget } from './construction-projects.ts';
import { pickBuildSite } from './chains.ts';
import { businessHealth } from '../../shared/business-health.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { retainedCapital, inputStockTarget, productionBudget } from './business-policy.ts';
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
    foundedTowns: w.towns
      .filter((t) => t.founder === p.id)
      .map((t) => ({
        name: t.name,
        x: t.x,
        z: t.z,
        businesses: businesses
          .filter((b) => Math.hypot(b.x - t.x, b.z - t.z) < t.radius)
          .map((b) => ({ id: b.id, kind: b.kind, unfinished: !!b.construction })),
        goal: 'Turn the charter into a working settlement. Compare costed construction opportunities here, complete unfinished sites, arrange inputs, staff and customers. Existing businesses elsewhere still need care. A town centre alone generates no trade or income; do not build duplicate homes or empty factories without a supply and sales plan.',
      })),
    buildingAllowance: {
      owned: w.buildings.filter(
        (b) =>
          (b.owner === p.id || b.operatingLease?.landlord === p.id) &&
          !['home', 'warehouse'].includes(b.kind),
      ).length,
      limit: w.settings.maxBuildings,
      rule: 'At the limit, sell or transfer an existing business under ordinary rules before starting another; founding a town does not increase the allowance.',
    },
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
      forSale: !!b.forSale,
      askingPrice: b.forSale ? b.price : undefined,
      unfinished: !!b.construction,
      operatingReserve: retainedCapital(w, b),
      investment: b.investment,
      productionEconomics: productionBudget(w, b),
      diagnosis: businessHealth(w, b),
      inputTargets: Object.fromEntries(
        [...new Set([...Object.keys(b.buy), ...Object.keys(b.pausedPrices?.buy ?? {})])].flatMap(
          (item) => {
            const target = inputStockTarget(b, item);
            return target === undefined
              ? []
              : [[item, { held: b.stock[item] ?? 0, target, bid: b.buy[item] }]];
          },
        ),
      ),
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
  // Until housed, fund a costed home rather than repeatedly draining tills into
  // a wallet that can already pay for shelter. Housed owners have no farm-only cap.
  const site = !status.housed ? pickBuildSite(w, p, 'home') : undefined;
  const target = site ? constructionBudget(w, p, 'home', site)?.total : undefined;
  const needed = !status.housed
    ? Math.max(0, (target ?? status.householdReserve) - p.cash)
    : Infinity;
  return status.holdings.flatMap((h) => {
    const amount = Math.min(10_000_000, needed, h.drawableSurplus);
    if (amount < (status.housed ? 10000 : 1000)) return [];
    const b = w.buildings.find((b) => b.id === h.id)!;
    return [
      {
        id: `capital_${b.id}`,
        description: `Release capital for an opportunity I choose: draw ${amount} surplus from my ${b.name}; keep ${h.operatingReserve} operating capital and all investor claims. This is a transfer, not new profit or income; choose it only when the cash can usefully fund housing, trade, expansion, another business or a town charter. It does not commit me to building a farm.`,
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

// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { productionInterval } from '../../shared/simulation.ts';
import { productionStaff } from '../../shared/sound-state.ts';

/** Read-only diagnosis from the same recipe, staff and clock used by production.
 * No private details about other employees enter the model's observation. */
export function workplace(w: World, p: Player, b: Building) {
  const recipe =
    b.kind === 'farm' ? recipes.farm : (b.production ?? (b.recipe && recipes[b.recipe]));
  if (!recipe) return;
  const interval = productionInterval(w, b);
  const next = (Math.floor(w.time / interval) + 1) * interval;
  const staff = productionStaff(w, b, next);
  const employedHere = p.job === b.id && b.employees.includes(p.id);
  const qualified = p.skills.includes(recipe.skill);
  const workActive = employedHere && (!w.settings.activeWork || p.activeUntil >= w.time);
  const workActiveNextCycle = employedHere && staff.some((q) => q.id === p.id);
  const renewAction = employedHere ? { type: 'work' as const, building: b.id } : null;
  const jobBlockers: string[] = [];
  if (b.owner === p.id) jobBlockers.push('Owners cannot employ themselves');
  if (!qualified) jobBlockers.push(`Learn ${recipe.skill} at school first`);
  if (p.job && !employedHere) jobBlockers.push('Quit your other job before taking this one');
  if (!employedHere && b.employees.length >= 16) jobBlockers.push('All jobs filled');
  const blockers: string[] = [];
  if (b.construction) blockers.push('Construction is unfinished');
  if (b.kind !== 'farm') {
    if (!b.government && !staff.length)
      blockers.push(
        'No active employees at the next production check; only slow unattended production can run',
      );
    for (const [item, n] of Object.entries(recipe.inputs))
      if ((b.stock[item] ?? 0) < n)
        blockers.push(`Missing ${n - (b.stock[item] ?? 0)} ${item} in building stockroom`);
    for (const [item, n] of Object.entries(recipe.outputs))
      if ((b.stock[item] ?? 0) + n > b.capacity)
        blockers.push(`Make room for ${n} ${item} in building stockroom`);
    if (b.investment < b.wage * staff.length)
      blockers.push(
        `Owner must invest ${b.wage * staff.length - b.investment} more for next cycle's wages`,
      );
  }
  const wagesRequired = b.wage * (staff.filter((q) => q.id !== p.id).length + 1);
  const summary =
    b.kind === 'farm'
      ? 'This farm uses seasonal plots, not automatic wheat production.'
      : [
          employedHere
            ? !workActive
              ? 'You still hold this job, but your shift has expired. Use work to renew it; waiting nearby does not renew a shift.'
              : !workActiveNextCycle
                ? 'Your shift is active now but expires before the next production check. Use work before then to earn wages.'
                : 'Your shift is active through the next production check; this is not proof a batch has completed.'
            : 'You have NOT taken this job; a chat agreement does not count.',
          qualified ? `You are qualified (${recipe.skill}).` : `You lack ${recipe.skill}.`,
          `Inputs and outputs belong to the building stockroom, never your carried inventory.`,
          `With you working, the next batch needs ${(wagesRequired / 100).toFixed(2)}d total wages from building investment.`,
          b.investment < wagesRequired
            ? `The OWNER must add ${((wagesRequired - b.investment) / 100).toFixed(2)}d via Building Admin before that paid batch can run; job/work alone cannot fix this.`
            : 'Working capital covers that wage bill.',
          ...blockers,
        ].join(' ');
  return {
    summary,
    mode: b.kind === 'farm' ? 'seasonal plots' : 'automatic',
    // Farm output comes from actual plots, not the retained legacy recipe.
    recipe: b.kind === 'farm' ? { skill: recipe.skill, inputs: {}, outputs: {} } : recipe,
    inputSource: 'building stockroom',
    outputDestination: 'building stockroom',
    intervalSeconds: interval,
    nextCycleInSeconds: Math.ceil(next - w.time),
    employedHere,
    qualified,
    canTakeJob: !employedHere && jobBlockers.length === 0,
    jobBlockers,
    workActive,
    workActiveNextCycle,
    renewAction,
    workActiveUntil: employedHere && w.settings.activeWork ? p.activeUntil : null,
    activeEmployeesNextCycle: staff.length,
    efficiencyNextCycle: b.government || staff.length ? 1 : w.settings.offlineEfficiency,
    fractionalProgress: b.progress,
    blockers,
    ifYouWork: { wagesRequired, capitalShortfall: Math.max(0, wagesRequired - b.investment) },
    nextStep:
      b.kind === 'farm'
        ? 'Inspect plots and use farm actions; no automatic wheat recipe runs here'
        : employedHere
          ? 'Use work nearby to renew two cycles, then wait for production; check blockers and capital'
          : 'Use job nearby if eligible; then work and wait. No personal milling/crafting action exists',
  };
}

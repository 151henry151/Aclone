import {
  herdSpec,
  herdReady,
  herdNeeds,
  acceptsHay,
  livestockInputs,
} from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { usefulShift } from './business-policy.ts';
import { calendar } from '../../shared/environment.ts';
import { crops } from '../../shared/farming.ts';
import { waterworksSite } from '../../shared/shoreline.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { productionInterval } from '../../shared/simulation.ts';
import {
  productionStaff,
  productionStaffing,
  productionEfficiency,
} from '../../shared/sound-state.ts';

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
  const renewAction =
    employedHere && w.settings.activeWork ? { type: 'work' as const, building: b.id } : null;
  const jobBlockers: string[] = [];
  if (b.owner === p.id) jobBlockers.push('Owners cannot employ themselves');
  if (!qualified) jobBlockers.push(`Learn ${recipe.skill} at school first`);
  if (p.job && !employedHere) jobBlockers.push('Quit your other job before taking this one');
  if (!employedHere && b.employees.length >= 16) jobBlockers.push('All jobs filled');
  const blockers: string[] = [];
  const notes: string[] = [];
  const herd = herdSpec(b);
  if (herd) {
    if (!herdReady(b))
      blockers.push(
        `Production requires ${herd.minimum} ${herd.animal} and 40% herd condition; keep feed, water and qualified care available`,
      );
    notes.push(
      `${b.stock[herd.animal] ?? 0} ${herd.animal}, condition ${b.herdCondition ?? 100}%. Every check consumes ${herdNeeds(b).feed} ${acceptsHay(b) ? 'hay or feed' : 'feed'} and ${herdNeeds(b).water} water even if output is full; reserves add upkeep without increasing output.`,
    );
  }
  if (b.kind === 'waterworks' && !waterworksSite(w, b, b.rotation))
    blockers.push(
      'Water intake is dry or the pump house is flooded; restore a dry shoreline with water behind the building.',
    );
  if (b.construction) blockers.push('Construction is unfinished');
  if (b.kind !== 'farm') {
    if (!b.government && !productionStaffing(w, b, staff.length, next).active)
      blockers.push(
        'No active employees at the next production check; only slow unattended production can run',
      );
    for (const [item, n] of Object.entries(livestockInputs(b, recipe.inputs)))
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
  const paidCrewWithYou = staff.filter((q) => q.id !== p.id).length + Number(b.owner !== p.id);
  const wagesRequired = b.wage * paidCrewWithYou;
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
            : b.owner === p.id && w.settings.ownerOperation
              ? !qualified
                ? 'Learn the required skill to operate your business without wages.'
                : w.settings.activeWork
                  ? 'You can operate unpaid by renewing work.'
                  : 'You operate unpaid without renewal, including offline.'
              : 'You have NOT taken this job; a chat agreement does not count.',
          qualified ? `You are qualified (${recipe.skill}).` : `You lack ${recipe.skill}.`,
          `Inputs and outputs belong to the building stockroom, never your carried inventory.`,
          `With you working, the next batch needs ${(wagesRequired / 100).toFixed(2)}d total wages from building investment.`,
          b.investment < wagesRequired
            ? `The OWNER must add ${((wagesRequired - b.investment) / 100).toFixed(2)}d via Building Admin before that paid batch can run; job/work alone cannot fix this.`
            : 'Working capital covers that wage bill.',
          `Ideal active crew: ${productionStaffing(w, b, staff.length, next).ideal}; expected efficiency ${Math.round(productionEfficiency(w, b, staff.length, next) * 100)}%. Fewer or excess workers slow batch completion; wages are paid only for completed batches.`,
          ...blockers,
          ...notes,
        ].join(' ');
  return {
    summary,
    mode: b.kind === 'farm' ? 'seasonal plots' : 'automatic',
    // Farm output comes from actual plots, not the retained legacy recipe.
    recipe: b.kind === 'farm' ? { skill: recipe.skill, inputs: {}, outputs: {} } : recipe,
    wage: {
      grossHundredths: b.wage,
      grossDenarii: b.wage / 100,
      netDenarii: (b.wage - Math.floor(b.wage * w.settings.wageTax)) / 100,
      basis:
        b.kind === 'farm'
          ? 'per worker per harvested plot'
          : 'per worker per completed production cycle',
      source: 'Live building settings; overrides remembered or default wages',
    },
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
    idealEmployees: productionStaffing(w, b, staff.length, next).ideal,
    efficiencyNextCycle: productionEfficiency(w, b, staff.length, next),
    efficiencyIfYouWork: productionEfficiency(w, b, paidCrewWithYou, next),
    fractionalProgress: b.progress,
    blockers,
    notes,
    ifYouWork: { wagesRequired, capitalShortfall: Math.max(0, wagesRequired - b.investment) },
    nextStep:
      b.kind === 'farm'
        ? 'Inspect plots and use farm actions; no automatic wheat recipe runs here'
        : employedHere
          ? w.settings.activeWork
            ? 'Use work nearby to renew two cycles, then wait for production; check blockers and capital'
            : 'Employment continues without renewal, including offline; check stockroom, funding and buyers'
          : 'Use job nearby if eligible; obey this world’s shift policy. No personal milling/crafting action exists',
  };
}

/** Evaluate the target, never the current employer or the wording of a choice.
 * The caller supplies its perceived world; runtime rechecks at the destination. */
export function shiftBlocker(w: World, p: Player, b: Building): string | undefined {
  const job = workplace(w, p, b);
  if (!job) return 'This building has no production job';
  if (b.owner === p.id) return 'Owners cannot employ themselves';
  if (b.construction) return 'Construction is unfinished';
  if (b.wage <= 0) return 'This job pays no wages';
  if (!usefulShift(w, p, b))
    return 'Another worker already covers this production cycle; find another useful task';
  if (job.ifYouWork.capitalShortfall) return 'Investment cannot pay the next wage bill';
  if (b.kind === 'farm') {
    const planted = (b.plots ?? []).some((plot) => plot.crop);
    const plantable = Object.values(crops).some(
      (c) =>
        c.seasons.includes(calendar(w).season) &&
        b.investment >= c.seed + job.ifYouWork.wagesRequired,
    );
    if (!planted && !plantable) return 'No funded seasonal farm work is available';
    return;
  }
  return job.blockers.find((line) => !line.startsWith('No active employees'));
}

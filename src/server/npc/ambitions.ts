// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import { businessEstimate } from './enterprise.ts';
import { careerChoices } from './projects.ts';
import { propertyQuote } from '../../shared/property.ts';
import { householdBudget } from './household.ts';

export interface Ambition {
  world: string;
  deaths: number;
  target: string;
  kind: 'housing' | 'business';
  requiredCash: number;
  chosenAt: number;
}
/** Savings is an executable income project with a purpose, not a wait instruction.
 * Targets come only from observed affordable-to-operate property, not a global
 * missing-building mandate. Jev can decline or change the milestone at review. */
export function savingChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  if (p.task || p.learning || w.buildings.some((b) => b.owner === p.id && b.construction))
    return [];
  if (
    state.ambition &&
    (state.ambition.world !== w.id ||
      state.ambition.deaths !== p.deaths ||
      w.buildings.some((b) => b.id === state.ambition?.target && b.owner === p.id))
  )
    delete state.ambition;
  const income = careerChoices(w, p, state)
    .filter(
      (c) =>
        c.durationSeconds &&
        (c.expectedCash ?? 0) > 0 &&
        ['trade', 'gather'].includes(c.careerGoal?.kind ?? ''),
    )
    .sort((a, b) => b.expectedCash! / b.durationSeconds! - a.expectedCash! / a.durationSeconds!)[0];
  if (!income) return [];
  const living = householdBudget(w, p, 86400).reserve;
  const prospects = w.buildings
    .flatMap((b) => {
      if (b.owner === p.id || b.construction || b.government || (b.owner && !b.forSale)) return [];
      const estimate = businessEstimate(w, b);
      const home = b.kind === 'home' && !p.home;
      if (!home && (!estimate || estimate.margin <= 0)) return [];
      const requiredCash =
        propertyQuote(w, b).total + living + Math.max(0, (estimate?.reserve ?? 0) - b.investment);
      if (p.cash >= requiredCash) return []; // actual acquisition plans take over
      return [{ b, requiredCash, kind: home ? ('housing' as const) : ('business' as const) }];
    })
    .sort(
      (a, b) =>
        Number(b.b.id === state.ambition?.target) - Number(a.b.id === state.ambition?.target) ||
        a.requiredCash - b.requiredCash,
    )
    .slice(0, 3);
  return prospects.map(({ b, requiredCash, kind }) => ({
    ...income,
    id: `save_${b.id}_${income.id}`,
    ambition: { world: w.id, deaths: p.deaths, target: b.id, kind, requiredCash, chosenAt: w.time },
    description: `Save toward ${b.name}: need ${requiredCash} cash including purchase, household and operating reserves; currently ${p.cash}. Earn the next load first: ${income.description} Recheck this property before buying; savings do not guarantee future availability.`,
  }));
}

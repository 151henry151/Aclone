// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import { worldBuildings } from '../../shared/world-catalogue.ts';
import { appearance } from '../../shared/appearance.ts';
import { propertyQuote } from '../../shared/property.ts';
import { household, householdBudget } from './household.ts';
import { constructionBudget } from './construction-projects.ts';
import { pickBuildSite } from './chains.ts';
import { visitBuilding } from './care.ts';
import { travelPrep } from './travel.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

/** Permanent shelter is a costed project, including completion and pantry money.
 * Use only known suppliers. Existing foundations must be finished first. */
export function housingChoices(w: World, p: Player, away = 86400): FarmerChoice[] {
  if (
    household(w, p)?.kind === 'home' ||
    w.buildings.some((b) => b.owner === p.id && b.construction)
  )
    return [];
  const living = householdBudget(w, p, Math.max(86400, away + 900)).reserve;
  const house = w.buildings
    .filter((b) => b.kind === 'home' && !b.construction && !b.government && (!b.owner || b.forSale))
    .sort((a, b) => propertyQuote(w, a).total - propertyQuote(w, b).total)[0];
  const style =
    appearance.cottages[
      Math.abs(p.id.split('').reduce((n, c) => n + c.charCodeAt(0), 0)) % appearance.cottages.length
    ].id;
  const site =
    worldBuildings(w).home?.tier <= w.tier ? pickBuildSite(w, p, 'home', style) : undefined;
  const budget = site && constructionBudget(w, p, 'home', site, style);
  const purchase = house ? propertyQuote(w, house).total + living : Infinity;
  const build = budget ? budget.total + Math.max(0, living - budget.living) : Infinity;
  const target = Math.min(purchase, build);
  if (!Number.isFinite(target)) return [];
  if (p.cash < target) {
    const bank = w.buildings.find((b) => b.kind === 'bank' && !b.construction);
    const amount = Math.min(10_000_000, target - p.cash);
    if (!bank || target - p.cash > p.bank) return [];
    return [
      {
        id: 'housing_savings',
        description: `Establish a home: withdraw ${amount} of my savings toward a fully costed ${target} home and pantry budget. This is a transfer, not income.`,
        plan: visitBuilding(p, bank, [
          {
            kind: 'act',
            action: { type: 'bank', building: bank.id, direction: 'withdraw', amount },
          },
        ]),
      },
    ];
  }
  if (purchase <= build && house)
    return [
      {
        id: `housing_buy_${house.id}`,
        description: `Establish a home: buy ${house.name} for ${purchase - living}, retaining ${living} for supplies; then stock it before logout.`,
        careerGoal: { kind: 'housing', target: house.id },
        plan: visitBuilding(p, house, [
          { kind: 'act', action: { type: 'buyBuilding', building: house.id } },
        ]),
      },
    ];
  if (!site || !budget || !worldBuildings(w).home || worldBuildings(w).home.tier > w.tier)
    return [];
  return [
    {
      id: 'housing_build',
      description: `Establish a home: build a cottage. Total budget ${build} includes materials ${budget.materialCost}, tax ${budget.tax} and pantry reserve ${living}. Complete deliveries before it can shelter me.`,
      plan: [
        ...travelPrep(p),
        { kind: 'move', ...site },
        operation('construct', {
          kind: 'home',
          style,
        }),
      ],
      reconsiderSeconds: 600,
    },
  ];
}

import { fundProject } from './project-funding.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../../shared/types.ts';
import { worldBuildings } from '../../shared/world-catalogue.ts';
import { appearance } from '../../shared/appearance.ts';
import { propertyQuote } from '../../shared/property.ts';
import { householdBudget } from './household.ts';
import { constructionBudget } from './construction-projects.ts';
import { pickBuildSite } from './chains.ts';
import { visitBuilding } from './care.ts';
import { travelPrep } from './travel.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

/** A remembered room or missing home pointer must not hide an owned cottage/foundation. */
export function ownsHome(w: World, p: Player) {
  return w.buildings.some((b) => b.kind === 'home' && b.owner === p.id);
}

/** Revalidate queued AI plans; this is not a property restriction on human players. */
export function checkHousingPurchase(w: World, p: Player, a: Action) {
  const acquiringHome =
    (a.type === 'construct' && a.kind === 'home') ||
    (a.type === 'buyBuilding' && w.buildings.some((b) => b.id === a.building && b.kind === 'home'));
  if (acquiringHome && ownsHome(w, p))
    throw Error(
      'I already own a cottage or its foundation. Finish and stock that home; use surplus capital for a business instead.',
    );
}

/** Permanent shelter is a costed project, including completion and pantry money.
 * Use only known suppliers. Existing foundations must be finished first. */
export function housingChoices(w: World, p: Player, away = 86400): FarmerChoice[] {
  if (ownsHome(w, p) || w.buildings.some((b) => b.owner === p.id && b.construction)) return [];
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
  if (purchase <= build && house) {
    const plan = fundProject(w, p, purchase, (funded) =>
      visitBuilding(funded, house, [
        { kind: 'act', action: { type: 'buyBuilding', building: house.id } },
      ]),
    );
    return plan
      ? [
          {
            id: `housing_buy_${house.id}`,
            description: `Establish a home: buy ${house.name} for ${purchase - living}, retaining ${living} for supplies; then stock it before logout.`,
            careerGoal: { kind: 'housing', target: house.id },
            plan,
          },
        ]
      : [];
  }
  if (!site || !budget || !worldBuildings(w).home || worldBuildings(w).home.tier > w.tier)
    return [];
  const plan = fundProject(w, p, build, (funded) => [
    ...travelPrep(funded),
    { kind: 'move', ...site },
    operation('construct', { kind: 'home', style }),
  ]);
  return plan
    ? [
        {
          id: 'housing_build',
          description: `Establish a home: build a cottage. Total budget ${build} includes materials ${budget.materialCost}, tax ${budget.tax} and pantry reserve ${living}. Complete deliveries before it can shelter me.`,
          plan,
          reconsiderSeconds: 600,
        },
      ]
    : [];
}

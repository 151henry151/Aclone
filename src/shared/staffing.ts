import { automotiveConfig } from './automotive-config';
import { pastureSpecies, pastureAnimal } from './pasture-land';
// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings, recipes } from './catalog.ts';
import type { Building, World } from './types.ts';

/** New assembly orders use the current template/world requirement. Reserved orders retain it. */
export function factoryIdealEmployees(w: World, b: Building): number {
  return (
    (b.templateId ? w.catalogue?.templates[b.templateId]?.idealEmployees : undefined) ??
    automotiveConfig(w).factory.idealEmployees
  );
}

/** Resolve rather than copy into saves, so existing properties receive balancing
 * changes without resetting their stock, prices, wages or employee roster. */
export function idealEmployees(w: World, b: Building): number {
  if (b.kind === 'automotiveFactory')
    return b.manufacturing?.orders[0]?.idealEmployees ?? factoryIdealEmployees(w, b);
  const template = b.templateId ? w.catalogue?.templates[b.templateId] : undefined;
  const base = template?.idealEmployees ?? buildings[b.kind]?.idealEmployees ?? 1;
  const animal = pastureAnimal[b.kind as keyof typeof pastureAnimal],
    per = pastureSpecies[b.kind as keyof typeof pastureSpecies];
  return base * (animal ? Math.max(1, Math.ceil((b.stock[animal] ?? 0) / per)) : 1);
}
export function staffingEfficiency(active: number, ideal: number): number {
  return active <= 0 ? 0 : Math.min(active / ideal, ideal / active);
}

/** A qualified working owner supplies one unpaid place, not a paid job. */
export function ownerOperating(w: World, b: Building, at = w.time): boolean {
  // Public/remembered snapshots already report owner operation without revealing skills.
  if (b.kind === 'lighthouse') return false;
  if (b.staffing)
    return (
      b.staffing.ownerOperating && (!w.settings.activeWork || (b.ownerActiveUntil ?? -1) >= at)
    );
  const owner = b.owner && w.players[b.owner];
  const recipe =
    b.kind === 'automotiveFactory'
      ? { skill: b.manufacturing?.orders[0]?.skill ?? automotiveConfig(w).factory.skill }
      : (b.production ?? (b.recipe && recipes[b.recipe]));
  return !!(
    w.settings.ownerOperation &&
    owner &&
    recipe &&
    owner.skills.includes(recipe.skill) &&
    (!w.settings.activeWork || (b.ownerActiveUntil ?? -1) >= at)
  );
}
export function recommendedHiringLimit(w: World, b: Building): number {
  // Farm work pays per completed harvest, not per automatic batch.
  return b.kind === 'farm'
    ? 16
    : Math.max(
        0,
        idealEmployees(w, b) - Number(b.staffing?.ownerOperating ?? ownerOperating(w, b)),
      );
}
export function hiringLimit(w: World, b: Building): number {
  if (b.kind === 'lighthouse') return 1;
  return b.hiringLimit ?? recommendedHiringLimit(w, b);
}
export function jobVacancy(w: World, b: Building, playerId?: string): boolean {
  if (playerId && b.employees.includes(playerId)) return true;
  return (
    b.employees.length < hiringLimit(w, b) &&
    (!playerId || (b.dismissedUntil?.[playerId] ?? 0) <= w.time)
  );
}

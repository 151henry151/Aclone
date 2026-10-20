// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog';
import { distance } from './simulation';
import type { World, Player } from './types';
/** Public landmarks, personal qualifications and nearby observations only. */
export function firstSteps(w: World, p: Player) {
  const steps: { title: string; detail: string; destination?: string }[] = [];
  const nearest = (kind: string) =>
    w.buildings
      .filter((b) => b.kind === kind && !b.construction)
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (w.settings.hungerRate > 0 || w.settings.thirstRate > 0) {
    const store =
      nearest('market') ?? w.buildings.find((b) => b.sell.water !== undefined && !b.construction);
    steps.push({
      title: 'Carry provisions',
      detail:
        'Buy food and water, then consume them from Inventory. Check prices and stock on arrival.',
      destination: store?.id,
    });
  }
  if (w.settings.jobsEnabled !== false) {
    const job = w.buildings
      .filter(
        (b) =>
          !b.construction &&
          b.owner !== p.id &&
          b.wage > 0 &&
          p.skills.includes((b.production ?? recipes[b.recipe ?? ''])?.skill ?? ''),
      )
      .sort((a, b) => distance(p, a) - distance(p, b))[0];
    const b = job ?? nearest('workhouse');
    if (b)
      steps.push({
        title: job ? 'Use your qualification' : 'Earn your first wages',
        detail: job
          ? 'You have the required skill. Inspect supplies, vacancies and funded wages before accepting.'
          : 'Visit the odd jobs office for available labour. A school qualification opens regular employment.',
        destination: b.id,
      });
  }
  const home =
    w.buildings.find((b) => b.id === p.home) ||
    w.buildings.find((b) => b.kind === 'home' && b.owner === p.id);
  steps.push({
    title: home ? 'Prepare for logout' : 'Find shelter',
    detail: home
      ? 'Put provisions in your home stockroom and go inside before leaving. Carried supplies are not an automatic pantry.'
      : 'Save for a cottage or inspect an inn for a room. Offline survival follows this world’s rules.',
    destination: home?.id ?? (nearest('bnb') ?? nearest('hotel'))?.id,
  });
  steps.push({
    title: 'Explore this world',
    detail: w.settings.fighting
      ? 'Combat is enabled: check safe zones and local rules before travelling.'
      : 'Visit the map, activities and world directory to choose your next goal.',
  });
  return steps;
}

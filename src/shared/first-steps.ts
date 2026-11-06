import { persistentVehicles } from './parked-vehicles';
import { parkingRules } from './parking-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog';
import { onlineInventory } from './automatic-provisions';
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
      detail: w.settings.autoConsumeInventory
        ? `Buy and carry food and water. This world eats and drinks from inventory automatically${onlineInventory(w) ? ', online and offline' : ' while you are signed off; eat and drink yourself while signed in'}. Alcoholic drinks are never consumed automatically. Check prices and stock on arrival.`
        : 'Buy food and water, then consume them from Inventory. Check prices and stock on arrival.',
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
          : 'Visit the odd jobs office for a short paid shift. Pay falls after eight in a row and stops at the daily cap; a school qualification opens regular employment.',
        destination: b.id,
      });
  }
  const home =
    w.buildings.find((b) => b.id === p.home) ||
    w.buildings.find((b) => b.kind === 'home' && b.owner === p.id);
  steps.push({
    title: home ? 'Prepare for logout' : 'Find shelter',
    detail: home
      ? `Stock your selected home. ${w.settings.autoConsumeHomeStock ? 'These stores also feed you while away.' : 'Go inside to eat from home stores.'} ${w.settings.autoConsumeInventory ? (onlineInventory(w) ? 'Carried provisions are also consumed automatically.' : 'Carried provisions feed you while signed off; eat and drink them yourself while signed in.') : 'Carried supplies require manual eating.'} Beer and wine are never consumed automatically. Indoors, needs drain at ${Math.round((w.settings.homeNeedsMultiplier ?? 0.8) * 100)}% of normal.`
      : `Save for a cottage or inspect an inn for a room. ${w.settings.autoConsumeInventory ? 'Keep food and water in inventory: automatic meals work even without a home.' : 'Offline survival follows this world’s rules.'}`,
    destination: home?.id ?? (nearest('bnb') ?? nearest('hotel'))?.id,
  });
  if (persistentVehicles(w, p)) {
    const r = parkingRules(w.settings);
    steps.push({
      title: 'Park, walk and return',
      detail: `Walking leaves your vehicle and its fuel where you parked. Use its map marker, return within ${r.parkingReturnRange} m to board, or carry fuel back from a seller to fill its tank. ${r.arrivalAnimation === 'off' ? 'Building entry is immediate in this world.' : 'Interacting walks you to the door before opening the building panel; closing it walks you back outside.'} Home departures offer walking or your parked tractor.`,
    });
  }
  steps.push({
    title: 'Explore this world',
    detail: w.settings.fighting
      ? 'Combat is enabled: check safe zones and local rules before travelling.'
      : 'Visit the map, activities and world directory to choose your next goal.',
  });
  return steps;
}

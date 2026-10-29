import { charterCaptain } from './charter';
import { poweredBoat } from './boats';
// SPDX-License-Identifier: GPL-3.0-or-later
import { deepFishingWater } from './fishing-water';
import type { Player, World } from './types';
export const deepFish = ['cod', 'halibut', 'tuna'] as const;
export function fishingVessel(w: World, p: Player): Player | undefined {
  return p.hitch ? charterCaptain(w, p) : poweredBoat(p.vehicle, w) ? p : undefined;
}
export function deepBoatFishing(w: World, p: Player) {
  const boat = fishingVessel(w, p);
  return !!boat && deepFishingWater(w, boat);
}
export function fishingCatch(w: World, p: Player, roll = Math.random()) {
  if (!deepBoatFishing(w, p)) return 'fish';
  return roll < 0.65
    ? 'fish'
    : roll < 0.85
      ? 'largeFish'
      : roll < 0.94
        ? 'cod'
        : roll < 0.985
          ? 'halibut'
          : 'tuna';
}
/** Mean real seconds while the line is waiting; bite/reeling time is additional. */
export function meanBiteWait(w: World, p: Player) {
  return deepBoatFishing(w, p)
    ? 225
    : fishingVessel(w, p)
      ? 65
      : w.settings.fishingMode === 5
        ? 20
        : 75;
}
/** Exponential waiting time: constant bite chance, independent of how long one has waited.
 * Sample once per cast on the server, rather than rolling once per simulation tick. */
export function randomBiteWait(mean: number, roll = Math.random()) {
  return -Math.log1p(-Math.max(Number.EPSILON, Math.min(1 - Number.EPSILON, roll))) * mean;
}
export function scheduleBite(w: World, p: Player, start = w.time) {
  p.fishCatch = fishingCatch(w, p);
  p.fishAt = start + randomBiteWait(meanBiteWait(w, p));
  p.fishUntil = p.fishAt + 8;
}
export function landedFish(w: World, p: Player) {
  const id = p.fishCatch ?? 'fish';
  return ['largeFish', ...deepFish].includes(id) && !deepBoatFishing(w, p) ? 'fish' : id;
}

import { charterCaptain } from './charter';
import { poweredBoat } from './boats';
// SPDX-License-Identifier: GPL-3.0-or-later
import { deepFishingWater } from './fishing-water';
import type { Player, World } from './types';
export const deepFish = ['cod', 'halibut', 'tuna'] as const;
export function fishingVessel(w: World, p: Player): Player | undefined {
  return p.hitch ? charterCaptain(w, p) : poweredBoat(p.vehicle) ? p : undefined;
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
export function scheduleBite(w: World, p: Player, start = w.time) {
  p.fishCatch = fishingCatch(w, p);
  p.fishAt =
    start +
    (deepBoatFishing(w, p)
      ? 150 + Math.random() * 150
      : fishingVessel(w, p)
        ? 40 + Math.random() * 50
        : w.settings.fishingMode === 5
          ? 20
          : 30 + Math.random() * 90);
  p.fishUntil = p.fishAt + 8;
}
export function landedFish(w: World, p: Player) {
  const id = p.fishCatch ?? 'fish';
  return ['largeFish', ...deepFish].includes(id) && !deepBoatFishing(w, p) ? 'fish' : id;
}

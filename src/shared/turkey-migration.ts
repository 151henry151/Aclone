// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog';
import { worldItems } from './world-catalogue';
import type { World } from './types';

/** Extend old counters once, without replacing an operator's prices or paused quotes. */
export function integrateTurkeys(w: World) {
  if (w.turkeyVersion) return false;
  const items = worldItems(w);
  const introduced = ['turkeys', 'poults', 'turkeyMeat', 'turkeyDinner', 'turkeyPie', 'turkeySoup'];
  for (const b of w.buildings) {
    const def = buildings[b.kind];
    if (!def || b.templateId || b.id === 'parish-government-stores') continue;
    for (const side of ['buy', 'sell'] as const)
      for (const item of introduced)
        if (
          def[side][item] !== undefined &&
          b[side][item] === undefined &&
          b.pausedPrices?.[side]?.[item] === undefined
        )
          b[side][item] = def[side][item];
    // A finite founding flock makes the new species obtainable in established worlds.
    // Never refill a depleted flock, add stock to private stores, or overfill a counter.
    if (
      ['market', 'starport'].includes(b.kind) &&
      b.government &&
      b.owner === 'treasury' &&
      b.stock.turkeys === undefined
    ) {
      const used = Object.entries(b.stock).reduce(
        (sum, [id, count]) => sum + count * (items[id]?.weight ?? 0),
        0,
      );
      b.stock.turkeys = Math.max(
        0,
        Math.min(def.stock.turkeys ?? 0, Math.floor((b.capacity - used) / items.turkeys.weight)),
      );
    }
  }
  w.turkeyVersion = 1;
  w.revision++;
  return true;
}

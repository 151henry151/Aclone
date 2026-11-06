// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { buildings } from './catalog';
import { youngAnimals } from './livestock';
import { meatMenus, rawMeats } from './meat-recipes';
/** Add only missing catalogue listings. A deliberately paused quote stays paused. */
export function integrateMeat(w: World) {
  if (w.meatVersion) return false;
  const introduced = [...Object.keys(youngAnimals), ...rawMeats, ...Object.keys(meatMenus)];
  const ingredients = [...new Set(Object.values(meatMenus).flatMap((m) => Object.keys(m.inputs)))];
  for (const b of w.buildings) {
    const def = buildings[b.kind];
    if (!def || b.templateId || b.id === 'parish-government-stores') continue;
    const ids = [
      ...introduced,
      ...(['kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'].includes(b.kind) ? ingredients : []),
    ];
    for (const side of ['buy', 'sell'] as const)
      for (const item of ids)
        if (
          def[side][item] !== undefined &&
          b[side][item] === undefined &&
          b.pausedPrices?.[side]?.[item] === undefined
        )
          b[side][item] = def[side][item];
  }
  w.meatVersion = 1;
  w.revision++;
  return true;
}

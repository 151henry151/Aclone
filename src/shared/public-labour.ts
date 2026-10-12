// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog.ts';
import type { World, Player } from './types.ts';
// One premium bread-and-water purchase, rounded up to whole denarii.
export const RELIEF_PAY = Math.max(
  4500,
  Math.ceil(((buildings.market.sell.bread + buildings.market.sell.water) * 1.25) / 100) * 100,
);

/** Ordinary short work competes with active hauling, not a perpetual 45d grant.
 * Means-tested relief remains available for food; cooldown survives relog/death. */
export function labourReward(w: World, p: Player) {
  return p.cash + p.bank < 5000 && w.time >= (p.reliefAt ?? -Infinity) + 1800 ? RELIEF_PAY : 100;
}

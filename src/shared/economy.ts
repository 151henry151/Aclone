// SPDX-License-Identifier: GPL-3.0-or-later
import legacyData from '../../data/legacy-prices-0.6.json';
import { buildings, items } from './catalog.ts';
import type { World, Building } from './types.ts';
const legacy: Record<string, { buy: Record<string, number>; sell: Record<string, number> }> =
  legacyData;

/** An owner manages capital and stock; they cannot be their own paid employee. */
export function removeOwnerEmployment(w: World, b: Building) {
  if (!b.owner) return;
  b.employees = b.employees.filter((id) => id !== b.owner);
  const p = w.players[b.owner];
  if (p?.job === b.id) {
    delete p.job;
    p.activeUntil = 0;
  }
  for (const plot of b.plots ?? []) if (plot.harvest?.player === b.owner) plot.harvest.wage = 0;
}

/** Reprice untouched defaults once. Explicit custom quotes and all stock/cash survive. */
export function migrateEconomy(w: World) {
  for (const b of w.buildings) removeOwnerEmployment(w, b);
  if (w.tradePricing === 1) return;
  for (const b of w.buildings) {
    const old = legacy[b.kind],
      current = buildings[b.kind];
    if (!old || !current) continue;
    for (const side of ['buy', 'sell'] as const)
      for (const [item, price] of Object.entries(b[side])) {
        if (price === old[side][item] && current[side][item] !== undefined)
          b[side][item] = current[side][item];
        // Crop listings were created on planting, rather than in buildings.json.
        else if (
          b.kind === 'farm' &&
          side === 'sell' &&
          ['potatoes', 'hops', 'grapes', 'tea', 'coffee'].includes(item) &&
          price === Math.round(items[item].price * 0.9)
        )
          b.sell[item] = items[item].price;
      }
  }
  w.tradePricing = 1;
}

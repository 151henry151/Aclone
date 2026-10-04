// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog.ts';
import type { World, Building } from './types.ts';
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

/** Upgrade public/unowned quotes once; every player-owned price is sacrosanct. */
export function migrateEconomy(w: World) {
  for (const b of w.buildings) removeOwnerEmployment(w, b);
  if (!w.vehicleServicesPricing) {
    for (const b of w.buildings)
      if (['market', 'starport'].includes(b.kind) && b.government && b.owner === 'treasury') {
        b.buy.parishMap ??= buildings[b.kind].buy.parishMap;
        b.sell.parishMap ??= buildings[b.kind].sell.parishMap;
      }
    w.vehicleServicesPricing = 1;
  }
  if (!w.animalPricing) {
    for (const b of w.buildings)
      if (['market', 'starport'].includes(b.kind) && b.government && b.owner === 'treasury') {
        for (const id of ['sheep', 'pigs', 'chickens', 'wool', 'eggs']) {
          b.buy[id] ??= buildings[b.kind].buy[id];
          b.sell[id] ??= buildings[b.kind].sell[id];
          b.stock[id] ??= buildings[b.kind].stock[id] ?? 0;
        }
      }
    w.animalPricing = 1;
  }
  if (!w.livestockPricing) {
    for (const b of w.buildings)
      if (['market', 'starport'].includes(b.kind) && b.government && b.owner === 'treasury') {
        for (const id of ['feed', 'milk', 'cheese', 'dairyMeals']) {
          b.buy[id] ??= buildings[b.kind].buy[id];
          b.sell[id] ??= buildings[b.kind].sell[id];
        }
      }
    w.livestockPricing = 1;
  }
  if ((w.tradePricing ?? 0) >= 4) return;
  for (const b of w.buildings) {
    // Treasury is the built-in public operator, not a human or NPC business owner.
    if (b.owner && !(b.government && b.owner === 'treasury')) continue;
    const current = buildings[b.kind];
    if (!current) continue;
    if ((w.tradePricing ?? 0) < 2) {
      b.buy = { ...current.buy };
      b.sell = { ...current.sell };
    } else {
      // A domestic producer replaces the old import-cost water bids only.
      // Preserve unrelated edits and non-default quotes on unowned businesses.
      if (b.buy.water === 868 && current.buy.water !== undefined) b.buy.water = current.buy.water;
      if (['bnb', 'hotel'].includes(b.kind) && b.sell.water === 1047) b.sell.water = 675;
    }
  }
  // Repair the public pump's fuel/import route without overwriting player prices.
  for (const b of w.buildings) {
    if (b.owner && !(b.government && b.owner === 'treasury')) continue;
    if (b.kind === 'waterworks') {
      if (b.buy.fuel === 2240) b.buy.fuel = 3600;
      if (b.sell.water === 500) b.sell.water = 625;
    } else if (!['market', 'starport'].includes(b.kind) && b.buy.water === 560) b.buy.water = 660;
    if (['bnb', 'hotel'].includes(b.kind) && b.sell.water === 675) b.sell.water = 725;
    if (b.kind === 'market' && b.buy.water === 450) b.buy.water = 600;
    if (b.kind === 'starport' && b.buy.water === 425) b.buy.water = 590;
  }
  w.tradePricing = 4;
}

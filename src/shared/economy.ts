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
  if ((w.tradePricing ?? 0) >= 2) return;
  for (const b of w.buildings) {
    // Treasury is the built-in public operator, not a human or NPC business owner.
    if (b.owner && !(b.government && b.owner === 'treasury')) continue;
    const current = buildings[b.kind];
    if (!current) continue;
    b.buy = { ...current.buy };
    b.sell = { ...current.sell };
  }
  w.tradePricing = 2;
}

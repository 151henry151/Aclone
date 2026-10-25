// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, Stock, World } from './types';
import { shelter } from './lodging';
import { boatPantry } from './fishing-expedition';
export interface AutomaticPantry {
  stock: Stock;
  until: number;
  boat?: boolean;
}
/** Ordered sources, shared by live survival, offline catch-up and the home forecast.
 * A room is private and remains usable only until its booking expires. */
export function automaticPantries(w: World, p: Player): AutomaticPantry[] {
  const home = shelter(w, p);
  const sources: AutomaticPantry[] = [];
  if (home) sources.push({ stock: p.roomPantries?.[home.b.id] ?? home.stock, until: home.until });
  else {
    const boat = boatPantry(w, p);
    if (boat) sources.push({ stock: boat, until: Infinity, boat: true });
  }
  if (w.settings.autoConsumeInventory) sources.push({ stock: p.inventory, until: Infinity });
  if (!home && w.settings.autoConsumeHomeStock) {
    const remote = shelter(w, { ...p, atHome: true });
    if (remote)
      sources.push({ stock: p.roomPantries?.[remote.b.id] ?? remote.stock, until: remote.until });
  }
  return sources;
}
export const homeNeedsMultiplier = (w: World) => w.settings.homeNeedsMultiplier ?? 0.8;

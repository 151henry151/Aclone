// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog.ts';
import { isPublicPuddlewick } from './harbour-supply.ts';
import { log } from './simulation.ts';
import type { World } from './types.ts';

export const EXPORT_INTERVAL = 1800;
/** External customers buy real cargo, not an arbitrary treasury top-up. Bounded
 * loads preserve local shelves; catalogue-capped settlement cannot be inflated
 * by editing a port's bid. The cursor persists across saves and catch-up. */
export function exportShipments(w: World, at: number) {
  if (!isPublicPuddlewick(w)) return;
  const due = Math.floor(at / EXPORT_INTERVAL);
  const previous = w.exportShipment ?? 0;
  if (due <= previous) return;
  w.exportShipment = due;
  const departures = Math.min(48, due - previous);
  const necessities = new Set(['bread', 'water', 'fuel']);
  const population = Object.keys(w.players).length;
  for (const port of w.buildings) {
    if (
      !['market', 'starport'].includes(port.kind) ||
      !port.government ||
      port.owner !== 'treasury' ||
      port.construction
    )
      continue;
    // The emergency shop is not an export terminal.
    if (port.id === 'parish-government-stores') continue;
    const quotes = buildings[port.kind];
    for (const [item, stock] of Object.entries(port.stock)) {
      const bid = quotes.buy[item];
      if (!(bid > 0) || !(port.buy[item] > 0)) continue;
      const reserve = necessities.has(item) ? Math.min(100, Math.max(12, population * 3)) : 8;
      const quantity = Math.max(0, Math.min(Math.floor(stock) - reserve, departures * 40));
      if (!quantity) continue;
      const price = Math.min(Math.floor(bid * 1.1), (quotes.sell[item] ?? bid) - 1);
      if (price <= 0) continue;
      const amount = quantity * price;
      port.stock[item] -= quantity;
      port.investment += amount;
      log(w, 'faucet', amount, 'exports', port.id, 'export shipment', {
        building: port.id,
        item,
        quantity,
      });
    }
  }
}

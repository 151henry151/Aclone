// SPDX-License-Identifier: GPL-3.0-or-later
import { restockBoathouseTackle } from './boathouse-tackle';
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
      !['market', 'starport', 'boathouse'].includes(port.kind) ||
      !port.government ||
      port.owner !== 'treasury' ||
      port.construction
    )
      continue;
    // The emergency shop is not an export terminal.
    if (port.id === 'parish-government-stores') continue;
    if (port.kind === 'boathouse') {
      restockBoathouseTackle(w, port);
      const retail = port.sell.fuel ?? 0;
      const cost = Math.ceil(buildings.boathouse.sell.fuel * 0.8);
      // A finite, paid bunker delivery, not infinite fuel or a recurring grant.
      const highestBid = Math.max(
        0,
        ...w.buildings.filter((b) => b.government).map((b) => b.buy.fuel ?? 0),
      );
      if (retail > highestBid && retail > cost) {
        const n = Math.max(
          0,
          Math.min(
            512 - (port.stock.fuel ?? 0),
            port.capacity - (port.stock.fuel ?? 0),
            Math.floor(port.investment / cost),
            departures * 400,
          ),
        );
        if (n) {
          port.stock.fuel = (port.stock.fuel ?? 0) + n;
          port.investment -= n * cost;
          log(w, 'sink', n * cost, port.id, 'imports', 'boatyard bunker shipment', {
            building: port.id,
            item: 'fuel',
            quantity: n,
          });
        }
      }
    }
    const quotes = buildings[port.kind];
    for (const [item, stock] of Object.entries(port.stock)) {
      if (
        port.kind === 'boathouse' &&
        !['fish', 'largeFish', 'cod', 'halibut', 'tuna'].includes(item)
      )
        continue;
      const bid = quotes.buy[item];
      if (!(bid > 0) || !(port.buy[item] > 0)) continue;
      const reserve = necessities.has(item) ? Math.min(100, Math.max(12, population * 3)) : 8;
      const quantity = Math.max(
        0,
        Math.min(Math.floor(stock) - reserve, departures * (port.kind === 'boathouse' ? 800 : 40)),
      );
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

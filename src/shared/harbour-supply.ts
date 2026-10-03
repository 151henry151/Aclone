// SPDX-License-Identifier: GPL-3.0-or-later
import { items } from './catalog.ts';
import { log } from './simulation.ts';
import type { World, Building } from './types.ts';
/** A small paid import shipment is a safety net, not a replacement for local trade.
 * Only the public starter parish participates. Existing owners/quotes never change.
 * World-time checkpoints prevent reconnects or server restarts granting extra cargo. */
export function harbourSupply(w: World, at: number) {
  if (w.id !== 'puddlewick' || w.owner !== 'server' || w.template !== 'economy') return;
  const due = Math.floor(at / 1800);
  if (due <= (w.harbourShipment ?? -1)) return;
  w.harbourShipment = due;
  const harbour = w.buildings.find(
    (b) => b.kind === 'market' && b.government && b.owner === 'treasury' && !b.construction,
  );
  if (!harbour) return;
  // Count offline residents too: they still need supplies. Limit newcomers/stockpiling.
  const population = Math.max(1, Object.keys(w.players).length);
  for (const item of ['water', 'bread', 'fuel']) {
    const def = items[item];
    const target = Math.min(120, Math.max(6, population * (item === 'water' ? 3 : 1)));
    const local = w.buildings.reduce(
      (n, b) =>
        n +
        (!b.construction &&
        b.owner !== undefined &&
        Number.isSafeInteger(b.sell[item]) &&
        b.sell[item] >= 0
          ? (b.stock[item] ?? 0)
          : !b.construction && !b.owner && Number.isSafeInteger(b.sell[item]) && b.sell[item] >= 0
            ? (b.stock[item] ?? 0)
            : 0),
      0,
    );
    // Never subsidize imports that can be re-exported at a guaranteed profit.
    const bid = Math.max(
      0,
      ...w.buildings.filter((b) => b.government).map((b) => b.buy[item] ?? 0),
    );
    const cost = Math.max(bid + 1, Math.ceil((harbour.sell[item] ?? def.price) * 0.8));
    if (!(harbour.sell[item] > cost)) continue;
    const n = Math.max(
      0,
      Math.min(
        target - local,
        harbour.capacity - (harbour.stock[item] ?? 0),
        Math.floor(harbour.investment / cost),
      ),
    );
    if (!n) continue;
    harbour.stock[item] = (harbour.stock[item] ?? 0) + n;
    harbour.investment -= n * cost;
    log(w, 'sink', n * cost, harbour.id, 'imports', `shortage shipment: ${n} ${item}`);
  }
}

/** Expensive on-demand bread/water imports keep the public safety net available
 * even when its working capital and every local storeroom are empty. The buyer
 * pays the full posted retail quote; imported goods are paid from that receipt. */
export function emergencyImport(w: World, b: Building, item: string) {
  if (
    w.id !== 'puddlewick' ||
    w.owner !== 'server' ||
    w.template !== 'economy' ||
    b.kind !== 'market' ||
    !b.government ||
    b.owner !== 'treasury' ||
    b.construction ||
    !['water', 'bread'].includes(item)
  )
    return false;
  const price = b.sell[item];
  const maxPublicBid = Math.max(
    0,
    ...w.buildings.filter((s) => s.government).map((s) => s.buy[item] ?? 0),
  );
  return Number.isSafeInteger(price) && price > maxPublicBid && price >= items[item].price;
}
export function availableSupply(w: World, b: Building, item: string) {
  return emergencyImport(w, b, item) ? Math.max(100, b.stock[item] ?? 0) : (b.stock[item] ?? 0);
}

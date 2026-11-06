// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World, Stock } from './types';
import { mooringKey } from './boats';
import { worldItems } from './world-catalogue';
import { startVoyage } from './fishing-expedition';
/** Costs follow the goods, including unsold stock carried into a later voyage. */
export function freightBasis(w: World, p: Player, slot: number, cargo: Stock, item: string) {
  const book =
    (p.vehicle === slot ? p.boatHoldBasis : w.mooredBoats?.[mooringKey(p.id, slot)]?.cargoBasis) ??
    {};
  return {
    book: { ...book },
    value: book[item] ?? (cargo[item] ?? 0) * (worldItems(w)[item]?.price ?? 0),
  };
}
export function freightStockCost(
  w: World,
  p: Player,
  slot: number,
  cargo: Stock,
  item: string,
  n: number,
  loading: boolean,
  cost?: number,
) {
  const { book, value } = freightBasis(w, p, slot, cargo, item),
    removed = loading ? 0 : Math.min(value, Math.ceil((value * n) / Math.max(1, cargo[item] ?? 0)));
  book[item] = loading ? value + (cost ?? worldItems(w)[item].price * n) : value - removed;
  if (p.vehicle === slot) p.boatHoldBasis = book;
  else w.mooredBoats![mooringKey(p.id, slot)].cargoBasis = book;
  return removed;
}
export function freightTradeCost(
  w: World,
  p: Player,
  slot: number,
  cargo: Stock,
  item: string,
  n: number,
  buying: boolean,
  total: number,
) {
  const cost = freightStockCost(w, p, slot, cargo, item, n, buying, total);
  if (!buying) {
    const v = startVoyage(w, p);
    v.freightReceipts = (v.freightReceipts ?? 0) + total;
    v.freightCost = (v.freightCost ?? 0) + cost;
  }
}

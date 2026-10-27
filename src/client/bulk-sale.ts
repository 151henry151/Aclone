// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from '../shared/types';
import { MIN_BUY_PRICE } from '../shared/trading';

/** Quote a normal, server-validated trade using the price visible in the shop. */
export function bulkSale(
  b: Pick<Building, 'buy' | 'stock' | 'capacity' | 'investment'>,
  item: string,
  carried: number,
  price: number,
) {
  if (!Number.isSafeInteger(price) || price < MIN_BUY_PRICE || b.buy[item] !== price)
    return { quantity: 0, note: 'Offer changed; reopen the shop to review its prices.' };
  if (carried <= 0) return { quantity: 0, note: 'You have none to sell.' };
  const space = Math.max(0, Math.floor(b.capacity - (b.stock[item] ?? 0)));
  const funds = Math.max(0, Math.floor(b.investment / price));
  // Same per-trade limit as the server; never sell more than the displayed quantity.
  const quantity = Math.min(Math.floor(carried), space, funds, 10000);
  const limits = [
    space < carried ? 'storage' : '',
    funds < carried ? 'buying funds' : '',
    carried > 10000 ? '10,000-item trade limit' : '',
  ].filter(Boolean);
  return {
    quantity,
    note: limits.length
      ? `Limited by ${limits.join(' and ')}. ${carried - quantity} left over.`
      : '',
  };
}

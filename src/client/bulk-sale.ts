// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from '../shared/types';
import { economyRules } from '../shared/economy-rules';

/** Quote a normal, server-validated trade using the price visible in the shop. */
export function bulkSale(
  b: Pick<Building, 'buy' | 'stock' | 'capacity' | 'investment'>,
  item: string,
  carried: number,
  price: number,
  w?: Pick<World, 'settings'>,
) {
  const { minimumBuyPrice, transactionItemLimit } = economyRules(w?.settings);
  if (!Number.isSafeInteger(price) || price < minimumBuyPrice || b.buy[item] !== price)
    return { quantity: 0, note: 'Offer changed; reopen the shop to review its prices.' };
  if (carried <= 0) return { quantity: 0, note: 'You have none to sell.' };
  const space = Math.max(0, Math.floor(b.capacity - (b.stock[item] ?? 0)));
  const funds = Math.max(0, Math.floor(b.investment / price));
  // Same per-trade limit as the server; never sell more than the displayed quantity.
  const quantity = Math.min(Math.floor(carried), space, funds, transactionItemLimit);
  const limits = [
    space < carried ? 'storage' : '',
    funds < carried ? 'buying funds' : '',
    carried > transactionItemLimit
      ? `${transactionItemLimit.toLocaleString('en-US')}-item trade limit`
      : '',
  ].filter(Boolean);
  return {
    quantity,
    note: limits.length
      ? `Limited by ${limits.join(' and ')}. ${carried - quantity} left over.`
      : '',
  };
}

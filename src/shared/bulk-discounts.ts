// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from './types';
export interface BulkDiscount {
  quantity: number;
  percent: number;
}
export const DEFAULT_BULK_DISCOUNTS: readonly BulkDiscount[] = Object.freeze([
  Object.freeze({ quantity: 100, percent: 1 }),
  Object.freeze({ quantity: 250, percent: 2 }),
  Object.freeze({ quantity: 500, percent: 3 }),
]);
/** Missing means defaults; an empty array explicitly disables all discounts. */
export function bulkDiscounts(b: Building): readonly BulkDiscount[] {
  // Public import/export prices are economic anchors, not privately managed offers.
  return (
    b.bulkDiscounts ??
    (b.government || b.owner === 'treasury' || b.kind === 'starport' ? [] : DEFAULT_BULK_DISCOUNTS)
  );
}
export function validateBulkDiscounts(value: unknown): BulkDiscount[] {
  if (!Array.isArray(value) || value.length > 5)
    throw Error('Use at most five bulk discount levels');
  const tiers = value
    .map((t) => {
      if (
        !t ||
        typeof t !== 'object' ||
        !Number.isSafeInteger(t.quantity) ||
        t.quantity < 2 ||
        t.quantity > 10000 ||
        typeof t.percent !== 'number' ||
        !Number.isFinite(t.percent) ||
        t.percent < 0 ||
        t.percent > 100 ||
        Math.abs(t.percent * 100 - Math.round(t.percent * 100)) > 1e-7
      )
        throw Error(
          'Bulk levels need whole quantities from 2 to 10,000 and discounts from 0 to 100% (up to two decimal places)',
        );
      return { quantity: t.quantity as number, percent: t.percent as number };
    })
    .sort((a, b) => a.quantity - b.quantity);
  for (let i = 1; i < tiers.length; i++) {
    if (tiers[i].quantity === tiers[i - 1].quantity)
      throw Error('Bulk quantities must be different');
    if (tiers[i].percent < tiers[i - 1].percent)
      throw Error('Larger bulk levels must not give smaller discounts');
  }
  return tiers;
}
/** One item, one transaction; the highest qualifying tier applies to the whole batch.
 * Round once, upward to the smallest currency unit, so fractions cannot become free goods. */
export function bulkPurchaseQuote(b: Building, price: number, quantity: number) {
  const percent = bulkDiscounts(b).reduce(
    (rate, t) => (quantity >= t.quantity ? Math.max(rate, t.percent) : rate),
    0,
  );
  const subtotal = price * quantity;
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) throw Error('Trade too large');
  // Preserve exact currency rounding even when the intermediate product exceeds 2^53.
  const total = Number(
    (BigInt(subtotal) * BigInt(10000 - Math.round(percent * 100)) + 9999n) / 10000n,
  );
  return { subtotal, total, percent, saving: subtotal - total };
}
export function tradeTotal(b: Building, item: string, direction: string, quantity: number) {
  return direction === 'buy'
    ? bulkPurchaseQuote(b, b.sell[item], quantity).total
    : b.buy[item] * quantity;
}

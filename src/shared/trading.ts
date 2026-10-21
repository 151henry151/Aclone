// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from './types.ts';

export const MIN_BUY_PRICE = 100; // One denarius, in integer hundredths.

/** Paused quotes are retained separately; all market consumers see only active offers. */
export function setTradingOffer(
  b: Building,
  side: 'buy' | 'sell',
  item: string,
  enabled: boolean,
  price?: number,
) {
  if (!enabled) {
    const saved = price ?? b[side][item];
    if (saved !== undefined) {
      b.pausedPrices ??= {};
      (b.pausedPrices[side] ??= {})[item] = saved;
    }
    delete b[side][item];
    return;
  }
  if (
    price === undefined ||
    !Number.isSafeInteger(price) ||
    price < (side === 'buy' ? MIN_BUY_PRICE : 0)
  )
    throw Error(side === 'buy' ? 'Buying prices must be at least 1d' : 'Invalid selling price');
  b[side][item] = price;
  if (b.pausedPrices?.[side]) delete b.pausedPrices[side]![item];
}

/** Upgrade legacy free purchases safely, after other catalogue migrations. */
export function normalizeTradingOffers(b: Building) {
  for (const [item, price] of Object.entries(b.buy)) {
    if (price <= 0) setTradingOffer(b, 'buy', item, false);
    else if (price < MIN_BUY_PRICE) b.buy[item] = MIN_BUY_PRICE;
  }
  // A catalogue migration must not reopen explicitly suspended trading.
  for (const side of ['buy', 'sell'] as const)
    for (const item of Object.keys(b.pausedPrices?.[side] ?? {})) delete b[side][item];
}

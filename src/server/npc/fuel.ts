// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from '../../shared/types';
import type { Trailer } from '../../shared/trailers';
import { fuelRules } from '../../shared/fuel-rules';
import { fuelShopPrice, fuelTrailerQuote } from '../../shared/fuel-sales';
import { canCarry } from '../../shared/simulation';
import { householdBudget } from './household';
/** Recheck before execution as well as planning: a stale plan cannot spend meal reserves. */
export function residentFuelQuote(w: World, p: Player, t: Trailer, quantity = 1) {
  const rules = fuelRules(w.settings),
    budget = householdBudget(w, p),
    reserve = budget.reserve - budget.fuel;
  if (!rules.fuelTankerNpcPurchasing) throw Error('Resident tanker purchasing is disabled');
  if (
    w.buildings.some(
      (b) =>
        !b.construction &&
        b.owner !== p.id &&
        Math.hypot(b.x - p.x, b.z - p.z) <= 18 &&
        (b.stock.fuel ?? 0) > 0 &&
        Number.isSafeInteger(b.sell.fuel) &&
        b.sell.fuel >= 0 &&
        p.cash - reserve >= b.sell.fuel &&
        canCarry(p, 'fuel', 1, w),
    )
  )
    throw Error('Use the nearby fuel shop');
  const quote = fuelTrailerQuote(w, p, t, 'buy', quantity);
  if (quote.price > fuelShopPrice(w) * rules.fuelTankerNpcPriceFactor)
    throw Error('Roadside fuel is too expensive for a resident');
  if (p.cash - quote.gross < reserve) throw Error('Keep the household meal and shelter reserve');
  return quote;
}
export function nearbyFuelTanker(w: World, p: Player) {
  return Object.values(w.trailers ?? {})
    .filter((t) => {
      try {
        residentFuelQuote(w, p, t);
        return true;
      } catch {
        return false;
      }
    })
    .sort(
      (a, b) =>
        (a.sellPrice ?? 0) - (b.sellPrice ?? 0) ||
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
}
export function checkResidentFuelPurchase(w: World, p: Player, a: Action) {
  if (a.type !== 'fuelTrailer') return;
  const t = w.trailers?.[String(a.id)];
  if (!t || a.operation !== 'buy') throw Error('Choose a nearby tanker inventory purchase');
  residentFuelQuote(w, p, t, Number(a.quantity));
}

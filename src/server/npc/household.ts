// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World, Stock } from '../../shared/types.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { alcoholDose } from '../../shared/intoxication.ts';

/** Only a currently owned house or an unexpired personal room is a household. */
export function household(w: World, p: Player) {
  return (
    w.buildings.find(
      (b) =>
        !b.construction &&
        b.id === p.home &&
        ((b.kind === 'home' && b.owner === p.id) || (b.lodging?.guests[p.id]?.until ?? 0) > w.time),
    ) ?? w.buildings.find((b) => !b.construction && b.kind === 'home' && b.owner === p.id)
  );
}
export function householdStock(w: World, p: Player): Stock {
  const b = household(w, p);
  return b ? (b.kind === 'home' ? b.stock : b.lodging!.guests[p.id].stock) : {};
}
export function nutritionIn(w: World, stock: Stock, nutrient: 'food' | 'drink') {
  const catalogue = worldItems(w);
  return Object.entries(stock).reduce(
    (sum, [id, n]) => sum + Math.max(0, n) * (catalogue[id]?.[nutrient] ?? 0),
    0,
  );
}
/** Quotes are from the caller's perceived world, never a hidden market query.
 * Reserve is a target, not a cash grant or a rule preventing emergency purchases. */
export function householdBudget(w: World, p: Player, seconds = 6 * 3600) {
  const catalogue = worldItems(w),
    h = household(w, p),
    stock = householdStock(w, p);
  const roomSeconds =
    h?.kind === 'home'
      ? seconds
      : Math.max(0, Math.min(seconds, (h?.lodging?.guests[p.id]?.until ?? w.time) - w.time));
  const coveredRateSeconds = seconds - 0.2 * roomSeconds;
  let food = 0,
    drink = 0;
  for (const [nutrient, deficit, rate] of [
    ['food', p.hunger, w.settings.hungerRate],
    ['drink', p.thirst, w.settings.thirstRate],
  ] as const) {
    // Half carried value is conservative for repeated manual servings; home meals use full value.
    const units = Math.max(
      0,
      deficit -
        15000 +
        coveredRateSeconds * rate -
        nutritionIn(w, stock, nutrient) -
        nutritionIn(w, p.inventory, nutrient) * 0.5,
    );
    const quotes = w.buildings.flatMap((b) =>
      Object.entries(b.sell).flatMap(([id, price]) =>
        !b.construction &&
        b.owner !== p.id &&
        price >= 0 &&
        (b.stock[id] ?? 0) > 0 &&
        catalogue[id]?.[nutrient] &&
        !alcoholDose(id)
          ? [{ price, value: catalogue[id][nutrient]! }]
          : [],
      ),
    );
    const fallback = Object.entries(catalogue)
      .filter(([id, d]) => d[nutrient] && !alcoholDose(id))
      .map(([, d]) => ({ price: d.price, value: d[nutrient]! }));
    const best = (quotes.length ? quotes : fallback).sort(
      (a, b) => a.price / a.value - b.price / b.value,
    )[0];
    const cost = best ? Math.ceil(units / best.value) * best.price : 0;
    if (nutrient === 'food') food = cost;
    else drink = cost;
  }
  const rent = h?.lodging
    ? Math.ceil(Math.max(0, seconds - roomSeconds) / 3600) * h.lodging.rate
    : 0;
  const hasFuel = Object.entries(p.inventory).some(([item, n]) => n > 0 && catalogue[item]?.fuel);
  const fuelQuotes = w.buildings
    .filter(
      (b) => !b.construction && b.owner !== p.id && (b.stock.fuel ?? 0) > 0 && b.sell.fuel > 0,
    )
    .map((b) => b.sell.fuel);
  const fuel =
    p.fuel < 8 && !hasFuel
      ? fuelQuotes.length
        ? Math.min(...fuelQuotes)
        : (catalogue.fuel?.price ?? 0)
      : 0;
  return {
    food,
    drink,
    rent,
    fuel,
    reserve: Math.ceil(food + drink + rent + fuel),
    horizonSeconds: seconds,
    housed: !!h,
    reminder:
      'Reserve covers meals, valid shelter and one fuel purchase when low; wages and trade receipts must also pay longer travel and business costs.',
  };
}

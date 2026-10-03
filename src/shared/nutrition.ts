import { alcoholDose, drinkAlcohol } from './intoxication.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, ItemDef, Stock, World } from './types.ts';
import { worldItems } from './world-catalogue.ts';
/** Nutrition changes are bounded and last only for this life. Old saves retain 60000. */
export const maximumHealth = (p: Pick<Player, 'nutrition'>) =>
  60000 + Math.max(-6000, Math.min(6000, p.nutrition ?? 0));
export function nutritionEffects(p: Player, item: ItemDef, count = 1) {
  if (item.maxHealth)
    p.nutrition = Math.max(-6000, Math.min(6000, (p.nutrition ?? 0) + item.maxHealth * count));
  p.health = Math.max(1, Math.min(maximumHealth(p), p.health + (item.health ?? 0) * count));
}
export function nutritionDescription(d: ItemDef) {
  return [
    d.food ? `Hunger −${d.food}` : '',
    d.drink ? `Thirst −${d.drink}` : '',
    d.health ? `Health ${d.health > 0 ? '+' : ''}${d.health}` : '',
    d.maxHealth ? `Maximum health ${d.maxHealth > 0 ? '+' : ''}${d.maxHealth} this life` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
/** Threshold feeding is instantaneous; survival advances to the next threshold.
 * Bulk servings avoid unbounded loops for creator goods with tiny food effects. */
export function feedShelterNow(w: World, p: Player, stock: Stock, at = w.time) {
  const items = worldItems(w);
  for (const [need, nutrient] of [
    ['hunger', 'food'],
    ['thirst', 'drink'],
  ] as const) {
    if (p[need] < 30000) continue;
    const choices = Object.entries(items)
      .filter(([key, d]) => (stock[key] ?? 0) > 0 && (d[nutrient] ?? 0) > 0)
      .sort(
        ([a], [b]) =>
          alcoholDose(a) - alcoholDose(b) || Number(a === p.lastFood) - Number(b === p.lastFood),
      );
    for (const [key, d] of choices) {
      if (p[need] < 30000) break;
      const count = Math.min(
        stock[key] ?? 0,
        Math.max(1, Math.ceil((p[need] - 15000) / d[nutrient]!)),
      );
      stock[key] -= count;
      p.hunger = Math.max(0, p.hunger - (d.food ?? 0) * count);
      p.thirst = Math.max(0, p.thirst - (d.drink ?? 0) * count);
      nutritionEffects(p, d, count);
      drinkAlcohol(p, key, at, count);
      p.lastFood = key;
      p.repeats = 0;
    }
  }
}
export function nextShelterMeal(
  w: World,
  p: Player,
  stock: Stock,
  hungerRate: number,
  thirstRate: number,
) {
  const items = worldItems(w);
  let next = Infinity;
  for (const [need, nutrient, rate] of [
    ['hunger', 'food', hungerRate],
    ['thirst', 'drink', thirstRate],
  ] as const)
    if (
      rate > 0 &&
      p[need] < 30000 &&
      Object.entries(stock).some(([key, n]) => n > 0 && (items[key]?.[nutrient] ?? 0) > 0)
    )
      next = Math.min(next, (30000 - p[need]) / rate);
  return next;
}

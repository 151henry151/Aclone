// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types';
import { shelter } from './lodging';
import { feedShelterNow, nextShelterMeal } from './nutrition';
import { automaticPantries, homeNeedsMultiplier } from './automatic-provisions';
import { worldItems } from './world-catalogue';

export interface ProvisionEstimate {
  seconds: number;
  /** First category with no usable servings left, not time until hunger damage or death. */
  exhausted?: string;
  limit?: 'booking' | 'calculation';
}
/** Read-only, event-based forecast using exactly the home's automatic meal selection.
 * Mixed food/drink items are consumed once. Cap work for huge creator stockpiles. */
export function homeProvisions(w: World, p: Player): ProvisionEstimate | undefined {
  const home = shelter(w, p);
  if (!home) return;
  const stocks = automaticPantries(w, p).map(({ stock }) => ({ ...stock }));
  const q = { ...p };
  const foodRate = Math.max(0, w.settings.hungerRate) * homeNeedsMultiplier(w);
  const drinkRate = Math.max(0, w.settings.thirstRate) * homeNeedsMultiplier(w);
  if (!foodRate && !drinkRate) return { seconds: Infinity };
  const items = worldItems(w);
  const empty = () => {
    const has = (nutrient: 'food' | 'drink') =>
      stocks.some((stock) =>
        Object.entries(stock).some(([id, n]) => n > 0 && (items[id]?.[nutrient] ?? 0) > 0),
      );
    const missing = [
      foodRate && !has('food') ? 'food' : '',
      drinkRate && !has('drink') ? 'drink' : '',
    ].filter(Boolean);
    return missing.join(' and ');
  };
  if (empty()) return { seconds: 0, exhausted: empty() };
  let seconds = Math.max(0, (p.needsGraceUntil ?? 0) - w.time);
  const booking = home.until - w.time;
  for (let i = 0; i < 1024; i++) {
    if (seconds >= booking) return { seconds: booking, limit: 'booking' };
    for (const key of ['hunger', 'thirst'] as const)
      if (Math.abs(q[key] - 30000) < 1e-7) q[key] = 30000;
    for (const stock of stocks) feedShelterNow(w, q, stock, w.time + seconds);
    const exhausted = empty();
    if (exhausted) return { seconds, exhausted };
    const next = Math.min(
      ...stocks.map((stock) => nextShelterMeal(w, q, stock, foodRate, drinkRate)),
    );
    if (!Number.isFinite(next) || next <= 0) return { seconds, limit: 'calculation' };
    seconds += next;
    q.hunger = Math.min(50000, q.hunger + next * foodRate);
    q.thirst = Math.min(50000, q.thirst + next * drinkRate);
  }
  return { seconds, limit: 'calculation' };
}

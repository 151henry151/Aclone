// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, World, Player } from '../../shared/types.ts';
import type { Step } from './decision.ts';

export type TradeQuotes = Record<string, number>;
const key = (a: { building: unknown; direction: unknown; item: unknown }) =>
  `${a.building}:${a.direction}:${a.item}`;
/** Only observed quotes enter the plan. Unseen remote markets are never queried. */
export function planQuotes(w: World, plan: Step[]): TradeQuotes {
  const result: TradeQuotes = {};
  for (const s of plan) {
    if (s.kind !== 'act' || s.action.type !== 'trade') continue;
    const a = s.action,
      b = w.buildings.find((b) => b.id === a.building);
    const price = b?.[a.direction === 'buy' ? 'sell' : 'buy'][a.item];
    if (price !== undefined) result[key(a)] = price;
  }
  return result;
}
export function changedQuote(w: World, p: Player, a: Action, quotes?: TradeQuotes) {
  if (a.type !== 'trade' || !quotes || typeof a.building !== 'string' || typeof a.item !== 'string')
    return;
  const agreed = quotes[key({ building: a.building, direction: a.direction, item: a.item })];
  const b = w.buildings.find((b) => b.id === a.building);
  // Price is observable when interacting. Never preflight distant live stock.
  if (!b || Math.hypot(b.x - p.x, b.z - p.z) > 18 || agreed === undefined) return;
  const current = b[a.direction === 'buy' ? 'sell' : 'buy'][a.item];
  if (current === undefined || (a.direction === 'buy' ? current > agreed : current < agreed))
    return 'The observed trade quote changed unfavourably. Recalculate this route before trading.';
}

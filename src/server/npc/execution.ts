import { householdBudget } from './household.ts';
import { retainedCapital, procurementTarget } from './business-policy.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
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

/** Project funding may be minutes old by arrival. Recheck the real till before
 * every owner draw; never consume newly needed payroll or investor claims. */
export function checkOwnerCapitalAction(
  w: World,
  p: Player,
  a: Action,
  remaining: Step[] = [],
  quotes: TradeQuotes = {},
) {
  if (a.type !== 'investment' || a.direction !== 'withdraw') return;
  const b = w.buildings.find((b) => b.id === a.building);
  if (!b || b.owner !== p.id) return; // Ordinary action rejects unauthorized draws.
  const surplus = Math.max(0, b.investment - remainingClaim(b) - retainedCapital(w, b));
  // Input-purchasing capital is allowed to become stock, rather than being
  // frozen as cash. Match an observed purchase to a later delivery to THIS shop.
  const delivered = { ...b.stock };
  let purchasing = 0;
  const bought: Record<string, { quantity: number; price: number }[]> = {};
  for (const step of remaining) {
    if (step.kind !== 'act') continue;
    const next = step.action;
    if (next.type === 'trade' && next.direction === 'buy') {
      const price = quotes[key(next)];
      if (price !== undefined && price >= 0)
        (bought[next.item] ??= []).push({ quantity: next.quantity, price });
    }
    if (next.type !== 'stock' || next.direction !== 'deposit' || next.building !== b.id) continue;
    let need = Math.min(
      next.quantity,
      Math.max(0, procurementTarget(w, b, next.item) - (delivered[next.item] ?? 0)),
    );
    for (const lot of bought[next.item] ?? []) {
      const n = Math.min(need, lot.quantity);
      lot.quantity -= n;
      need -= n;
      purchasing += n * lot.price;
      delivered[next.item] = (delivered[next.item] ?? 0) + n;
    }
  }
  const shortfall = Math.max(
    0,
    purchasing - Math.max(0, p.cash - householdBudget(w, p, 86400).reserve),
  );
  const procurement = Math.min(
    shortfall,
    Math.max(0, b.investment - remainingClaim(b) - retainedCapital(w, { ...b, stock: delivered })),
  );
  const available = Math.min(ownerWithdrawable(w, b), Math.max(surplus, procurement));
  if (Number(a.amount) > available)
    throw Error('Business reserves changed; recalculate project funding before withdrawing.');
}

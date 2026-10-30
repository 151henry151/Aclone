// SPDX-License-Identifier: GPL-3.0-or-later
import type { Ledger, Player, Stock, World } from './types.ts';

export interface PlayerStatistics {
  since: number;
  partialHistory: boolean;
  earned: number;
  spent: number;
  otherReceived: number;
  capitalIn: number;
  capitalOut: number;
  buildingsCompleted: number;
  bugBounties?: number;
  /** Stable operator award IDs prevent duplicate grants on retry. */
  bugBountyAwards?: string[];
  gathered: Stock;
  harvested: Stock;
}
export interface PlaytimeStatistics {
  since: string;
  recordedSeconds: number;
  estimatedSeconds: number;
}
export function playerStatistics(w: World, p: Player, partialHistory = true): PlayerStatistics {
  return (p.statistics ??= {
    since: w.time,
    partialHistory,
    earned: 0,
    spent: 0,
    otherReceived: 0,
    capitalIn: 0,
    capitalOut: 0,
    buildingsCompleted: 0,
    gathered: {},
    harvested: {},
  });
}
/** Personal cash flows only. Business tills retain their own separate accounts. */
export function recordPlayerMoney(w: World, e: Ledger) {
  if (e.reason === 'bank') return; // Moving one's savings is neither income nor expenditure.
  const capital = [
    'investment',
    'withdrawal',
    'outside stake',
    'stake refund',
    'investor return',
    'loan disbursement',
    'loan repayment',
  ].includes(e.reason);
  const earned = [
    'sale',
    'wage',
    'deckhand profit share',
    'charter fare',
    'harvest wage',
    'labour task',
    'property sale',
    'property auction settlement',
    'town purchase',
    'prepaid operating rent',
    'player trade',
    'parish supply delivery',
    'course prize',
    'combat reward',
    'Annual lottery prize',
  ].includes(e.reason);
  const participant = (id: string) =>
    w.players[id] ?? (id.endsWith(':bank') ? w.players[id.slice(0, -5)] : undefined);
  const from = participant(e.from);
  const to = participant(e.to);
  if (from) {
    const s = playerStatistics(w, from);
    if (capital) s.capitalOut += e.amount;
    else s.spent += e.amount;
  }
  if (to) {
    const s = playerStatistics(w, to);
    if (capital) s.capitalIn += e.amount;
    else if (earned) s.earned += e.amount;
    else s.otherReceived += e.amount;
  }
}
export function recordGathered(w: World, p: Player, item: string, amount: number, harvest = false) {
  const s = playerStatistics(w, p);
  const stock = harvest ? s.harvested : s.gathered;
  stock[item] = (stock[item] ?? 0) + amount;
}

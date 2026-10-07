// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog.ts';
import type { Building, Player, World } from './types.ts';

/** Modest note-style profit on working capital, not a private-equity windfall. */
export const OUTSIDE_RETURN_PERCENT = 8;

export type OutsideStake = {
  investor: string;
  principal: number;
  claim: number;
  paid: number;
  opened: number;
};

export function stakeClaim(principal: number) {
  return Math.floor((principal * (100 + OUTSIDE_RETURN_PERCENT)) / 100);
}

/** Rewrite the first-day 25% claims down to the current 8% cap. */
export function migrateOutsideClaims(w: World) {
  for (const b of w.buildings) {
    if (!b.stakes?.length) continue;
    b.stakes = b.stakes.filter((s) => {
      if (s.claim === Math.floor((s.principal * 125) / 100)) {
        s.claim = stakeClaim(s.principal);
        if (s.paid > s.claim) s.paid = s.claim;
      }
      return s.paid < s.claim;
    });
    if (!b.stakes.length) delete b.stakes;
  }
}

export function unpaidPrincipal(b: Building) {
  return (b.stakes ?? []).reduce((n, s) => n + Math.max(0, s.principal - s.paid), 0);
}

export function remainingClaim(b: Building) {
  return (b.stakes ?? []).reduce((n, s) => n + Math.max(0, s.claim - s.paid), 0);
}

export function operatingReserve(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  let reserve = b.wage * Math.max(1, b.employees.length);
  if (recipe && b.kind !== 'farm')
    for (const [item, n] of Object.entries(recipe.inputs)) reserve += n * (b.buy[item] ?? 0);
  const bids = Object.values(b.buy).filter((price) => price > 0);
  if (bids.length) reserve = Math.max(reserve, Math.min(...bids));
  return Math.max(reserve, 2000);
}

export function collectableReturn(w: World, b: Building, investor: string) {
  const stake = b.stakes?.find((s) => s.investor === investor);
  if (!stake) return 0;
  const remaining = Math.max(0, stake.claim - stake.paid);
  const profit = Math.max(0, b.investment - (b.watermark ?? b.investment));
  const surplus = Math.max(0, b.investment - operatingReserve(w, b));
  return Math.min(remaining, profit, surplus);
}

export function ownerWithdrawable(w: World, b: Building, keepReserve = false) {
  const lock = remainingClaim(b) + (keepReserve ? operatingReserve(w, b) : 0);
  return Math.max(0, b.investment - lock);
}

export function ownerDrawNeed(w: World, p: Player) {
  let need = 0;
  if (p.cash < 4000) need += 4000 - p.cash;
  if (p.fuel < 10) {
    const carried = (p.inventory.fuel ?? 0) > 0;
    if (!carried) {
      const shop = w.buildings
        .filter((b) => !b.construction && (b.sell.fuel ?? 0) > 0 && (b.stock.fuel ?? 0) > 0)
        .sort((a, c) => a.sell.fuel - c.sell.fuel)[0];
      need += shop?.sell.fuel ?? 800;
    }
  }
  return need;
}

export function raiseWatermark(b: Building, added: number) {
  if (added <= 0) return;
  b.watermark = (b.watermark ?? b.investment - added) + added;
}

export function addOutsideStake(w: World, b: Building, investor: string, amount: number) {
  b.stakes ??= [];
  const existing = b.stakes.find((s) => s.investor === investor);
  if (existing) {
    existing.principal += amount;
    existing.claim += stakeClaim(amount);
  } else
    b.stakes.push({
      investor,
      principal: amount,
      claim: stakeClaim(amount),
      paid: 0,
      opened: w.time,
    });
  raiseWatermark(b, amount);
}

/** Pay back unpaid principal from the till when the shop is demolished or emptied. */
export function takeStakeRefunds(b: Building) {
  const refunds: { investor: string; amount: number }[] = [];
  for (const s of b.stakes ?? []) {
    const due = Math.max(0, s.principal - s.paid);
    const pay = Math.min(due, b.investment);
    if (pay <= 0) continue;
    b.investment -= pay;
    s.paid += pay;
    refunds.push({ investor: s.investor, amount: pay });
  }
  delete b.stakes;
  return refunds;
}

export function applyOutsideCollect(w: World, b: Building, investor: string, amount: number) {
  const stake = b.stakes?.find((s) => s.investor === investor);
  if (!stake) return 0;
  const due = Math.min(amount, collectableReturn(w, b, investor));
  if (due <= 0) return 0;
  stake.paid += due;
  b.investment -= due;
  b.watermark = (b.watermark ?? 0) + due;
  if (stake.paid >= stake.claim) b.stakes = (b.stakes ?? []).filter((s) => s !== stake);
  return due;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { playerStatistics } from '../shared/player-statistics';
import { log } from '../shared/simulation';

/** Operator-only helper. Persist the world and its audit receipt atomically after granting. */
export function awardBugBounty(w: World, p: Player, awardId: string, amount: number) {
  if (!awardId.trim() || !Number.isSafeInteger(amount) || amount <= 0)
    throw Error('A bounty needs a stable award ID and a positive integer amount');
  const stats = playerStatistics(w, p);
  if (stats.bugBountyAwards?.includes(awardId)) return false;
  if (!Number.isSafeInteger(p.cash + amount)) throw Error('Bounty would overflow cash');
  p.cash += amount;
  log(w, 'faucet', amount, 'operator', p.id, 'bug bounty');
  stats.bugBounties = (stats.bugBounties ?? 0) + 1;
  (stats.bugBountyAwards ??= []).push(awardId);
  return true;
}

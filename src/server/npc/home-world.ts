// SPDX-License-Identifier: GPL-3.0-or-later
import type { ResidentState } from './memory.ts';
import type { World } from '../../shared/types.ts';
import type { Account } from '../universe.ts';
import { systemFor } from './space.ts';

/** Operator home-world policy migration. Keep each world's character and assets
 * intact; never carry local currency, stock or skills between economies. */
export function returnResidentHome(
  state: ResidentState,
  home: World,
  away: World,
  account: Account,
) {
  const visitor = away.players[state.playerId];
  if (visitor) {
    visitor.online = false;
    visitor.speed = 0;
    visitor.lastSeen = away.time;
  }
  state.world = home.id;
  state.inSpace = false;
  state.plan = [];
  state.index = state.repeats = state.until = state.waitUntil = state.nextAt = 0;
  state.needsDecision = true;
  state.cursor = home.messageSeq ?? 0;
  state.intent =
    'Resume my home-world responsibilities and develop the town I founded, preserving household and business reserves.';
  // World-local IDs and clocks cannot be reused in the destination economy.
  for (const key of [
    'followThrough',
    'career',
    'ambition',
    'supplyGoal',
    'markets',
    'suspendedPlan',
    'routine',
    'evaluation',
    'observedDeaths',
    'observedTask',
    'recovery',
    'tradeQuotes',
    'businessCargo',
    'businessProceeds',
    'pausedInputBids',
    'strategyReviewedAt',
    'agenda',
    'plannerRetryAt',
    'pending',
    'helpQuestion',
    'questionFrom',
    'questionFromName',
    'replyTo',
    'conversationId',
    'groupQuestion',
    'publicConversations',
    'dialogueAttempt',
    'pendingAgreementReply',
    'lastOutcome',
  ] as const)
    delete state[key];
  account.system = systemFor(home.id);
  delete account.transit;
}

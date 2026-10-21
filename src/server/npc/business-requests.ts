// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World, Player, Action } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { Commitment } from './commitments.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { inputStockTarget, retainedCapital } from './business-policy.ts';
import { visitBuilding } from './care.ts';
import { operation } from './player-operations.ts';
import type { FarmerChoice } from './farmer.ts';

export const businessRequestSchema = z
  .object({
    building: z.string().min(1).max(80).describe('Exact ID of a business YOU own.'),
    keepDenarii: z
      .number()
      .min(0)
      .max(1000000)
      .multipleOf(0.01)
      .nullable()
      .describe(
        'Withdraw excess cash while leaving this many DENARII in the till, plus protected investor claims. The engine also preserves its minimum operating reserve. Null means no withdrawal.',
      ),
    pricing: z
      .object({
        item: z.string().min(1).max(80),
        side: z.enum(['buy', 'sell']),
        enabled: z.boolean(),
        priceDenarii: z
          .number()
          .min(0)
          .max(100000)
          .multipleOf(0.01)
          .nullable()
          .describe(
            'Exact agreed price in DENARII. Required when enabling a quote; null when disabling.',
          ),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type BusinessRequest = z.infer<typeof businessRequestSchema>;
const unfinished = (c: Commitment, world: string) =>
  c.world === world && ['pending', 'blocked'].includes(c.status);
const internal = (d: number) => Math.round(d * 100);
export function businessRequestBlocker(
  w: World,
  p: Player,
  request: BusinessRequest,
  pricingDone = false,
) {
  const b = w.buildings.find((b) => b.id === request.building);
  if (!b || b.owner !== p.id || b.construction || b.government || b.operatingLease)
    return 'I need a completed business that I own outright to change its prices or withdraw its cash.';
  if (request.keepDenarii === null && !request.pricing)
    return 'No withdrawal or price change was specified.';
  const q = pricingDone ? null : request.pricing;
  if (!q) return;
  if (!worldItems(w)[q.item]) return 'I cannot identify that trading item.';
  if (q.enabled && (q.priceDenarii === null || (q.side === 'buy' && q.priceDenarii < 1)))
    return 'Enabling a quote needs an exact price; a buy offer must be at least 1d.';
  const target = inputStockTarget(b, q.item);
  if (q.enabled && q.side === 'buy' && target !== undefined && (b.stock[q.item] ?? 0) >= target)
    return `I already have ${b.stock[q.item] ?? 0} ${q.item}; my current input target is ${target} because of the inputs and finished goods in stock. I should sell output before reopening purchases.`;
}
function drawAmount(w: World, p: Player, request: BusinessRequest) {
  const b = w.buildings.find((b) => b.id === request.building)!;
  const keep = Math.max(internal(request.keepDenarii ?? 0), retainedCapital(w, b));
  return Math.max(
    0,
    Math.min(10_000_000, ownerWithdrawable(w, b), b.investment - remainingClaim(b) - keep),
  );
}
function complete(c: Commitment) {
  if (
    (c.business!.keepDenarii === null || c.businessProgress?.withdrawalDone) &&
    (!c.business!.pricing || c.businessProgress?.pricingDone)
  ) {
    c.status = 'completed';
    c.outcome += ' Business agreement fulfilled.';
  }
}
export function businessRequestChoice(
  w: World,
  p: Player,
  c: Commitment,
): FarmerChoice | undefined {
  const request = c.business!;
  const blocked = businessRequestBlocker(w, p, request, c.businessProgress?.pricingDone);
  if (blocked) {
    c.status = 'blocked';
    c.outcome = blocked;
    return;
  }
  c.businessProgress ??= {};
  const b = w.buildings.find((b) => b.id === request.building)!;
  let action: Action | undefined;
  // Complete a price change first; reserve calculation then sees the new price.
  if (request.pricing && !c.businessProgress.pricingDone) {
    const q = request.pricing;
    action = {
      type: 'buildingAdmin',
      building: b.id,
      item: q.item,
      side: q.side,
      enabled: q.enabled,
      ...(q.enabled ? { price: internal(q.priceDenarii!) } : {}),
    };
  } else if (request.keepDenarii !== null && !c.businessProgress.withdrawalDone) {
    const amount = drawAmount(w, p, request);
    if (amount > 0) action = { type: 'investment', building: b.id, direction: 'withdraw', amount };
    else {
      c.businessProgress.withdrawalDone = true;
      c.outcome = `No excess cash to withdraw after preserving ${request.keepDenarii}d or the higher operating reserve, and investor claims. Nothing withdrawn.`;
    }
  }
  if (!action) {
    complete(c);
    return;
  }
  c.status = 'pending';
  c.outcome =
    'Business change agreed but not yet performed; terms will be checked again on arrival.';
  return {
    id: `commitment_${c.id}`,
    description: `Carry out my business agreement: ${c.summary}. ${c.outcome}`,
    plan: visitBuilding(p, b, [
      action.type === 'investment'
        ? {
            kind: 'act',
            action: {
              type: 'investment',
              building: b.id,
              direction: 'withdraw',
              amount: Number(action.amount),
            },
          }
        : operation('buildingAdmin', {
            building: b.id,
            item: request.pricing!.item,
            side: request.pricing!.side,
            enabled: request.pricing!.enabled,
            ...(request.pricing!.enabled
              ? { price: internal(request.pricing!.priceDenarii!) }
              : {}),
          }),
    ]),
    reconsiderSeconds: 600,
  };
}
function matches(c: Commitment, a: Action) {
  const q = c.business?.pricing;
  if (!c.business || !('building' in a) || a.building !== c.business.building) return false;
  return (
    (a.type === 'investment' &&
      a.direction === 'withdraw' &&
      c.business.keepDenarii !== null &&
      !c.businessProgress?.withdrawalDone) ||
    (a.type === 'buildingAdmin' &&
      q &&
      !c.businessProgress?.pricingDone &&
      a.item === q.item &&
      a.side === q.side &&
      (a.enabled !== false) === q.enabled &&
      (!q.enabled || a.price === internal(q.priceDenarii!)))
  );
}
/** Revalidate protected money at execution, for agreed business changes. */
export function checkBusinessAction(w: World, p: Player, state: ResidentState, a: Action) {
  for (const c of state.commitments ?? []) {
    if (!unfinished(c, w.id) || !matches(c, a)) continue;
    const reason = businessRequestBlocker(w, p, c.business!, c.businessProgress?.pricingDone);
    if (reason) throw Error(reason);
    if (a.type === 'investment' && Number(a.amount) > drawAmount(w, p, c.business!))
      throw Error(
        'Till changed: this withdrawal would break the agreed reserve. Recalculate on arrival.',
      );
  }
}
/** Called only AFTER authoritative act succeeds; saved with the action checkpoint. */
export function recordBusinessAction(w: World, p: Player, state: ResidentState, a: Action) {
  const c = state.commitments?.find((c) => unfinished(c, w.id) && matches(c, a));
  if (!c) return false;
  c.businessProgress ??= {};
  if (a.type === 'investment') {
    c.businessProgress.withdrawn = (c.businessProgress.withdrawn ?? 0) + Number(a.amount);
    c.businessProgress.withdrawalDone = drawAmount(w, p, c.business!) === 0;
    c.outcome = `Actually transferred ${c.businessProgress.withdrawn / 100}d from the business till to my personal cash. This is not new profit.`;
  } else {
    c.businessProgress.pricingDone = true;
    const q = c.business!.pricing!;
    if (q.side === 'buy') {
      if (state.pausedInputBids?.world !== w.id || state.pausedInputBids.deaths !== p.deaths)
        state.pausedInputBids = { world: w.id, deaths: p.deaths, bids: {} };
      const holds = (state.pausedInputBids.manual ??= {});
      const key = `${c.business!.building}:${q.item}`;
      if (q.enabled) delete holds[key];
      else holds[key] = true;
    }
    c.outcome = q.enabled
      ? `Actually set ${q.side} ${q.item} to ${q.priceDenarii}d.`
      : `Actually paused ${q.side} ${q.item}.`;
  }
  complete(c);
  return true;
}

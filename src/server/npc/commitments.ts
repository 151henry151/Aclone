// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { canCarry, distance } from '../../shared/simulation.ts';
import { items } from '../../shared/catalog.ts';
import type { World, Player, Action } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';
import type { FarmerChoice } from './farmer.ts';
const id = z.string().min(1).max(80);
export const gameplayRequestSchema = z
  .object({
    summary: z.string().min(1).max(600),
    cancel: z.boolean(),
    delivery: z
      .object({
        item: id,
        quantity: z.number().int().min(1).max(10000),
        unitPrice: z.number().int().min(0).max(100000000),
        sourceBuilding: id.nullable(),
        destinationBuilding: id,
      })
      .strict()
      .nullable(),
  })
  .strict();
export type GameplayRequest = z.infer<typeof gameplayRequestSchema>;
export interface Commitment extends GameplayRequest {
  id: string;
  speakerId: string;
  world: string;
  status: 'pending' | 'blocked' | 'completed' | 'cancelled';
  delivered: number;
  outcome: string;
  /** Null is public; absent on legacy agreements, which default to private notices. */
  replyTo?: string | null;
  blockedNoticeSent?: boolean;
}
export function recordCommitment(
  state: ResidentState,
  request: GameplayRequest,
  id: string,
  speakerId: string,
  w: World,
  replyTo?: string | null,
) {
  request = gameplayRequestSchema.parse(request);
  const all = (state.commitments ??= []);
  if (all.some((c) => c.id === id)) return false;
  if (request.cancel) {
    const previous = all.findLast(
      (c) => c.speakerId === speakerId && ['pending', 'blocked'].includes(c.status),
    );
    if (!previous) return false;
    previous.status = 'cancelled';
    previous.outcome = 'Cancelled at the requesting player’s instruction.';
    return true;
  }
  if (
    all.some(
      (c) =>
        ['pending', 'blocked'].includes(c.status) &&
        c.speakerId === speakerId &&
        c.summary === request.summary &&
        JSON.stringify(c.delivery) === JSON.stringify(request.delivery),
    )
  )
    return false;
  if (all.filter((c) => ['pending', 'blocked'].includes(c.status)).length >= 4) return false;
  all.push({
    ...request,
    id,
    speakerId,
    world: w.id,
    replyTo,
    status: 'pending',
    delivered: 0,
    outcome: 'Requested in conversation; Jev must choose a feasible plan. No goods delivered yet.',
  });
  state.commitments = all.slice(-20);
  return true;
}
type Delivery = NonNullable<GameplayRequest['delivery']>;
function deliverySource(w: World, p: Player, d: Delivery) {
  return d.sourceBuilding
    ? w.buildings.find((b) => b.id === d.sourceBuilding && b.owner === p.id && !b.construction)
    : w.buildings.find((b) => b.owner === p.id && !b.construction && b.stock[d.item] > 0);
}
/** Same live facts for conversation admission and each subsequent delivery load. */
export function deliveryBlocker(
  w: World,
  p: Player,
  d: Delivery,
  remaining: number,
  wholeAgreement = false,
): string | undefined {
  if (!items[d.item]) return 'I cannot identify that item. Please clarify what you want delivered.';
  const buyer = w.buildings.find((b) => b.id === d.destinationBuilding && !b.construction);
  if (!buyer) return 'The destination building is unavailable. We need another buyer.';
  if (buyer.owner === p.id)
    return 'I own the destination, so I must deposit stock there rather than sell to myself.';
  if (!Number.isSafeInteger(buyer.buy[d.item]) || buyer.buy[d.item] < d.unitPrice)
    return `The destination does not offer the agreed minimum of ${d.unitPrice / 100}d per item. Its owner needs to set the posted buy price.`;
  const carried = p.inventory[d.item] ?? 0;
  const source = deliverySource(w, p, d);
  if ((wholeAgreement ? carried < remaining : carried === 0) && d.sourceBuilding && !source) {
    const building = w.buildings.find((b) => b.id === d.sourceBuilding);
    if (building && building.owner !== p.id)
      return `I do not own ${building.name}, so I cannot withdraw its stock${p.job === building.id ? ' even as an employee' : ''}. I would need to buy goods normally before offering them for delivery.`;
    return 'My source building is unavailable or still under construction. I need accessible stock first.';
  }
  const available =
    carried +
    (wholeAgreement && !d.sourceBuilding
      ? w.buildings
          .filter((b) => b.owner === p.id && !b.construction)
          .reduce((total, b) => total + (b.stock[d.item] ?? 0), 0)
      : (source?.stock[d.item] ?? 0));
  const needed = wholeAgreement ? remaining : 1;
  if (available < needed)
    return `I have access to only ${available} ${d.item}, but ${remaining} remain to deliver. We need to agree a smaller amount or wait until I obtain more.`;
  const space = buyer.capacity - (buyer.stock[d.item] ?? 0);
  if (space < needed)
    return `The buyer has storage space for only ${Math.max(0, space)} more ${d.item}. Its owner needs to clear stock or reduce the order.`;
  const cost = needed * buyer.buy[d.item];
  if (buyer.investment < cost)
    return `The buyer needs ${(cost - buyer.investment) / 100}d more investment to pay for ${needed} ${d.item}. Its owner needs to fund the building.`;
  if (!carried && !canCarry(p, d.item, 1))
    return 'My cargo is full. I need to make room before loading.';
  if (p.task) return 'I need to finish my current timed task before loading.';
}
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });
/** Fully accounted deliveries, possibly in several loads; ordinary action validation still applies. */
export function commitmentChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  const choices: FarmerChoice[] = [];
  for (const c of state.commitments ?? []) {
    if (c.world !== w.id || !c.delivery || !['pending', 'blocked'].includes(c.status)) continue;
    const d = c.delivery,
      buyer = w.buildings.find((b) => b.id === d.destinationBuilding && !b.construction);
    const block = (reason: string) => {
      c.status = 'blocked';
      c.outcome = reason;
    };
    const reason = deliveryBlocker(w, p, d, d.quantity - c.delivered);
    if (reason) {
      block(reason);
      continue;
    }
    if (!buyer) continue;
    const source = deliverySource(w, p, d);
    const carried = p.inventory[d.item] ?? 0;
    const remaining = d.quantity - c.delivered;
    let quantity = Math.min(
      remaining,
      carried + (source?.stock[d.item] ?? 0),
      buyer.capacity - (buyer.stock[d.item] ?? 0),
      buyer.buy[d.item] ? Math.floor(buyer.investment / buyer.buy[d.item]) : remaining,
    );
    while (quantity > carried && !canCarry(p, d.item, quantity - carried)) quantity--;
    if (quantity <= 0) {
      block('Waiting for my stock, cargo space, buyer storage or funded working capital.');
      continue;
    }
    const plan: Step[] = [
      ...(p.atHome ? [action({ type: 'outside' })] : []),
      ...(p.vehicle !== 5 && p.fuel <= 0
        ? [action({ type: 'vehicle', slot: 5 })]
        : p.vehicle !== 5 && !p.engine
          ? [action({ type: 'engine' })]
          : []),
    ];
    if (quantity > carried && source) {
      if (distance(p, source) >= 12) plan.push({ kind: 'travel', destination: source.id });
      plan.push(
        action({
          type: 'stock',
          building: source.id,
          direction: 'withdraw',
          item: d.item,
          quantity: quantity - carried,
        }),
      );
    }
    plan.push(
      { kind: 'travel', destination: buyer.id },
      action({ type: 'trade', building: buyer.id, direction: 'sell', item: d.item, quantity }),
    );
    c.status = 'pending';
    c.outcome = `Ready for a load of ${quantity}; ${c.delivered}/${d.quantity} delivered. Price ${buyer.buy[d.item]} per item before tax.`;
    choices.push({
      id: `commitment_${c.id}`,
      description: `Fulfil my conversation agreement: ${c.summary} Deliver ${quantity} ${d.item} to ${buyer.name} now; ${remaining} remaining. Respect the quoted minimum ${d.unitPrice} per item (hundredths of a denarius), buyer funding and tax.`,
      plan,
      reconsiderSeconds: 600,
    });
  }
  return choices;
}
export function checkCommitmentPrice(w: World, state: ResidentState, a: Action) {
  if (a.type !== 'trade' || a.direction !== 'sell') return;
  const price = w.buildings.find((b) => b.id === a.building)?.buy[String(a.item)] ?? -1;
  if (
    state.commitments?.some(
      (c) =>
        c.world === w.id &&
        ['pending', 'blocked'].includes(c.status) &&
        c.delivery !== null &&
        c.delivery.destinationBuilding === a.building &&
        c.delivery.item === a.item &&
        price < c.delivery.unitPrice,
    )
  )
    throw Error('Agreed delivery paused: buyer price fell below the agreed minimum');
}
export function recordDelivery(state: ResidentState, world: string, a: Action) {
  if (a.type !== 'trade' || a.direction !== 'sell') return false;
  let changed = false;
  let remaining = Number(a.quantity);
  for (const c of state.commitments ?? []) {
    if (
      remaining <= 0 ||
      c.world !== world ||
      !['pending', 'blocked'].includes(c.status) ||
      !c.delivery ||
      c.delivery.destinationBuilding !== a.building ||
      c.delivery.item !== a.item
    )
      continue;
    const n = Math.min(remaining, c.delivery.quantity - c.delivered);
    changed = true;
    c.delivered += n;
    remaining -= n;
    c.status = c.delivered === c.delivery.quantity ? 'completed' : 'pending';
    c.outcome = `${c.delivered}/${c.delivery.quantity} ${c.delivery.item} actually sold to ${c.delivery.destinationBuilding}. ${c.status === 'completed' ? 'Agreement fulfilled.' : 'More loads remain.'}`;
  }
  return changed;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { canCarry, distance } from '../../shared/simulation.ts';
import { items, recipes, skills } from '../../shared/catalog.ts';
import { operation } from './player-operations.ts';
import { travelPrep } from './travel.ts';
import { careNeeded } from './strategy.ts';
import { blockedStep } from './recovery.ts';
import type { World, Player, Action, Building } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';
import type { FarmerChoice } from './farmer.ts';
const id = z.string().min(1).max(80);
export const employmentRequestSchema = z
  .object({
    building: id.describe(
      'Exact observed employer building ID; the required skill comes from its current recipe.',
    ),
    train: z
      .boolean()
      .describe(
        'Permission to learn the required skill if missing. Set true when agreeing to a request to train/study/learn and work, even if already qualified; the engine skips unnecessary training. False means accept employment WITHOUT permission to train.',
      ),
  })
  .strict();
export const gameplayRequestSchema = z
  .object({
    summary: z.string().min(1).max(600),
    cancel: z.boolean(),
    employment: employmentRequestSchema.nullable().optional(),
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
  if ((!request.delivery && !request.employment) || (request.delivery && request.employment))
    return false;
  if (
    all.some(
      (c) =>
        ['pending', 'blocked'].includes(c.status) &&
        c.speakerId === speakerId &&
        c.world === w.id &&
        c.replyTo === replyTo &&
        c.summary === request.summary &&
        JSON.stringify(c.delivery) === JSON.stringify(request.delivery) &&
        JSON.stringify(c.employment) === JSON.stringify(request.employment),
    )
  )
    return false;
  // A clarification replaces this speaker's existing request for the same job,
  // rather than filling the queue with contradictory copies of the agreement.
  const replaced = request.employment
    ? all.filter(
        (c) =>
          c.world === w.id &&
          c.speakerId === speakerId &&
          c.replyTo === replyTo &&
          ['pending', 'blocked'].includes(c.status) &&
          c.employment?.building === request.employment!.building,
      )
    : [];
  if (
    all.filter(
      (c) =>
        !replaced.includes(c) &&
        (c.delivery || c.employment) &&
        ['pending', 'blocked'].includes(c.status),
    ).length >= 4
  )
    return false;
  for (const c of replaced) {
    c.status = 'cancelled';
    c.outcome = 'Replaced by the newer employment agreement with this player.';
  }
  all.push({
    ...request,
    id,
    speakerId,
    world: w.id,
    replyTo,
    status: 'pending',
    delivered: 0,
    outcome: request.employment
      ? 'Employment requested; training and the job have not started.'
      : 'Delivery agreed; the trip still needs to be arranged. No goods delivered yet.',
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
  allowUninspectedBuyer = false,
): string | undefined {
  if (!items[d.item]) return 'I cannot identify that item. Please clarify what you want delivered.';
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
  const buyer = w.buildings.find((b) => b.id === d.destinationBuilding && !b.construction);
  if (!buyer && allowUninspectedBuyer) return;
  if (!buyer) return 'The destination building is unavailable. We need another buyer.';
  if (buyer.owner === p.id)
    return 'I own the destination, so I must deposit stock there rather than sell to myself.';
  if (!Number.isSafeInteger(buyer.buy[d.item]) || buyer.buy[d.item] < d.unitPrice)
    return `The destination does not offer the agreed minimum of ${d.unitPrice / 100}d per item. Its owner needs to set the posted buy price.`;
  const space = buyer.capacity - (buyer.stock[d.item] ?? 0);
  if (space < needed)
    return `The buyer has storage space for only ${Math.max(0, space)} more ${d.item}. Its owner needs to clear stock or reduce the order.`;
  const cost = needed * buyer.buy[d.item];
  if (buyer.investment < cost)
    return `The buyer needs ${(cost - buyer.investment) / 100}d more investment to pay for ${needed} ${d.item}. Its owner needs to fund the building.`;
  if (!carried && !canCarry(p, d.item, 1, w))
    return 'My cargo is full. I need to make room before loading.';
  if (p.task) return 'I need to finish my current timed task before loading.';
}
type Employment = z.infer<typeof employmentRequestSchema>;
export function employmentBlocker(w: World, p: Player, request: Employment): string | undefined {
  const b = w.buildings.find((b) => b.id === request.building && !b.construction);
  const recipe = b && (b.production ?? recipes[b.recipe ?? '']);
  if (!b || !recipe)
    return 'That building does not currently offer a finished, qualified workplace.';
  if (b.owner === p.id) return 'I own that building and cannot employ myself.';
  if (!b.employees.includes(p.id) && b.employees.length >= 16)
    return 'All staff positions at that building are filled.';
  if (!p.skills.includes(recipe.skill)) {
    if (!request.train)
      return `I need the ${recipe.skill} qualification; training was not included in this request.`;
    if (!skills.includes(recipe.skill))
      return 'The required qualification is not available at school.';
    if (p.learning && p.learning.skill !== recipe.skill)
      return `I am already studying ${p.learning.skill}; that course must finish first.`;
    if (!p.learning) {
      if (p.skills.length >= w.settings.maxSkills)
        return `I have reached the ${w.settings.maxSkills}-skill limit and cannot learn ${recipe.skill}.`;
      if (p.cash < (p.skills.length ? 16000 : 8000))
        return 'I do not have enough cash for tuition yet.';
      if (!w.buildings.some((b) => b.kind === 'school' && !b.construction))
        return 'There is no finished school available.';
    }
  }
  return undefined;
}
function prep(p: Player): Step[] {
  return travelPrep(p);
}
function employmentChoice(w: World, p: Player, c: Commitment): FarmerChoice | undefined {
  const request = c.employment!;
  const reason = employmentBlocker(w, p, request);
  if (reason) {
    c.status = 'blocked';
    c.outcome = reason;
    return;
  }
  const b = w.buildings.find((b) => b.id === request.building)!;
  const recipe = b.production ?? recipes[b.recipe!];
  const plan = prep(p);
  let description: string;
  if (!p.skills.includes(recipe.skill)) {
    if (p.learning) {
      const seconds = Math.max(1, Math.min(300, Math.ceil(p.learning.end - w.time)));
      description = `Continue the agreed ${recipe.skill} course, then take the job at ${b.name}. ${Math.max(0, Math.ceil(p.learning.end - w.time))} seconds of training remain.`;
      plan.length = 0;
      plan.push({ kind: 'wait', seconds });
    } else {
      const school = w.buildings
        .filter((b) => b.kind === 'school' && !b.construction)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      description = `Study ${recipe.skill} at ${school.name} for the agreed job at ${b.name}. Tuition ${p.skills.length ? 160 : 80}d; course ${p.skills.length ? 40 : 1} minutes. Qualification and employment are not complete yet.`;
      plan.push(
        { kind: 'travel', destination: school.id },
        action({ type: 'learn', building: school.id, skill: recipe.skill }),
      );
    }
  } else if (
    p.job === b.id &&
    b.employees.includes(p.id) &&
    (!w.settings.activeWork || p.activeUntil > w.time)
  ) {
    c.status = 'completed';
    c.outcome = `Qualified as ${recipe.skill} and actually employed with an active shift at ${b.name}. This confirms the job, not finished production.`;
    return;
  } else {
    description = `Take the agreed ${recipe.skill} job at ${b.name}, wage ${b.wage / 100}d per cycle. Already qualified; renew here or leave the previous job only after reaching the new employer.`;
    plan.push({ kind: 'travel', destination: b.id });
    if (p.job && p.job !== b.id) plan.push(action({ type: 'quit' }));
    plan.push(action({ type: p.job === b.id ? 'work' : 'job', building: b.id }));
  }
  c.status = 'pending';
  c.outcome = description;
  return {
    id: `commitment_${c.id}`,
    description: `Agreed employment: ${description}`,
    plan,
    reconsiderSeconds: 600,
  };
}
/** Accepted work is an executable queue, not a suggestion to compete with repainting or rest.
 * Jev still selects a plan; survival and blocked-route recovery retain the full action menu. */
export function focusCommitments(
  w: World,
  p: Player,
  state: ResidentState,
  choices: FarmerChoice[],
) {
  const available = choices.filter(
    (c) => !c.plan.some((s) => blockedStep(state.recovery, s, w.time)),
  );
  const agreed = available.filter((c) => c.id.startsWith('commitment_'));
  return !p.task && !careNeeded(w, p) && agreed.length ? agreed : available;
}
export function refreshEmployment(w: World, p: Player, state: ResidentState) {
  for (const c of state.commitments ?? [])
    if (
      c.world === w.id &&
      c.employment &&
      w.buildings.some((b) => b.id === c.employment!.building) &&
      ['pending', 'blocked'].includes(c.status)
    )
      employmentChoice(w, p, c);
}
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });
/** Fully accounted deliveries, possibly in several loads; ordinary action validation still applies. */
export function commitmentChoices(
  w: World,
  p: Player,
  state: ResidentState,
  directory: Building[] = w.buildings,
): FarmerChoice[] {
  const choices: FarmerChoice[] = [];
  for (const c of state.commitments ?? []) {
    if (c.world !== w.id || !['pending', 'blocked'].includes(c.status)) continue;
    // Map locations are public, but unknown/stale stock is not a missing shop.
    // Visit before diagnosing an agreed workplace or delivery destination.
    const target = c.employment?.building ?? c.delivery?.destinationBuilding;
    const needs = [target];
    if (
      c.employment?.train &&
      !p.learning &&
      w.buildings.some(
        (b) =>
          b.id === target &&
          !p.skills.includes((b.production ?? recipes[b.recipe ?? ''])?.skill ?? ''),
      ) &&
      !w.buildings.some((b) => b.kind === 'school')
    )
      needs.push(directory.find((b) => b.kind === 'school')?.id);
    const unseen = needs
      .map((id) => directory.find((b) => b.id === id && !w.buildings.some((k) => k.id === id)))
      .find(Boolean);
    if (unseen) {
      // Loss of our own property is known without inspecting the buyer again.
      const source = c.delivery?.sourceBuilding;
      if (
        source &&
        !w.buildings.some((b) => b.id === source && b.owner === p.id) &&
        !(p.inventory[c.delivery!.item] > 0)
      ) {
        c.status = 'blocked';
        c.outcome = 'I do not own the source stockroom any more and cannot withdraw its goods.';
        continue;
      }
      c.status = 'pending';
      c.outcome = `I need to inspect ${unseen.name} before checking current terms.`;
      const plan: Step[] = [
        ...prep(p),
        { kind: 'travel', destination: unseen.id },
        { kind: 'wait', seconds: 1 },
      ];
      if (!plan.some((step) => blockedStep(state.recovery, step, w.time)))
        choices.push({
          id: `commitment_${c.id}`,
          description: c.outcome,
          plan,
          reconsiderSeconds: 600,
        });
      continue;
    }
    if (c.employment) {
      const choice = employmentChoice(w, p, c);
      if (choice) choices.push(choice);
      continue;
    }
    if (!c.delivery) {
      c.status = 'blocked';
      c.outcome =
        'We discussed this earlier, but I did not agree to a specific errand. Please remind me of the delivery or workplace and any training you want me to take.';
      continue;
    }
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
    while (quantity > carried && !canCarry(p, d.item, quantity - carried, w)) quantity--;
    if (quantity <= 0) {
      block('Waiting for my stock, cargo space, buyer storage or funded working capital.');
      continue;
    }
    const plan: Step[] = [...travelPrep(p)];
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
  return choices.filter((choice) => {
    const failure = choice.plan
      .map((step) => blockedStep(state.recovery, step, w.time))
      .find(Boolean);
    if (!failure) return true;
    const c = state.commitments!.find((c) => `commitment_${c.id}` === choice.id)!;
    c.status = 'blocked';
    c.outcome = `The planned step failed: ${failure.message}. I will reconsider after the retry cooldown.`;
    return false;
  });
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

// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { items, skills, vehicles } from './catalog.ts';
import type { World, Player, Action } from './types.ts';
const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .refine((s) => !['__proto__', 'constructor', 'prototype'].includes(s));
export const objectives = ['buy', 'sell', 'job', 'study', 'build', 'gather', 'interact'] as const;
export type Objective = (typeof objectives)[number];
export const questSchema = z.object({
  id,
  title: z.string().trim().min(1).max(64),
  description: z.string().max(2000).default(''),
  resetOnDeath: z.boolean().default(true),
  steps: z
    .array(
      z.object({
        event: z.enum(objectives),
        target: z.string().max(64).default(''),
        item: z
          .string()
          .default('')
          .refine((s) => !s || Object.hasOwn(items, s)),
        quantity: z.number().int().min(1).max(10000).default(1),
      }),
    )
    .min(1)
    .max(8),
  rewards: z
    .record(
      z.string().refine((s) => Object.hasOwn(items, s)),
      z.number().int().min(1).max(100),
    )
    .refine((v) => Object.keys(v).length <= 8)
    .default({}),
  kudos: z.number().int().min(0).max(20).default(0),
});
export const guardSchema = z.object({
  id,
  action: z.enum(['trade', 'job', 'learn', 'build', 'interactObject']),
  target: z.string().max(64).default(''),
  skill: z
    .string()
    .default('')
    .refine((s) => !s || skills.includes(s)),
  item: z
    .string()
    .default('')
    .refine((s) => !s || Object.hasOwn(items, s)),
  quantity: z.number().int().min(1).max(1000).default(1),
  variable: z.string().max(40).default(''),
  minimum: z.number().finite().min(-1e12).max(1e12).default(1),
  message: z.string().min(1).max(200),
});
export type Quest = z.infer<typeof questSchema>;
export interface QuestProgress {
  definition: string;
  step: number;
  count: number;
  claimed: boolean;
}
export function questKey(q: Quest) {
  return JSON.stringify(q);
}
export function currentProgress(p: Player, q: Quest) {
  const state = p.quests?.[q.id];
  return state?.definition === questKey(q) ? state : undefined;
}
/** Guards are pure, synchronous predicates: cancellation happens before any economic mutation. */
export function checkActionGuards(w: World, p: Player, a: Action) {
  for (const g of w.creator?.guards ?? []) {
    if (g.action !== a.type || (g.target && ![a.building, a.object, a.kind].includes(g.target)))
      continue;
    if (
      (g.skill && !p.skills.includes(g.skill)) ||
      (g.item && (p.inventory[g.item] ?? 0) < g.quantity) ||
      (g.variable && (p.scriptState?.[g.variable] ?? 0) < g.minimum)
    )
      throw Error(g.message);
  }
}
export function questEvent(
  w: World,
  p: Player,
  event: Objective,
  target = '',
  item = '',
  quantity = 1,
) {
  for (const q of w.creator?.quests ?? []) {
    const state = currentProgress(p, q);
    if (!state || state.claimed || state.step >= q.steps.length) continue;
    const step = q.steps[state.step];
    if (
      step.event !== event ||
      (step.target && step.target !== target) ||
      (step.item && step.item !== item)
    )
      continue;
    state.count += Math.max(0, quantity);
    if (state.count >= step.quantity) {
      state.step++;
      state.count = 0;
    }
  }
}
export function questAction(w: World, p: Player, a: Action) {
  const q = w.creator?.quests?.find((q) => q.id === a.quest);
  if (!q) throw Error('Quest is no longer available');
  const state = currentProgress(p, q);
  if (a.operation === 'accept') {
    if (state) throw Error('Quest already accepted');
    // Drop removed/revised definitions instead of accumulating unlimited abandoned records.
    p.quests = Object.fromEntries(
      (w.creator?.quests ?? []).flatMap((q) => {
        const state = currentProgress(p, q);
        return state ? [[q.id, state]] : [];
      }),
    );
    p.quests[q.id] = { definition: questKey(q), step: 0, count: 0, claimed: false };
    return 'Quest accepted.';
  }
  if (a.operation !== 'claim' || !state || state.claimed || state.step < q.steps.length)
    throw Error('Complete the quest before claiming its reward');
  const weight = Object.entries(p.inventory).reduce(
    (n, [id, q]) => n + (items[id]?.weight ?? 0) * q,
    0,
  );
  const extra = Object.entries(q.rewards).reduce((n, [id, q]) => n + items[id].weight * q, 0);
  if (weight + extra > vehicles[p.vehicle].capacity)
    throw Error('Make room for the whole reward first');
  for (const [id, n] of Object.entries(q.rewards)) p.inventory[id] = (p.inventory[id] ?? 0) + n;
  p.kudos += q.kudos;
  state.claimed = true;
  return 'Quest reward collected.';
}
export function resetQuests(w: World, p: Player) {
  for (const q of w.creator?.quests ?? []) if (q.resetOnDeath && p.quests) delete p.quests[q.id];
}

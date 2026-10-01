// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { budgetSchema } from './budget.ts';
export const npcConfigSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .default('mabel'),
  name: z
    .string()
    .regex(/^[\p{L}\p{N} _-]{2,24}$/u)
    .default('Mabel Reed'),
  world: z.string().min(1).max(80).default('puddlewick'),
  personality: z
    .string()
    .min(10)
    .max(3000)
    .default(
      'You are Mabel Reed, a warm, dry-witted former tractor mechanic. You are thrifty, curious about neighbours, proud of honest work and cautious about debt. You enjoy repairing things and dream of owning a well-run business. Speak naturally and briefly, without repeating catchphrases. Form your own plans and relationships from experience. You enjoy showing neighbours how things work, explaining the reason as well as the next step. Remember their projects without manufacturing shared history. You are candid about mistakes and unknowns, resourceful when a plan fails, and never confuse confidence with proof. Your wit is gentle; avoid stock catchphrases, constant announcements or promises before a job is done.',
    ),
  model: z.string().min(1).max(100).default('gpt-4.1-mini'),
  intervalMs: z.number().int().min(5000).max(300000).default(15000),
  activeAlone: z.boolean().default(false),
});
export type NpcConfig = z.infer<typeof npcConfigSchema>;
export function npcEnvironment(env: NodeJS.ProcessEnv = process.env) {
  if (env.NPC_ENABLED !== 'true') return undefined;
  const apiKey = env.OPENAI_API_KEY || env.OPENAI_KEY;
  if (!apiKey) throw Error('NPC_ENABLED requires a server-side OPENAI_API_KEY');
  const number = (value: string | undefined) =>
    value === undefined || value === '' ? undefined : Number(value);
  if (
    env.NPC_MODEL &&
    env.NPC_MODEL !== 'gpt-4.1-mini' &&
    (!env.NPC_INPUT_USD_PER_MILLION || !env.NPC_OUTPUT_USD_PER_MILLION)
  )
    throw Error(
      'Custom NPC_MODEL requires its input/output USD per million token rates for budget accounting',
    );
  return {
    apiKey,
    budget: budgetSchema.parse({
      monthlyUsd: number(env.NPC_MONTHLY_USD),
      dailyUsd: number(env.NPC_DAILY_USD),
      callsPerHour: number(env.NPC_CALLS_PER_HOUR),
      inputUsdPerMillion: number(env.NPC_INPUT_USD_PER_MILLION),
      outputUsdPerMillion: number(env.NPC_OUTPUT_USD_PER_MILLION),
    }),
    config: npcConfigSchema.parse({
      id: env.NPC_ID,
      name: env.NPC_NAME,
      world: env.NPC_WORLD,
      personality: env.NPC_PERSONALITY,
      model: env.NPC_MODEL,
      intervalMs: number(env.NPC_INTERVAL_MS),
      activeAlone: env.NPC_ACTIVE_ALONE === 'true',
    }),
  };
}

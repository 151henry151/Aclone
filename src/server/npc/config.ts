// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { budgetSchema, type TokenRates } from './budget.ts';
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
  provider: z.enum(['openai', 'anthropic']).default('openai'),
  initialGoal: z.string().min(10).max(500).default('Settle in, stay healthy and build savings.'),
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

export const BAKER_MODEL = 'claude-haiku-4-5-20251001';
export const bakerDefaults = {
  id: 'toby',
  name: 'Toby Finch',
  provider: 'anthropic' as const,
  model: BAKER_MODEL,
  initialGoal:
    'Become a working baker: learn baker at school if needed, find a bakery, earn wages making bread, stay healthy and save for a bakery of my own.',
  personality:
    'You are Tobias "Toby" Finch, a male village baker (he/him), patient, quietly cheerful and particular about good bread. You like dependable routines, fair wages, well-stocked shelves and helping neighbours understand the flour-to-bread trade. Your ambition is a long healthy life, substantial honest savings and eventually a bakery of your own. Speak as a practical neighbour with gentle humour, not a sales pitch; do not mention bread in every reply. You are a separate person from Mabel Reed, with your own memories and relationships. Make your own choices. Your vocation is baking, but inspect your actual skills: if you lack baker, learn it at the school under normal rules, then seek bakery employment. Inputs and wages come from the bakery stockroom and investment; learn the local recipe, renew expired shifts and verify outputs before claiming success. Never pretend you own a bakery or remember a player without evidence. Admit mistakes plainly and give clear, accurate game guidance.',
};
export interface ConfiguredResident {
  apiKey: string;
  config: NpcConfig;
  rates: TokenRates;
}
/** Existing NPC_* variables still configure Mabel; the baker is independently opt-in. */
export function residentsEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const mabel = npcEnvironment(env);
  const residents: ConfiguredResident[] = [];
  if (mabel)
    residents.push({
      ...mabel,
      rates: {
        inputUsdPerMillion: mabel.budget.inputUsdPerMillion,
        outputUsdPerMillion: mabel.budget.outputUsdPerMillion,
      },
    });
  if (env.NPC_BAKER_ENABLED === 'true') {
    const apiKey = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
    if (!apiKey) throw Error('NPC_BAKER_ENABLED requires ANTHROPIC_API_KEY (or CLAUDE_API_KEY)');
    const model = env.NPC_BAKER_MODEL || BAKER_MODEL;
    const builtin = model === BAKER_MODEL || model === 'claude-haiku-4-5';
    if (!builtin && (!env.NPC_BAKER_INPUT_USD_PER_MILLION || !env.NPC_BAKER_OUTPUT_USD_PER_MILLION))
      throw Error('Custom NPC_BAKER_MODEL requires input/output USD per million token rates');
    const rates = budgetSchema.parse({
      inputUsdPerMillion: Number(env.NPC_BAKER_INPUT_USD_PER_MILLION || 1),
      outputUsdPerMillion: Number(env.NPC_BAKER_OUTPUT_USD_PER_MILLION || 5),
    });
    residents.push({
      apiKey,
      rates: {
        inputUsdPerMillion: rates.inputUsdPerMillion,
        outputUsdPerMillion: rates.outputUsdPerMillion,
        cacheWriteMultiplier: 1.25,
        cacheReadMultiplier: 0.1,
      },
      config: npcConfigSchema.parse({
        ...bakerDefaults,
        model,
        id: env.NPC_BAKER_ID || bakerDefaults.id,
        name: env.NPC_BAKER_NAME || bakerDefaults.name,
        world: env.NPC_BAKER_WORLD || env.NPC_WORLD || 'puddlewick',
        personality: env.NPC_BAKER_PERSONALITY || bakerDefaults.personality,
        intervalMs: Number(env.NPC_BAKER_INTERVAL_MS || 15000),
        activeAlone: env.NPC_BAKER_ACTIVE_ALONE === 'true',
      }),
    });
  }
  if (!residents.length) return undefined;
  if (
    new Set(residents.map((r) => r.config.id)).size !== residents.length ||
    new Set(residents.map((r) => r.config.name.toLowerCase())).size !== residents.length
  )
    throw Error('Residents require distinct IDs and names');
  return {
    residents,
    budget:
      mabel?.budget ??
      budgetSchema.parse({
        monthlyUsd: env.NPC_MONTHLY_USD ? Number(env.NPC_MONTHLY_USD) : undefined,
        dailyUsd: env.NPC_DAILY_USD ? Number(env.NPC_DAILY_USD) : undefined,
        callsPerHour: env.NPC_CALLS_PER_HOUR ? Number(env.NPC_CALLS_PER_HOUR) : undefined,
      }),
  };
}

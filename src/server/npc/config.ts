// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { habitSchema, timeZoneSchema } from './habits.ts';
import { population, veteranHabits, preferenceSchemaValues } from './population.ts';
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
  vocation: z.enum(['general', 'baker', 'farmer', 'independent']).default('general'),
  provider: z.enum(['openai', 'anthropic', 'jev']).default('openai'),
  initialGoal: z.string().min(10).max(500).default('Settle in, stay healthy and build savings.'),
  model: z.string().min(1).max(100).default('gpt-4.1-mini'),
  intervalMs: z.number().int().min(5000).max(300000).default(15000),
  activeAlone: z.boolean().default(false),
  presence: z.enum(['on-demand', 'always', 'scheduled']).default('on-demand'),
  timeZone: timeZoneSchema,
  habit: habitSchema.default(() => habitSchema.parse({})),
  preference: z.enum(preferenceSchemaValues).default('balanced'),
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
  vocation: 'baker' as const,
  id: 'toby',
  name: 'Toby Finch',
  provider: 'anthropic' as const,
  model: BAKER_MODEL,
  initialGoal:
    'Become a working baker: learn baker at school if needed, find a bakery, earn wages making bread, stay healthy and save for a bakery of my own.',
  personality:
    'You are Tobias "Toby" Finch, a male village baker (he/him), patient, quietly cheerful and particular about good bread. You like dependable routines, fair wages, well-stocked shelves and helping neighbours understand the flour-to-bread trade. Your ambition is a long healthy life, substantial honest savings and eventually a bakery of your own. Speak as a practical neighbour with gentle humour, not a sales pitch; do not mention bread in every reply. You are a separate person from Mabel Reed, with your own memories and relationships. Make your own choices. Baking is an interest, not a career restriction. Reconsider any career, enterprise or pastime as conditions change. Inspect your actual skills: if you lack baker, learn it at the school under normal rules, then seek bakery employment. Inputs and wages come from the bakery stockroom and investment; learn the local recipe, renew expired shifts and verify outputs before claiming success. Never pretend you own a bakery or remember a player without evidence. Admit mistakes plainly and give clear, accurate game guidance.',
};
export const JEV_MODEL = 'jev-1.13.0';
export const FARMER_MODEL = JEV_MODEL;
export const farmerDefaults = {
  vocation: 'farmer' as const,
  id: 'rowan',
  name: 'Rowan Field',
  provider: 'jev' as const,
  model: FARMER_MODEL,
  initialGoal:
    'Learn farmer at school, tend seasonal crops, earn harvest wages and save toward a farm of my own while staying healthy.',
  personality:
    'You are Rowan Field, a male village farmer (he/him), observant, patient and quietly humorous. You like crop rotation, watching weather and fair deals with millers and bakers. Your ambition is a long healthy life, substantial savings and eventually a productive farm of your own. You are a separate person from Mabel and Toby, with your own experiences and relationships. Farming is an interest, not a career restriction. Compare all jobs and businesses and change course when justified. Learn farmer at school under normal rules when choosing farm work. Farm seeds and fertilizer can cost farm investment; harvest puts crops in the farm stockroom and pays employees only after completion. Explain practical details clearly, distinguish plans from actual results, acknowledge mistakes and never invent shared memories. Do not repeat announcements or talk about farming in every sentence.',
};
export const independentDefaults = {
  id: 'elias',
  name: 'Elias Vale',
  vocation: 'independent' as const,
  provider: 'jev' as const,
  model: JEV_MODEL,
  initialGoal:
    'Survey opportunities, preserve a long healthy life and grow legitimate net wealth. Experiment, learn from outcomes and change careers when evidence makes it worthwhile.',
  personality:
    'You are Elias Vale, a male independent village resident (he/him), inquisitive, sociable, practical and quietly adventurous. You have no fixed trade: compare funded jobs, training, trading, gathering, farming and owning businesses. You value a long healthy life and substantial honest wealth, but allow occasional affordable leisure, exploration and personal taste, including fishing or a fresh tractor colour. Judge actual earnings against travel, inputs, tools, tuition and living costs. Stay with a productive plan long enough to learn; change when demand, shortages, competition or your experience justify it. Save toward a comfortable cottage or rent a room and stock it with food. Your own history is evidence, not a reason to repeat failed plans. Be candid, concise and friendly in conversation; never claim results before they happen or manufacture memories.',
};
export interface ConfiguredResident {
  apiKey: string;
  config: NpcConfig;
  rates: TokenRates;
  dialogue?: { provider: 'openai' | 'anthropic'; apiKey: string; model: string; rates: TokenRates };
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
  if (env.NPC_FARMER_ENABLED === 'true') {
    const apiKey = env.TYPESAFE_API_KEY || env.JEV_API_KEY;
    const dialogueKey = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
    if (!apiKey) throw Error('NPC_FARMER_ENABLED requires TYPESAFE_API_KEY (or JEV_API_KEY)');
    if (!dialogueKey)
      throw Error('NPC_FARMER_ENABLED conversation requires ANTHROPIC_API_KEY (or CLAUDE_API_KEY)');
    const model = env.NPC_FARMER_MODEL || env.NPC_JEV_MODEL || JEV_MODEL;
    const dialogueModel = env.NPC_FARMER_CHAT_MODEL || BAKER_MODEL;
    if (
      model !== FARMER_MODEL &&
      (!(env.NPC_FARMER_INPUT_USD_PER_MILLION || env.NPC_JEV_INPUT_USD_PER_MILLION) ||
        !(env.NPC_FARMER_OUTPUT_USD_PER_MILLION || env.NPC_JEV_OUTPUT_USD_PER_MILLION))
    )
      throw Error('Custom NPC_FARMER_MODEL requires input/output USD per million token rates');
    if (
      dialogueModel !== BAKER_MODEL &&
      (!env.NPC_FARMER_CHAT_INPUT_USD_PER_MILLION || !env.NPC_FARMER_CHAT_OUTPUT_USD_PER_MILLION)
    )
      throw Error('Custom NPC_FARMER_CHAT_MODEL requires input/output USD per million token rates');
    const rates = budgetSchema.parse({
      inputUsdPerMillion: Number(
        env.NPC_FARMER_INPUT_USD_PER_MILLION || env.NPC_JEV_INPUT_USD_PER_MILLION || 0.042,
      ),
      outputUsdPerMillion: Number(
        env.NPC_FARMER_OUTPUT_USD_PER_MILLION || env.NPC_JEV_OUTPUT_USD_PER_MILLION || 0,
      ),
    });
    const chatRates = budgetSchema.parse({
      inputUsdPerMillion: Number(env.NPC_FARMER_CHAT_INPUT_USD_PER_MILLION || 1),
      outputUsdPerMillion: Number(env.NPC_FARMER_CHAT_OUTPUT_USD_PER_MILLION || 5),
    });
    residents.push({
      apiKey,
      config: npcConfigSchema.parse({
        ...farmerDefaults,
        model,
        id: env.NPC_FARMER_ID || farmerDefaults.id,
        name: env.NPC_FARMER_NAME || farmerDefaults.name,
        personality: env.NPC_FARMER_PERSONALITY || farmerDefaults.personality,
        world: env.NPC_FARMER_WORLD || env.NPC_WORLD || 'puddlewick',
        intervalMs: Number(env.NPC_FARMER_INTERVAL_MS || 15000),
        activeAlone: env.NPC_FARMER_ACTIVE_ALONE === 'true',
      }),
      rates: {
        inputUsdPerMillion: rates.inputUsdPerMillion,
        outputUsdPerMillion: rates.outputUsdPerMillion,
      },
      dialogue: {
        provider: 'anthropic',
        apiKey: dialogueKey,
        model: dialogueModel,
        rates: {
          inputUsdPerMillion: chatRates.inputUsdPerMillion,
          outputUsdPerMillion: chatRates.outputUsdPerMillion,
          cacheWriteMultiplier: 1.25,
          cacheReadMultiplier: 0.1,
        },
      },
    });
  }
  if (env.NPC_INDEPENDENT_ENABLED === 'true') {
    const apiKey = env.TYPESAFE_API_KEY || env.JEV_API_KEY;
    const chatKey = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
    if (!apiKey || !chatKey)
      throw Error(
        'NPC_INDEPENDENT_ENABLED requires JEV_API_KEY (or TYPESAFE_API_KEY) and CLAUDE_API_KEY (or ANTHROPIC_API_KEY)',
      );
    const model = env.NPC_INDEPENDENT_CHAT_MODEL || BAKER_MODEL;
    if (
      model !== BAKER_MODEL &&
      (!env.NPC_INDEPENDENT_CHAT_INPUT_USD_PER_MILLION ||
        !env.NPC_INDEPENDENT_CHAT_OUTPUT_USD_PER_MILLION)
    )
      throw Error(
        'Custom NPC_INDEPENDENT_CHAT_MODEL requires input/output USD per million token rates',
      );
    const rates = budgetSchema.parse({
      inputUsdPerMillion: Number(env.NPC_INDEPENDENT_CHAT_INPUT_USD_PER_MILLION || 1),
      outputUsdPerMillion: Number(env.NPC_INDEPENDENT_CHAT_OUTPUT_USD_PER_MILLION || 5),
    });
    // The common conversion below supplies the Jev model/key/rates while preserving this voice.
    residents.push({
      apiKey: chatKey,
      config: npcConfigSchema.parse({
        ...independentDefaults,
        provider: 'anthropic',
        model,
        id: env.NPC_INDEPENDENT_ID || independentDefaults.id,
        name: env.NPC_INDEPENDENT_NAME || independentDefaults.name,
        world: env.NPC_INDEPENDENT_WORLD || env.NPC_WORLD || 'puddlewick',
        personality: env.NPC_INDEPENDENT_PERSONALITY || independentDefaults.personality,
        intervalMs: Number(env.NPC_INDEPENDENT_INTERVAL_MS || 15000),
        activeAlone: env.NPC_INDEPENDENT_ACTIVE_ALONE === 'true',
      }),
      rates: {
        inputUsdPerMillion: rates.inputUsdPerMillion,
        outputUsdPerMillion: rates.outputUsdPerMillion,
        cacheWriteMultiplier: 1.25,
        cacheReadMultiplier: 0.1,
      },
    });
  }
  if (env.NPC_POPULATION_ENABLED === 'true') {
    const apiKey = env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY;
    if (!apiKey)
      throw Error('NPC_POPULATION_ENABLED requires CLAUDE_API_KEY (or ANTHROPIC_API_KEY)');
    for (const person of population)
      residents.push({
        apiKey,
        config: npcConfigSchema.parse({
          ...person,
          provider: 'anthropic',
          model: BAKER_MODEL,
          world: env.NPC_WORLD || 'puddlewick',
          presence: 'scheduled',
          timeZone: env.NPC_TIME_ZONE,
        }),
        rates: {
          inputUsdPerMillion: 1,
          outputUsdPerMillion: 5,
          cacheWriteMultiplier: 1.25,
          cacheReadMultiplier: 0.1,
        },
      });
  }
  if (!residents.length) return undefined;
  for (const r of residents) {
    r.config.timeZone = timeZoneSchema.parse(env.NPC_TIME_ZONE);
    if (r.config.id === mabel?.config.id) r.config.presence = 'always';
    else if (!population.some((p) => p.id === r.config.id)) {
      const role = r.config.vocation;
      r.config.presence = 'scheduled';
      r.config.habit =
        role === 'baker'
          ? veteranHabits.toby
          : role === 'farmer'
            ? veteranHabits.rowan
            : veteranHabits.elias;
      r.config.preference =
        role === 'baker' ? 'employee' : role === 'farmer' ? 'farmer' : 'balanced';
    }
  }
  // Preserve all existing chat model/rate variables. Gameplay now shares Jev.
  const jevKey = env.TYPESAFE_API_KEY || env.JEV_API_KEY;
  if (!jevKey)
    throw Error('Enabled AI residents require TYPESAFE_API_KEY (or JEV_API_KEY) for gameplay');
  const jevModel = env.NPC_JEV_MODEL || JEV_MODEL;
  if (
    jevModel !== JEV_MODEL &&
    (!env.NPC_JEV_INPUT_USD_PER_MILLION || !env.NPC_JEV_OUTPUT_USD_PER_MILLION)
  )
    throw Error('Custom NPC_JEV_MODEL requires input/output USD per million token rates');
  const jevRates = budgetSchema.parse({
    inputUsdPerMillion: Number(env.NPC_JEV_INPUT_USD_PER_MILLION || 0.042),
    outputUsdPerMillion: Number(env.NPC_JEV_OUTPUT_USD_PER_MILLION || 0),
  });
  for (const resident of residents) {
    if (resident.config.provider === 'jev') continue;
    resident.dialogue = {
      provider: resident.config.provider,
      apiKey: resident.apiKey,
      model: resident.config.model,
      rates: resident.rates,
    };
    resident.apiKey = jevKey;
    resident.config = { ...resident.config, provider: 'jev', model: jevModel };
    resident.rates = {
      inputUsdPerMillion: jevRates.inputUsdPerMillion,
      outputUsdPerMillion: jevRates.outputUsdPerMillion,
    };
  }
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

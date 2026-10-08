// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { MAX_CHAT_LENGTH } from '../../shared/messages.ts';
import type { GameplayRequest } from './commitments.ts';
const id = z.string().min(1).max(80),
  quantity = z.number().int().min(1).max(10000);
const building = {
  building: id.describe(
    'Exact building id from directory/nearbyBuildings, such as b6. Never its display name.',
  ),
};
const transfer = { ...building, direction: z.enum(['deposit', 'withdraw']) };
const action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('use'), item: id }).strict(),
  z
    .object({
      type: z.literal('trade'),
      ...building,
      item: id,
      quantity,
      direction: z.enum(['buy', 'sell']),
    })
    .strict(),
  z
    .object({
      type: z.literal('task'),
      ...building,
      task: z
        .enum(['labour', 'craft'])
        .describe(
          'labour: 15-second public workhouse shift. craft: forge-only personal steel/wood toolmaking. Never use task for milling or other automatic factory production.',
        ),
    })
    .strict(),
  z.object({ type: z.literal('learn'), ...building, skill: id }).strict(),
  z
    .object({
      type: z
        .enum(['job', 'work', 'buyBuilding', 'home'])
        .describe(
          'job is the WORKER accepting qualified employment (no owner hire action); work renews two production cycles at your EXISTING job, including an expired shift. A held job is not necessarily active; waiting cannot renew it. Production then consumes BUILDING inputs, creates BUILDING outputs and pays wages from BUILDING investment. home needs ownership; buyBuilding spends its quoted purchase price.',
        ),
      ...building,
    })
    .strict(),
  z.object({ type: z.enum(['quit', 'outside', 'engine', 'lights', 'horn']) }).strict(),
  z.object({ type: z.literal('gather'), node: id }).strict(),
  z.object({ type: z.literal('vehicle'), slot: z.union([z.literal(0), z.literal(5)]) }).strict(),
  z.object({ type: z.literal('stock'), ...transfer, item: id, quantity }).strict(),
  z.object({ type: z.enum(['investment', 'bank']), ...transfer, amount: quantity }).strict(),
  z
    .object({
      type: z.literal('farm'),
      ...building,
      operation: z.enum(['plant', 'water', 'fertilize', 'harvest', 'drain', 'improve']),
      plot: z.number().int().min(0).max(3),
      crop: z.string().max(30).nullable(),
    })
    .strict(),
  z.object({ type: z.literal('paint'), ...building, color: id }).strict(),
]);
/** Ordinary player operations only. Editor, moderation, account and arbitrary commands are excluded. */
export const playerOperations = [
  'livestock',
  'listProperty',
  'fulfilOrder',
  'loan',
  'buildingAdmin',
  'lodging',
  'construct',
  'supply',
  'repair',
  'demolish',
  'vehicle',
  'crow',
  'joinGame',
  'leaveGame',
  'reel',
  'kricket',
  'joinCombat',
  'chargeWeapon',
  'fire',
  'refit',
  'town',
  'group',
  'hitch',
  'detach',
  'give',
  'giveMoney',
  'refuelPlayer',
  'repairVehicle',
  'family',
  'acceptTrade',
  'cancelTrade',
  'offerTrade',
  'serviceVehicle',
  'buyMap',
  'respawn',
  'exchange',
  'takeoff',
  'land',
  'jump',
  'ship',
  'spaceTrade',
  'upgrade',
  'courier',
  'survey',
  'rescue',
] as const;
const operationParameter = z
  .object({
    name: z.enum([
      'x',
      'z',
      'building',
      'order',
      'offer',
      'family',
      'price',
      'name',
      'wage',
      'item',
      'side',
      'operation',
      'rate',
      'open',
      'hours',
      'quantity',
      'direction',
      'kind',
      'style',
      'slot',
      'game',
      'mode',
      'weapon',
      'tax',
      'player',
      'amount',
      'world',
      'system',
      'ship',
      'buy',
      'rule',
      'value',
      'candidate',
      'bid',
      'proposal',
      'support',
      'loan',
      'months',
      'apr',
      'payment',
      'accepted',
      'autoPay',
      'collateral',
      'enabled',
    ]),
    value: z.union([z.string().max(80), z.number().finite(), z.boolean()]),
  })
  .strict();
export const stepSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('operation'),
      operation: z.enum(playerOperations),
      parameters: z.array(operationParameter).max(12),
    })
    .strict(),
  z.object({ kind: z.literal('fish'), catches: z.number().int().min(1).max(5) }).strict(),
  z
    .object({
      kind: z.literal('wait'),
      seconds: z
        .number()
        .int()
        .min(1)
        .max(600)
        .describe(
          'Seconds from 1 to 600 inclusive. Split longer waits into separate steps; never use 1200 in a single wait.',
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('travel'),
      destination: id.describe(
        'Use travel for ALL building/resource visits: supply the exact observed id (for example b6), NEVER its name (for example Hank’s Flour mill). It finds a safe stopping place in service range. Do not use move to aim at a building centre.',
      ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('move'),
      x: z
        .number()
        .min(-10000)
        .max(10000)
        .describe(
          'Open-ground waypoint only. To visit a building or resource use travel with its ID instead.',
        ),
      z: z.number().min(-10000).max(10000),
    })
    .strict(),
  z.object({ kind: z.literal('act'), action }).strict(),
  z
    .object({
      kind: z.literal('guide'),
      query: z
        .string()
        .min(1)
        .max(200)
        .describe(
          'Search bundled player help or an exact topic/catalog ID. Use this before answering when current guide excerpts are insufficient; it requests another decision with the results, without moving or spending game money.',
        ),
    })
    .strict(),
  z
    .object({
      kind: z.literal('recall'),
      query: z.string().min(1).max(200),
      before: z.number().int().min(0).nullable(),
    })
    .strict(),
]);
export type Step = z.infer<typeof stepSchema>;
export const decisionSchema = z
  .object({
    intent: z
      .string()
      .min(1)
      .max(300)
      .describe('Short practical next goal, not private reasoning.'),
    notebook: z
      .string()
      .max(3000)
      .describe(
        'Replace your working notebook with concise continuing goals, relationships and lessons. The full event journal remains searchable; do not invent memories.',
      ),
    speech: z
      .object({
        text: z.string().min(1).max(MAX_CHAT_LENGTH),
        to: id
          .nullable()
          .describe(
            'Player ID for a private reply, or null for parish chat. Match private messages privately.',
          ),
      })
      .strict()
      .nullable(),
    plan: z
      .array(stepSchema)
      .min(1)
      .max(12)
      .describe(
        'A practical multi-step plan. It executes locally without extra model calls; failed steps stop the plan.',
      ),
    repeat: z
      .number()
      .int()
      .min(1)
      .max(30)
      .describe(
        'Repeat the entire plan this many times, stopping on failure or changed needs. No teleporting or automatic purchases.',
      ),
    reconsiderSeconds: z
      .number()
      .int()
      .min(10)
      .max(1800)
      .describe(
        'Maximum time before a fresh decision. Prefer long useful plans to conserve tokens.',
      ),
  })
  .strict();
export type Decision = z.infer<typeof decisionSchema>;
export interface BrainRequest {
  instructions: string;
  observation: unknown;
  /** Provider-preflighted exact wire body; never persisted in resident memory. */
  preparedBody?: string;
}
export interface BrainResult {
  supplyGoal?: import('./survival.ts').SupplyGoal;
  preferences?: import('./agenda.ts').LearnedPreference[] | null;
  gameplayRequest?: GameplayRequest | null;
  decision: Decision;
  inputTokens: number;
  outputTokens: number;
  /** Claude cache token counts are separate from uncached input tokens. */
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
}
export interface Brain {
  prepare?(request: BrainRequest): BrainRequest;
  decide(request: BrainRequest, signal: AbortSignal): Promise<BrainResult>;
}

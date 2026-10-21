// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { shortlist, candidateFacts, focusedInstructions, decisionFocus } from './planning.ts';
import type { FarmerChoice } from './farmer.ts';
import {
  decisionSchema,
  stepSchema,
  type Brain,
  type BrainRequest,
  type BrainResult,
} from './decision.ts';
export const jevInstructions = focusedInstructions;
const choicesSchema = z
  .array(
    z.object({
      id: z.string(),
      description: z.string(),
      plan: z.array(stepSchema).min(1).max(12),
      reconsiderSeconds: z.number().int().min(10).max(1800).optional(),
    }),
  )
  .min(1)
  .max(240);
const answerSchema = z.object({
  answers: z.object({
    next_action: z.object({
      type: z.literal('choice'),
      choice: z.string(),
      confidence: z.number().min(0).max(1),
      probabilities: z.record(z.string(), z.number().min(0).max(1)),
    }),
  }),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    output_tokens: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  }),
});
/** A deterministic rejection before transport cannot incur provider charges. */
export class LocalRequestError extends Error {}
function boundedContext(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.slice(0, 240);
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 5) return '[details omitted]';
  if (Array.isArray(value)) return value.slice(0, 8).map((v) => boundedContext(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 28)
      .map(([k, v]) => [k, boundedContext(v, depth + 1)]),
  );
}
/** Keep the entire request below a conservative UTF-8 bound, not just the
 * unencoded observation. Jev only selects a plan; executable steps stay local. */
export function jevPayload(request: BrainRequest, model: string) {
  const observation = request.observation as Record<string, unknown>;
  const raw = (observation.choices ?? observation.farmerChoices) as FarmerChoice[];
  choicesSchema.parse(raw);
  const self = observation.self as Record<string, unknown> | undefined;
  const choices = shortlist(raw, String(self?.id ?? ''), Number(observation.time ?? 0));
  const state: Record<string, unknown> = {};
  for (const key of [
    'self',
    'finances',
    'worldRules',
    'calendar',
    'currentWork',
    'session',
    'careerPreference',
    'career',
    'ambition',
    'projectHistory',
    'household',
    'commitments',
    'lastOutcome',
    'enduringGoal',
  ]) {
    if (observation[key] !== undefined) state[key] = observation[key];
  }
  const life = observation.life as Record<string, unknown> | undefined;
  if (state.finances && typeof state.finances === 'object') {
    const finance = state.finances as ReturnType<typeof import('./finances.ts').financialBriefing>;
    const holdings = Array.isArray(finance.businesses) ? finance.businesses : [];
    state.finances = {
      currency: finance.currency,
      personal: finance.personal,
      omittedBusinesses: Math.max(0, holdings.length - 4),
      businesses: holdings.slice(0, 4).map((b) => ({
        building: b.building,
        name: b.name,
        tillCash: b.tillCash,
        operatingReserve: b.operatingReserve,
        investorClaims: b.investorClaims,
        safelyWithdrawable: b.safelyWithdrawable,
        lifetimeOperatingCashFlowDenarii: b.lifetimeOperatingCashFlowDenarii,
        recentOperatingCashFlow: b.recentOperatingCashFlow,
        estimatedBatch: b.estimatedBatch
          ? {
              ...b.estimatedBatch,
              basis: 'Conditional on selling output and replacing inputs; not recorded profit.',
            }
          : null,
        purchasing: b.purchasing.slice(0, 4).map((q) => ({
          ...q,
          observedSupplier: q.observedSupplier
            ? { ...q.observedSupplier, basis: 'Observed, recheck.' }
            : null,
        })),
      })),
    };
  }
  state.life = life ? { survival: life.survival } : undefined;
  // Keep the exact seasonal/work deadlines and current inventory, not a repeated catalogue.
  state.prosperity = observation.prosperity;
  state.lessons = observation.lessons;
  const agenda = observation.agenda as Record<string, unknown> | undefined;
  state.agenda = agenda
    ? { preferences: boundedContext(agenda.preferences), currentGoal: agenda.currentGoal }
    : undefined;
  if (Array.isArray(state.commitments))
    state.commitments = state.commitments.filter(
      (c: any) => c.status === 'pending' || c.status === 'blocked',
    );
  if (choices.some((c) => c.plan.some((s) => s.kind === 'act' && s.action.type === 'farm')))
    state.farming = boundedContext(observation.farming);
  state.focus = decisionFocus(observation);
  state.units =
    'Money: hundredths of a denarius EXCEPT finances.denarii and fields ending Denarii, which are display denarii; time: game seconds. Quotes are observed, not guaranteed.';
  state.personality = request.instructions.split('Your personality:')[1]?.trim();
  const payload = {
    model,
    state,
    questions: {
      next_action: {
        type: 'choice',
        instructions: focusedInstructions,
        criteria: Object.fromEntries(
          choices.map((c) => [
            c.id,
            candidateFacts(
              c,
              observation.projectHistory as import('./projects.ts').ProjectOutcome[] | undefined,
            ),
          ]),
        ),
      },
    },
  };
  const bytes = () => Buffer.byteLength(JSON.stringify(payload));
  for (const key of ['agenda', 'lessons', 'projectHistory', 'lastOutcome', 'prosperity']) {
    if (bytes() <= 24000) break;
    state[key] = boundedContext(state[key]);
  }
  const finance = state.finances as
    { businesses?: unknown[]; omittedBusinesses: number } | undefined;
  while (bytes() > 24000 && finance?.businesses && finance.businesses.length > 1) {
    finance.businesses.pop();
    finance.omittedBusinesses++;
  }
  // Reduce whole alternatives only, never their economics or executable stages.
  // Urgent agreements/survival remain; a pathological essential fact fails locally.
  for (const c of [...choices].reverse()) {
    if (bytes() <= 24000) break;
    if (
      /^(survival_|commitment_)/.test(c.id) ||
      Object.keys(payload.questions.next_action.criteria).length <= 1
    )
      continue;
    delete payload.questions.next_action.criteria[c.id];
  }
  for (const key of ['agenda', 'lessons', 'lastOutcome', 'prosperity']) {
    if (bytes() <= 24000) break;
    delete state[key];
  }
  if (bytes() > 24000) throw new LocalRequestError('AI gameplay context exceeds local size limit');
  return payload;
}
/** Jev selects supplied plans. It cannot generate chat or invent executable actions. */
export class JevBrain implements Brain {
  constructor(
    private apiKey: string,
    private model: string,
    private transport: typeof fetch = fetch,
  ) {}
  prepare(request: BrainRequest): BrainRequest {
    try {
      const observation = request.observation as Record<string, unknown>;
      const raw = observation.choices ?? observation.farmerChoices;
      if (!Array.isArray(raw)) throw new LocalRequestError('Missing gameplay choices');
      const warnings: string[] = [];
      const valid = raw.slice(0, 240).filter((choice, index) => {
        const check = choicesSchema.element.safeParse(choice);
        if (check.success) return true;
        warnings.push(
          ...check.error.issues.slice(0, 2).map((i) => `${index}.${i.path.join('.')}:${i.code}`),
        );
        return false;
      });
      if (!valid.length)
        throw new LocalRequestError(
          'No valid gameplay choices: ' + warnings.slice(0, 6).join(', '),
        );
      const prepared = {
        ...request,
        observation: { ...observation, choices: valid, planningWarnings: warnings.slice(0, 6) },
      };
      const body = jevPayload(prepared, this.model);
      const ids = new Set(Object.keys(body.questions.next_action.criteria));
      return {
        ...prepared,
        observation: { ...prepared.observation, choices: valid.filter((c) => ids.has(c.id)) },
        preparedBody: JSON.stringify(body),
      };
    } catch (error) {
      throw new LocalRequestError(
        error instanceof z.ZodError
          ? 'Invalid gameplay choices: ' +
              error.issues
                .slice(0, 6)
                .map((i) => i.path.join('.') + ':' + i.code)
                .join(', ')
          : error instanceof LocalRequestError
            ? error.message
            : 'Invalid gameplay context',
      );
    }
  }
  async decide(request: BrainRequest, signal: AbortSignal): Promise<BrainResult> {
    if (!request.preparedBody) request = this.prepare(request);
    const {
      choices: gameplayChoices,
      farmerChoices,
      gameGuide: _guide,
      ...state
    } = request.observation as Record<string, unknown>;
    const choices = choicesSchema.parse(gameplayChoices ?? farmerChoices);
    const response = await this.transport('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      body: request.preparedBody ?? this.prepare(request).preparedBody,
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as any;
      if (error?.error?.error_type === 'max_tokens_exceeded')
        throw Error('AI gameplay context exceeds provider token limit');
      throw Error(`AI provider HTTP ${response.status}`);
    }
    const parsed = answerSchema.safeParse(await response.json());
    if (!parsed.success) throw Error('AI response did not contain one valid turn');
    const answer = parsed.data.answers.next_action;
    const selected = choices.find((c) => c.id === answer.choice);
    const keys = Object.keys(answer.probabilities);
    if (
      !selected ||
      keys.length !== choices.length ||
      !choices.every((c) => Object.hasOwn(answer.probabilities, c.id)) ||
      Math.abs(Object.values(answer.probabilities).reduce((sum, n) => sum + n, 0) - 1) >
        Math.max(
          0.01,
          Object.values(answer.probabilities).filter((n) => n > 0).length * 0.005 + 1e-8,
        )
    )
      throw Error('AI response did not contain one valid turn');
    return {
      selection: {
        id: selected.id,
        confidence: answer.confidence,
        probabilities: answer.probabilities,
        candidates: choices.length,
        inputBytes: Buffer.byteLength(request.preparedBody!),
      },
      tradeQuotes: (request.observation as { choices?: FarmerChoice[] }).choices?.find(
        (c) => c.id === selected.id,
      )?.tradeQuotes,
      ambition: (request.observation as { choices?: FarmerChoice[] }).choices?.find(
        (c) => c.id === selected.id,
      )?.ambition,
      careerGoal: (
        request.observation as { choices?: import('./farmer.ts').FarmerChoice[] }
      ).choices?.find((c) => c.id === selected.id)?.careerGoal,
      supplyGoal: (
        request.observation as { choices?: import('./farmer.ts').FarmerChoice[] }
      ).choices?.find((c) => c.id === selected.id)?.supplyGoal,
      decision: decisionSchema.parse({
        intent: selected.description.slice(0, 300),
        notebook: typeof state.notebook === 'string' ? state.notebook : '',
        speech: null,
        plan: selected.plan,
        repeat: 1,
        reconsiderSeconds:
          selected.reconsiderSeconds ?? (selected.plan.some((s) => s.kind === 'travel') ? 600 : 60),
      }),
      inputTokens: parsed.data.usage.input_tokens,
      outputTokens: parsed.data.usage.output_tokens,
    };
  }
}

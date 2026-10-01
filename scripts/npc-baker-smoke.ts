// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in paid check: synthetic in-memory world, at most three calls, $0.40 cap.
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { residentsEnvironment } from '../src/server/npc/config.ts';
import { AnthropicBrain } from '../src/server/npc/anthropic.ts';
import { observe, instructions } from '../src/server/npc/observation.ts';
import { decisionSchema } from '../src/server/npc/decision.ts';
import { outputLimit, turnTool } from '../src/server/npc/turn-tool.ts';
import { createWorld, act, advance, distance } from '../src/shared/simulation.ts';
if (!process.argv.includes('--live'))
  throw Error('Use --live to permit up to three paid Claude requests');
const configured = residentsEnvironment({
  ...process.env,
  NPC_ENABLED: 'false',
  NPC_BAKER_ENABLED: 'true',
})!;
const { config, apiKey, rates } = configured.residents[0];
const store = new Store(':memory:');
const w = createWorld(config.world, 'Baker smoke test', 'test-owner');
const worlds = new Map([[w.id, w]]);
const residents = new Residents(
  store,
  new Universe(store),
  worlds,
  [
    {
      config,
      rates,
      brain: {
        async decide() {
          throw Error('Manual bounded smoke only');
        },
      },
    },
  ],
  { dailyUsd: 0.4, monthlyUsd: 0.4 },
);
const provider = new AnthropicBrain(apiKey, config.model, async (url, options) => {
  const response = await fetch(url, options);
  if (response.ok) {
    const body = await response.clone().json();
    const call = body.content?.find((c: any) => c.type === 'tool_use');
    const parsed = decisionSchema.safeParse(call?.input);
    if (!parsed.success)
      console.error(
        JSON.stringify({
          validation: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })),
        }),
      );
  }
  return response;
});
try {
  const state = residents.memory.load(config.id)!;
  const p = w.players[state.playerId];
  p.online = true;
  const school = w.buildings.find((b) => b.kind === 'school')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  bakery.owner = 'test-owner';
  bakery.stock = { flour: 10, bread: 0 };
  bakery.investment = 30000;
  let calls = 0;
  const ask = async (question: string) => {
    assert.ok(++calls <= 3);
    state.helpQuestion = question;
    state.questionFrom = 'test-owner';
    state.replyTo = 'test-owner';
    residents.memory.append(config.id, w.time, 'chat', {
      name: 'Test owner',
      sender: 'test-owner',
      to: p.id,
      text: question,
    });
    const request = {
      instructions: instructions + '\nYour personality: ' + config.personality,
      observation: observe(w, p, state, residents.memory, config.id),
    };
    const bytes =
      Buffer.byteLength(JSON.stringify(request)) + Buffer.byteLength(JSON.stringify(turnTool));
    assert.ok(bytes <= 96000);
    const reservation = residents.budget.reserve(config.id, bytes, outputLimit, Date.now(), rates);
    assert.notEqual(reservation, undefined, 'Smoke budget exhausted');
    let result;
    try {
      result = await provider.decide(request, new AbortController().signal);
    } catch (error) {
      residents.budget.failed(reservation!);
      if (
        error instanceof Error &&
        /^AI (provider HTTP [0-9]+|response (incomplete|did not contain one valid turn|missing token accounting))$/.test(
          error.message,
        )
      )
        console.error(error.message);
      throw Error(
        'Claude smoke request failed; check provider account/model and configuration (credentials and response bodies withheld)',
      );
    }
    residents.budget.settle(
      reservation!,
      result.inputTokens,
      result.outputTokens,
      result.cacheWriteTokens,
      result.cacheReadTokens,
    );
    state.notebook = result.decision.notebook;
    console.log(
      JSON.stringify({
        call: calls,
        speech: result.decision.speech,
        plan: result.decision.plan,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheWriteTokens: result.cacheWriteTokens,
        cacheReadTokens: result.cacheReadTokens,
      }),
    );
    return result.decision;
  };
  // Place fixtures at service entrances; navigation is covered separately by controller tests.
  p.x = school.x;
  p.z = school.z + 12;
  const cash = p.cash;
  const learning = await ask(
    'I am the test bakery owner. Please train as a baker now at this school so you can work for me. My favourite loaf is sourdough; remember that.',
  );
  const learn = learning.plan.find((s) => s.kind === 'act' && s.action.type === 'learn');
  assert.ok(
    learn &&
      learn.kind === 'act' &&
      learn.action.type === 'learn' &&
      learn.action.skill === 'baker',
  );
  assert.equal(learn.action.building, school.id);
  act(w, p.id, learn.action);
  advance(w, 60);
  assert.ok(p.skills.includes('baker'));
  assert.equal(p.cash, cash - 8000);
  p.x = bakery.x;
  p.z = bakery.z + 12;
  const before = p.cash;
  const baking = await ask(
    'You have finished baker school and are beside my bakery. Please accept this bakery job and work now; flour and wage funding are supplied.',
  );
  for (const step of baking.plan) {
    if (step.kind === 'travel')
      assert.ok(
        distance(
          p,
          w.buildings.find((b) => b.id === step.destination)!,
        ) < 18,
        'Unexpected distant travel in fixture',
      );
    if (step.kind === 'act') {
      const before = { job: p.job, activeUntil: p.activeUntil };
      const result = act(w, p.id, step.action);
      residents.memory.append(config.id, w.time, 'action', {
        action: step.action,
        result,
        before,
        after: { job: p.job, activeUntil: p.activeUntil },
      });
    }
    if (p.job === bakery.id && p.activeUntil > w.time) break;
  }
  assert.equal(p.job, bakery.id);
  advance(w, 600 - (w.time % 600));
  assert.equal(bakery.stock.flour, 8);
  assert.equal(bakery.stock.bread, 3);
  assert.ok(p.cash > before);
  const followup = await ask(
    'Did your work actually produce bread? How much? And do you remember my favourite loaf? Reply privately; no new work needed.',
  );
  assert.equal(followup.speech?.to, 'test-owner');
  assert.match(followup.speech!.text, /sourdough/i);
  assert.match(followup.speech!.text, /3|three/i);
  console.log(
    JSON.stringify({
      ok: true,
      calls,
      skills: p.skills,
      flour: bakery.stock.flour,
      bread: bakery.stock.bread,
      netWages: p.cash - before,
      estimatedUsd: residents.budget.usage().dayUsd,
    }),
  );
} finally {
  residents.close();
  store.close();
}

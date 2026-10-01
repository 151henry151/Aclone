// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in model evaluation using synthetic mill states, never the live game save.
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { OpenAIBrain, outputLimit, turnTool } from '../src/server/npc/openai.ts';
import { observe, instructions } from '../src/server/npc/observation.ts';
import { createWorld, act, advance } from '../src/shared/simulation.ts';
if (!process.argv.includes('--live'))
  throw Error('Use --live for up to six paid synthetic requests, capped at $0.25.');
const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
if (!key) throw Error('Set OPENAI_API_KEY privately in the server environment');
const store = new Store(':memory:');
const w = createWorld('puddlewick', 'Test parish', 'owner');
w.script = '';
const config = npcConfigSchema.parse({ activeAlone: true });
const residents = new Residents(
  store,
  new Universe(store),
  new Map([[w.id, w]]),
  [
    {
      config,
      brain: {
        async decide() {
          throw Error('Only explicit test calls are allowed');
        },
      },
    },
  ],
  { dailyUsd: 0.25, monthlyUsd: 0.25 },
);
const provider = new OpenAIBrain(key, config.model);
let calls = 0;
try {
  const state = residents.memory.load('mabel')!;
  const p = w.players[state.playerId];
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.name = "Hank's Flour mill";
  b.owner = 'owner';
  p.x = b.x;
  p.z = b.z;
  p.skills = ['miller'];
  p.online = true;
  const ask = async (question: string) => {
    state.helpQuestion = question;
    state.replyTo = 'owner';
    state.questionFrom = 'owner';
    state.intent = 'Help Hank with the flour mill';
    residents.memory.append('mabel', w.time, 'chat', {
      name: 'Hank Test',
      sender: 'owner',
      text: question,
      to: p.id,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.ok(calls < 6, 'Six-call test ceiling');
      const request = {
        instructions: instructions + '\nYour personality: ' + config.personality,
        observation: observe(w, p, state, residents.memory, 'mabel'),
      };
      const bytes =
        Buffer.byteLength(JSON.stringify(request)) + Buffer.byteLength(JSON.stringify(turnTool));
      assert.ok(bytes <= 96000);
      const reservation = residents.budget.reserve('mabel', bytes, outputLimit);
      assert.notEqual(reservation, undefined, 'Test spending cap reached');
      calls++;
      let response;
      try {
        response = await provider.decide(request, new AbortController().signal);
      } catch (e) {
        residents.budget.failed(reservation!);
        throw e;
      }
      residents.budget.settle(reservation!, response.inputTokens, response.outputTokens);
      const d = response.decision;
      console.log(
        JSON.stringify({
          question,
          speech: d.speech,
          plan: d.plan,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        }),
      );
      const lookup = d.plan.find((s) => s.kind === 'guide');
      if (lookup && attempt === 0) {
        state.guideQuery = lookup.query;
        continue;
      }
      state.guideQuery = undefined;
      return d;
    }
    throw Error('No decision');
  };
  w.time = 590;
  b.stock = { wheat: 12, flour: 29 };
  b.investment = 1459;
  state.notebook = 'I thought I needed to buy wheat and craft flour myself; this is unverified.';
  const diagnosis = await ask(
    'Mabel, I put wheat in my mill. You learned miller and said you would work for me, but nothing is happening. What is wrong, and what do I need to do?',
  );
  assert.ok(diagnosis.speech);
  assert.match(diagnosis.speech.text, /invest|capital|wage|fund/i);
  assert.match(diagnosis.speech.text, /job|employ|hir/i);
  assert.match(diagnosis.speech.text, /7\.41/);
  assert.doesNotMatch(diagnosis.speech.text, /you (?:need to |must |should )?hire me/i);
  assert.ok(
    diagnosis.plan.every(
      (s) => s.kind !== 'act' || !['trade', 'task', 'gather'].includes(s.action.type),
    ),
    'Must not buy/gather wheat or craft flour',
  );
  b.investment = 11000;
  const hired = await ask(
    'Mabel, I have funded the mill now. Please take the job and work here. Wheat is already in its stockroom. Stay and wait for the first batch.',
  );
  const cash = p.cash;
  for (const step of hired.plan) {
    if (step.kind === 'act') {
      assert.ok(!['trade', 'task', 'gather', 'quit', 'buyBuilding'].includes(step.action.type));
      act(w, p.id, step.action);
    } else if (step.kind === 'wait') advance(w, Math.min(step.seconds, 600 - w.time));
    else if (step.kind === 'travel') assert.equal(step.destination, b.id);
    else assert.fail('Expected a direct mill employment plan');
  }
  assert.equal(p.job, b.id, 'Model must actually take the job');
  assert.ok(p.activeUntil >= 600);
  if (w.time < 600) advance(w, 600 - w.time);
  assert.equal(b.stock.flour, 32);
  assert.equal(b.stock.wheat, 7);
  assert.equal(p.cash, cash + 1980);
  // A different recipe and no capital: the answer must use current facts, not the prompt example.
  b.production = {
    inputs: { wheat: 9 },
    outputs: { flour: 5 },
    skill: 'miller',
    seconds: 30,
    tier: 0,
  };
  b.stock = { wheat: 8, flour: 498 };
  b.investment = 0;
  const blocked = await ask(
    'Mabel, my custom mill is stalled again. Check the actual recipe, stock and wage funding and tell me what needs fixing.',
  );
  assert.ok(blocked.speech);
  assert.match(blocked.speech.text, /wheat/i);
  assert.match(blocked.speech.text, /space|room|full|capacity/i);
  assert.match(blocked.speech.text, /invest|capital|wage|fund/i);
  console.log(
    JSON.stringify({
      calls,
      estimatedUsd: residents.budget.usage().dayUsd,
      result: 'Mill diagnosis, real paid production and custom-recipe blockers passed',
    }),
  );
} finally {
  residents.close();
  store.close();
}

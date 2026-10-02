// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, say } from '../src/shared/simulation.ts';
import { crops, cropStatus } from '../src/shared/farming.ts';
import { calendar, DAY_SECONDS } from '../src/shared/environment.ts';
import { farmerChoices } from '../src/server/npc/farmer.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import {
  npcConfigSchema,
  farmerDefaults,
  residentsEnvironment,
  FARMER_MODEL,
} from '../src/server/npc/config.ts';
import { configuredResidents } from '../src/server/npc/providers.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { observe } from '../src/server/npc/observation.ts';
import { failStep } from '../src/server/npc/recovery.ts';
import { stepSchema, type Brain, type Decision } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
const turn = (plan: Decision['plan'], speech: Decision['speech'] = null) => ({
  decision: {
    intent: 'Tend crops',
    notebook: 'Rowan remembers the farm',
    plan,
    speech,
    repeat: 1,
    reconsiderSeconds: 60,
  },
  inputTokens: 100,
  outputTokens: 40,
});
function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  const p = addPlayer(w, 'rowan', 'Rowan Field');
  const state: ResidentState = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: farmerDefaults.personality,
    notebook: '',
    intent: farmerDefaults.initialGoal,
    cursor: 0,
    nextAt: 0,
    plan: [],
    index: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: '',
    errors: 0,
  };
  const choices = () => farmerChoices(w, p, state);
  const run = (prefix: string) => {
    const choice = choices().find((c) => c.description.startsWith(prefix));
    assert.ok(choice, `Missing choice: ${prefix}`);
    for (const step of choice.plan) {
      stepSchema.parse(step);
      if (step.kind === 'act') act(w, p.id, step.action);
    }
  };
  return { w, p, state, choices, run };
}

test('farmer learns normally, tends a seasonal crop and earns verified harvest wages into farm stock', () => {
  const { w, p, state, choices, run } = fixture();
  const school = w.buildings.find((b) => b.kind === 'school')!;
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.owner = 'owner';
  farm.investment = 50000;
  farm.stock = {};
  assert.equal(
    choices().some((c) => c.description.startsWith('Plant')),
    false,
  );
  p.x = school.x;
  p.z = school.z;
  const startingCash = p.cash;
  run('Learn farmer');
  assert.equal(p.cash, startingCash - 8000);
  advance(w, 60);
  assert.ok(p.skills.includes('farmer'));
  p.x = farm.x;
  p.z = farm.z;
  run('Accept farm employment');
  assert.equal(p.job, farm.id);
  const seed = crops.wheat.seed;
  const investment = farm.investment;
  run('Plant wheat');
  assert.equal(farm.investment, investment - seed);
  p.inventory.water = 6;
  run('Water wheat');
  assert.equal(p.inventory.water, 3);
  assert.equal(farm.plots![0].water, 1);
  run('Fertilize wheat');
  assert.equal(farm.plots![0].fertilized, true);
  assert.equal(farm.investment, investment - seed - 1000);
  w.time = farm.plots![0].ready;
  const amount = cropStatus(w, farm, 0).yield;
  const cash = p.cash;
  run('Harvest wheat');
  assert.equal(farm.stock.wheat, undefined, 'Starting harvest is not proof of output');
  advance(w, 15);
  assert.equal(farm.stock.wheat, amount);
  assert.equal(p.cash, cash + farm.wage - Math.floor(farm.wage * w.settings.wageTax));
  assert.equal(p.inventory.wheat ?? 0, 0);
  assert.equal(farm.plots![0].previous, 'wheat');
  const store = new Store(':memory:');
  const residents = new Residents(store, new Universe(store), new Map([[w.id, w]]), []);
  try {
    assert.equal(
      observe(w, p, state, residents.memory, 'rowan').recentWages.at(-1)!.netPay,
      p.cash - cash,
    );
  } finally {
    residents.close();
    store.close();
  }
});

test('farmer choices respect season, permissions, seed costs, irrigation, storage, wages and failure backoff', () => {
  const { w, p, state, choices } = fixture();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  p.skills = ['farmer'];
  farm.owner = 'owner';
  farm.employees = [p.id];
  p.job = farm.id;
  p.x = farm.x;
  p.z = farm.z;
  farm.investment = 0;
  assert.ok(!choices().some((c) => c.description.startsWith('Plant')));
  farm.investment = 50000;
  while (calendar(w).season !== 'Winter') w.time += DAY_SECONDS;
  assert.ok(!choices().some((c) => c.description.startsWith('Plant')));
  while (calendar(w).season !== 'Spring') w.time += DAY_SECONDS;
  const plant = choices().find((c) => c.description.startsWith('Plant wheat'))!;
  assert.ok(plant);
  for (const step of plant.plan) if (step.kind === 'act') act(w, p.id, step.action);
  p.inventory.water = 2;
  assert.ok(!choices().some((c) => c.description.startsWith('Water wheat')));
  p.inventory.water = 4;
  farm.plots![0].water = 3;
  assert.ok(!choices().some((c) => c.description.startsWith('Water wheat')));
  w.time = farm.plots![0].ready;
  farm.stock.wheat = farm.capacity;
  assert.ok(!choices().some((c) => c.description.startsWith('Harvest wheat')));
  farm.stock.wheat = 0;
  farm.investment = 0;
  assert.ok(!choices().some((c) => c.description.startsWith('Harvest wheat')));
  farm.investment = 50000;
  const harvest = choices().find((c) => c.description.startsWith('Harvest wheat'))!;
  assert.ok(harvest);
  const step = harvest.plan[0];
  failStep((state.recovery ??= {}), w.time, step, 'Failed');
  failStep(state.recovery, w.time, step, 'Failed');
  assert.ok(!choices().some((c) => c.description.startsWith('Harvest wheat')));
  farm.employees = [];
  assert.ok(!choices().some((c) => /^(Plant|Water|Fertilize|Harvest)/.test(c.description)));
  for (const choice of choices()) choice.plan.forEach((s) => stepSchema.parse(s));
});

test('farm owner can fund, collect and sell crops without self-trading or paid self-employment', () => {
  const { w, p, choices, run } = fixture();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.owner = p.id;
  farm.investment = 0;
  farm.stock = { wheat: 25 };
  p.cash = 20000;
  p.x = farm.x;
  p.z = farm.z;
  run('Fund seeds');
  assert.equal(farm.investment, 5000);
  assert.equal(p.cash, 15000);
  run('Collect 25 wheat');
  assert.equal(p.inventory.wheat, 25);
  const shop = w.buildings.find((b) => b.owner !== p.id && b.buy.wheat > 0)!;
  shop.investment = 100000;
  shop.stock.wheat = 0;
  p.x = shop.x;
  p.z = shop.z;
  const sale = choices().find(
    (c) =>
      c.description.startsWith('Sell 25 carried wheat') &&
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.building === shop.id,
      ),
  )!;
  assert.ok(sale);
  for (const s of sale.plan) if (s.kind === 'act') act(w, p.id, s.action);
  assert.equal(p.cash, 15000 + 25 * shop.buy.wheat);
  assert.equal(p.inventory.wheat, 0);
});

function jevResponse(choices: { id: string }[], chosen = choices[0].id) {
  return {
    answers: {
      next_action: {
        type: 'choice',
        choice: chosen,
        confidence: 1,
        probabilities: Object.fromEntries(choices.map((c) => [c.id, c.id === chosen ? 1 : 0])),
      },
    },
    usage: { input_tokens: 250, output_tokens: 30 },
  };
}
test('Jev sends bounded choices to the official API and can execute only a supplied plan', async () => {
  const { choices } = fixture();
  const options = choices();
  const brain = new JevBrain('test-key', FARMER_MODEL, async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal((init?.headers as any).authorization, 'Bearer test-key');
    const b = JSON.parse(String(init?.body));
    assert.equal(b.model, FARMER_MODEL);
    assert.equal(b.questions.next_action.type, 'choice');
    assert.equal(b.state.gameGuide, undefined);
    assert.equal(b.state.farmerChoices, undefined);
    assert.equal(Object.keys(b.questions.next_action.criteria).length, options.length);
    assert.equal(b.state.notebook, 'My farm memory');
    return new Response(JSON.stringify(jevResponse(options)));
  });
  const result = await brain.decide(
    {
      instructions: 'Be Rowan',
      observation: {
        farmerChoices: options,
        notebook: 'My farm memory',
        gameGuide: 'Large handbook',
      },
    },
    new AbortController().signal,
  );
  assert.deepEqual(result.decision.plan, options[0].plan);
  assert.equal(result.decision.speech, null);
  assert.equal(result.decision.notebook, 'My farm memory');
  assert.equal(result.inputTokens, 250);
  for (const alter of [
    (b: any) => {
      b.answers.next_action.choice = 'invented';
    },
    (b: any) => {
      b.answers.next_action.probabilities = {};
    },
    (b: any) => {
      b.answers.next_action.confidence = 2;
    },
    (b: any) => {
      b.usage.input_tokens = -1;
    },
  ]) {
    const body = jevResponse(options);
    alter(body);
    await assert.rejects(
      new JevBrain('key', FARMER_MODEL, async () => new Response(JSON.stringify(body))).decide(
        { instructions: '', observation: { farmerChoices: options } },
        new AbortController().signal,
      ),
    );
  }
  await assert.rejects(
    new JevBrain('key', FARMER_MODEL, async () => new Response('SECRET', { status: 429 })).decide(
      { instructions: '', observation: { farmerChoices: options } },
      new AbortController().signal,
    ),
    /^Error: AI provider HTTP 429$/,
  );
});

test('third resident is independently opt-in, requires both keys and shares global caps with provider-specific rates', () => {
  assert.equal(residentsEnvironment({ TYPESAFE_API_KEY: 'test' }), undefined);
  assert.throws(() => residentsEnvironment({ NPC_FARMER_ENABLED: 'true' }), /TYPESAFE_API_KEY/);
  assert.throws(
    () => residentsEnvironment({ NPC_FARMER_ENABLED: 'true', TYPESAFE_API_KEY: 'test' }),
    /conversation requires/,
  );
  const env = {
    NPC_ENABLED: 'true',
    OPENAI_API_KEY: 'test',
    NPC_BAKER_ENABLED: 'true',
    CLAUDE_API_KEY: 'test',
    NPC_FARMER_ENABLED: 'true',
    TYPESAFE_API_KEY: 'test',
  };
  const config = residentsEnvironment(env)!;
  assert.deepEqual(
    config.residents.map((r) => r.config.id),
    ['mabel', 'toby', 'rowan'],
  );
  assert.equal(config.residents[2].rates.inputUsdPerMillion, 0.042);
  assert.equal(config.residents[2].rates.outputUsdPerMillion, 0);
  assert.equal(config.residents[2].dialogue!.rates.outputUsdPerMillion, 5);
  assert.equal(config.budget.dailyUsd, 0.6);
  assert.ok(configuredResidents(env)!.residents[2].brain instanceof JevBrain);
  assert.throws(() => residentsEnvironment({ ...env, NPC_FARMER_ID: 'toby' }), /distinct/);
  assert.throws(() => residentsEnvironment({ ...env, NPC_FARMER_MODEL: 'custom' }), /token rates/);
});

for (const mode of ['success', 'error', 'budget'] as const)
  test(`hybrid ${mode}: Jev controls actions, Claude only addressed conversation with separately billed calls`, async () => {
    const store = new Store(':memory:');
    const universe = new Universe(store);
    const w = createWorld('puddlewick', 'Puddlewick', 'owner');
    const worlds = new Map([[w.id, w]]);
    let gameCalls = 0,
      chatCalls = 0;
    const brain: Brain = {
      async decide(request) {
        gameCalls++;
        assert.ok((request.observation as any).choices.length);
        return turn([{ kind: 'wait', seconds: 60 }]);
      },
    };
    const dialogue: Brain = {
      async decide(request) {
        chatCalls++;
        assert.match(request.instructions, /CONVERSATION ONLY/);
        assert.equal(
          (request.observation as any).currentConversation.question,
          'Rowan, remember my orchard.',
        );
        assert.deepEqual((request.observation as any).chosenPlan, [{ kind: 'wait', seconds: 60 }]);
        if (mode === 'error') throw Error('SECRET');
        return {
          ...turn([{ kind: 'act', action: { type: 'quit' } }], {
            text: 'I remember your orchard.',
            to: null,
          }),
          inputTokens: 200,
          outputTokens: 20,
          cacheReadTokens: 1000,
        };
      },
    };
    const options = [
      {
        config: npcConfigSchema.parse({ ...farmerDefaults, activeAlone: true, intervalMs: 5000 }),
        brain,
        rates: { inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 },
        dialogue: {
          brain: dialogue,
          rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5, cacheReadMultiplier: 0.1 },
        },
      },
    ];
    let residents = new Residents(store, universe, worlds, options, {
      dailyUsd: 2,
      callsPerHour: mode === 'budget' ? 1 : 120,
    });
    try {
      const now = Date.now();
      const id = residents.status()[0].playerId;
      residents.tick(0.05, now);
      await residents.settled();
      assert.equal(gameCalls, 1);
      assert.equal(chatCalls, 0, 'No Claude calls during autonomous work');
      const human = addPlayer(w, 'human', 'Robin');
      say(w, human.name, 'Rowan, remember my orchard.', 'chat', id);
      residents.capture(w);
      residents.tick(0.05, now + 6000);
      await residents.settled();
      assert.equal(gameCalls, 1, 'Replying does not require another gameplay call');
      assert.equal(chatCalls, mode === 'budget' ? 0 : 1);
      const state = residents.memory.load('rowan')!;
      assert.deepEqual(
        state.plan,
        [{ kind: 'wait', seconds: 60 }],
        'Claude cannot quit the Jev-selected plan',
      );
      assert.equal(state.errors, 0, 'Dialogue failure does not disable gameplay');
      const rows = store.db.prepare('SELECT * FROM npc_calls ORDER BY id').all();
      assert.equal(rows.length, mode === 'budget' ? 1 : 2);
      assert.equal(rows[0].charged, (100 * 0.042) / 1e6);
      if (mode === 'success') {
        assert.ok(Math.abs(Number(rows[1].charged) - 0.0004) < 1e-9);
        const message = w.messages.find((m) => m.text === 'I remember your orchard.')!;
        assert.equal(message.to, human.id, 'Private route wins over model public-chat request');
        assert.equal(state.helpQuestion, undefined);
      } else assert.equal(state.helpQuestion, 'Rowan, remember my orchard.');
      assert.ok(!JSON.stringify(residents.memory.recent('rowan', 100)).includes('SECRET'));
      residents.close();
      const saved = new Map(store.loadWorlds().map((r) => [r.world.id, r.world]));
      residents = new Residents(store, universe, saved, options, { dailyUsd: 2 });
      assert.equal(residents.status()[0].playerId, id);
      assert.equal(residents.memory.load('rowan')!.notebook, 'Rowan remembers the farm');
    } finally {
      residents.close();
      store.close();
    }
  });

test('a delayed conversation uses the latest world and preserves a newer private question', async () => {
  const store = new Store(':memory:');
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  const worlds = new Map([[w.id, w]]);
  let complete!: (value: ReturnType<typeof turn>) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const residents = new Residents(
    store,
    new Universe(store),
    worlds,
    [
      {
        config: npcConfigSchema.parse({ ...farmerDefaults, activeAlone: true }),
        brain: {
          async decide() {
            return turn([{ kind: 'wait', seconds: 60 }]);
          },
        },
        dialogue: {
          rates: { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
          brain: {
            async decide() {
              started();
              return new Promise((resolve) => {
                complete = resolve;
              });
            },
          },
        },
      },
    ],
    { dailyUsd: 2 },
  );
  try {
    const id = residents.status()[0].playerId;
    const first = addPlayer(w, 'first', 'First neighbour');
    say(w, first.name, 'Rowan, hello from the first neighbour.', 'chat', id);
    residents.capture(w);
    residents.tick(0.05, Date.now());
    await ready;
    const latest = structuredClone(w);
    latest.players[id].cash += 1234;
    worlds.set(w.id, latest);
    const second = addPlayer(latest, 'second', 'Second neighbour');
    say(latest, second.name, 'Rowan, remember this newer question.', 'chat', id);
    residents.capture(latest);
    complete(
      turn([{ kind: 'wait', seconds: 60 }], { text: 'Reply for the first neighbour.', to: null }),
    );
    await residents.settled();
    assert.equal(latest.messages.at(-1)!.to, first.id);
    assert.equal(latest.messages.at(-1)!.text, 'Reply for the first neighbour.');
    assert.equal(
      w.messages.some((m) => m.text === 'Reply for the first neighbour.'),
      false,
    );
    assert.equal(store.loadWorlds()[0].world.players[id].cash, latest.players[id].cash);
    assert.equal(
      residents.memory.load('rowan')!.helpQuestion,
      'Rowan, remember this newer question.',
    );
    assert.equal(residents.memory.load('rowan')!.replyTo, second.id);
  } finally {
    residents.close();
    store.close();
  }
});

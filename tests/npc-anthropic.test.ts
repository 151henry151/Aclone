// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnthropicBrain } from '../src/server/npc/anthropic.ts';
import { residentsEnvironment, BAKER_MODEL } from '../src/server/npc/config.ts';
import { configuredResidents } from '../src/server/npc/providers.ts';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { NpcBudget, budgetSchema } from '../src/server/npc/budget.ts';
import { NpcMemory } from '../src/server/npc/memory.ts';
import { Store } from '../src/server/store.ts';
const decision = {
  intent: 'Become a baker',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait', seconds: 60 }],
  repeat: 1,
  reconsiderSeconds: 600,
};
const response = () => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', name: 'plan_turn', input: decision }],
  usage: {
    input_tokens: 400,
    output_tokens: 100,
    cache_creation_input_tokens: 5000,
    cache_read_input_tokens: 0,
  },
});

test('Claude requests a bounded plan, caches stable instructions and validates cache token usage', async () => {
  const fake: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal((init?.headers as any)['x-api-key'], 'test-key');
    assert.equal((init?.headers as any)['anthropic-version'], '2023-06-01');
    const b = JSON.parse(String(init?.body));
    assert.equal(b.model, BAKER_MODEL);
    assert.equal(b.max_tokens, 2200);
    assert.equal(b.system[0].cache_control.ttl, '5m');
    assert.equal(b.tools[0].name, 'plan_turn');
    assert.equal(b.tools[0].input_schema.properties.intent.maxLength, 300);
    assert.match(b.tools[0].input_schema.properties.intent.description, /maxLength: 300/);
    assert.ok(b.tools[0].input_schema.properties.plan);
    assert.equal(b.tool_choice.disable_parallel_tool_use, true);
    assert.equal(b.messages[0].content, '{"private":"only Toby"}');
    assert.ok(init?.signal);
    return new Response(JSON.stringify(response()));
  };
  const result = await new AnthropicBrain('test-key', BAKER_MODEL, fake).decide(
    { instructions: 'Baker', observation: { private: 'only Toby' } },
    new AbortController().signal,
  );
  assert.deepEqual(result.decision, decision);
  assert.equal(result.inputTokens, 400);
  assert.equal(result.cacheWriteTokens, 5000);
});

test('Claude rejects truncated, missing, multiple, unsafe and unaccounted responses without logging bodies', async () => {
  const examples: unknown[] = [
    { ...response(), stop_reason: 'max_tokens' },
    { ...response(), stop_reason: 'end_turn' },
    { ...response(), content: [] },
    { ...response(), content: [...response().content, ...response().content] },
    { ...response(), content: [{ type: 'tool_use', name: 'unknown', input: decision }] },
    {
      ...response(),
      content: [
        {
          type: 'tool_use',
          name: 'plan_turn',
          input: {
            ...decision,
            plan: [{ kind: 'act', action: { type: 'command', text: '*cash 1000' } }],
          },
        },
      ],
    },
    {
      ...response(),
      content: [
        {
          type: 'tool_use',
          name: 'plan_turn',
          input: {
            ...decision,
            plan: [{ kind: 'act', action: { type: 'task', building: 'bakery', task: 'job' } }],
          },
        },
      ],
    },
    {
      ...response(),
      content: [
        {
          type: 'tool_use',
          name: 'plan_turn',
          input: { ...decision, plan: [{ kind: 'wait', seconds: 1200 }] },
        },
      ],
    },
    { ...response(), usage: undefined },
    { ...response(), usage: { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: -1 } },
  ];
  for (const body of examples)
    await assert.rejects(
      () =>
        new AnthropicBrain(
          'test-key',
          BAKER_MODEL,
          async () => new Response(JSON.stringify(body)),
        ).decide({ instructions: 'Test', observation: {} }, new AbortController().signal),
      /^Error: AI response/,
    );
  await assert.rejects(
    () =>
      new AnthropicBrain(
        'test-key',
        BAKER_MODEL,
        async () => new Response('SECRET echo', { status: 429 }),
      ).decide({ instructions: 'Test', observation: {} }, new AbortController().signal),
    /^Error: AI provider HTTP 429$/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      new AnthropicBrain('test-key', BAKER_MODEL, async (_url, init) => {
        init!.signal!.throwIfAborted();
        throw Error('unexpected');
      }).decide({ instructions: 'Test', observation: {} }, controller.signal),
    { name: 'AbortError' },
  );
});

test('Mabel and Toby are independently enabled with separate credentials, defaults and shared limits', () => {
  assert.equal(residentsEnvironment({ CLAUDE_API_KEY: 'unused' }), undefined);
  const env = {
    NPC_ENABLED: 'true',
    OPENAI_API_KEY: 'openai-test',
    NPC_BAKER_ENABLED: 'true',
    CLAUDE_API_KEY: 'claude-test',
    NPC_DAILY_USD: '0.7',
  };
  const options = residentsEnvironment(env)!;
  assert.deepEqual(
    options.residents.map((r) => [r.config.id, r.config.provider, r.apiKey]),
    [
      ['mabel', 'openai', 'openai-test'],
      ['toby', 'anthropic', 'claude-test'],
    ],
  );
  assert.equal(options.budget.dailyUsd, 0.7);
  assert.match(options.residents[1].config.personality, /male village baker/);
  assert.match(options.residents[1].config.initialGoal, /learn baker/);
  assert.equal(options.residents[0].rates.inputUsdPerMillion, 0.4);
  assert.equal(options.residents[1].rates.inputUsdPerMillion, 1);
  assert.equal(
    residentsEnvironment({ NPC_BAKER_ENABLED: 'true', ANTHROPIC_API_KEY: 'key' })!.residents.length,
    1,
  );
  assert.throws(() => residentsEnvironment({ NPC_BAKER_ENABLED: 'true' }), /ANTHROPIC_API_KEY/);
  assert.throws(() => residentsEnvironment({ ...env, NPC_BAKER_MODEL: 'custom' }), /rates/);
  assert.throws(() => residentsEnvironment({ ...env, NPC_BAKER_ID: 'mabel' }), /distinct/);
  assert.throws(() => residentsEnvironment({ ...env, NPC_BAKER_INPUT_USD_PER_MILLION: '-1' }));
  const wired = configuredResidents(env)!;
  assert.ok(wired.residents[0].brain instanceof OpenAIBrain);
  assert.ok(wired.residents[1].brain instanceof AnthropicBrain);
});

test('mixed-provider reservations retain rates across restart, charge cache usage and share one cap', () => {
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store);
    const budget = new NpcBudget(memory, budgetSchema.parse({ dailyUsd: 1, monthlyUsd: 1 }));
    const rates = {
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 5,
      cacheWriteMultiplier: 1.25,
      cacheReadMultiplier: 0.1,
    };
    const mabel = budget.reserve('mabel', 10000, 2200)!;
    const toby = budget.reserve('toby', 10000, 2200, Date.now(), rates)!;
    const rows = store.db.prepare('SELECT resident,reserved FROM npc_calls ORDER BY id').all();
    assert.ok(Number(rows[1].reserved) > Number(rows[0].reserved));
    const restarted = new NpcBudget(
      new NpcMemory(store),
      budgetSchema.parse({
        dailyUsd: 1,
        monthlyUsd: 1,
        inputUsdPerMillion: 99,
        outputUsdPerMillion: 99,
      }),
    );
    restarted.settle(mabel, 1000, 100);
    restarted.settle(toby, 1000, 100, 4000, 2000);
    assert.ok(Math.abs(restarted.usage().dayUsd - (0.00056 + 0.0067)) < 1e-9);
    const capped = new NpcBudget(
      memory,
      budgetSchema.parse({ dailyUsd: 0.008, monthlyUsd: 0.008 }),
    );
    assert.equal(capped.reserve('toby', 1000, 2200, Date.now(), rates), undefined);
    assert.equal(capped.reserve('mabel', 1000, 2200), undefined);
    assert.throws(() => restarted.settle(toby, -1, 100), /accounting/);
  } finally {
    store.close();
  }
});

test('legacy NPC billing tables migrate without losing charges or journals', () => {
  const store = new Store(':memory:');
  try {
    store.db.exec(
      "CREATE TABLE npc_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, resident TEXT NOT NULL, at INTEGER NOT NULL, reserved REAL NOT NULL, charged REAL NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL); INSERT INTO npc_calls(resident,at,reserved,charged,status) VALUES ('mabel',0,0.1,0.1,'uncertain')",
    );
    new NpcMemory(store);
    new NpcMemory(store);
    const row = store.db.prepare('SELECT * FROM npc_calls').get()!;
    assert.equal(row.charged, 0.1);
    assert.equal(row.rates, null);
    assert.equal(row.cache_read_tokens, 0);
  } finally {
    store.close();
  }
});

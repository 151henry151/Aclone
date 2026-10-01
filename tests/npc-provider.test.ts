// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIBrain, turnTool } from '../src/server/npc/openai.ts';
const d = {
  intent: 'Rest',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait', seconds: 60 }],
  repeat: 1,
  reconsiderSeconds: 600,
};
test('Responses adapter uses one strict tool, no hosted storage and validated token accounting', async () => {
  const fake: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.store, false);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.tools[0].strict, true);
    assert.equal(body.tool_choice.name, 'plan_turn');
    assert.equal(body.model, 'gpt-4.1-mini');
    const walk = (s: any) => {
      assert.equal(s.oneOf, undefined, 'Responses strict tools require anyOf, not oneOf');
      if (s.type === 'object') {
        assert.equal(s.additionalProperties, false);
        assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      }
      for (const [k, v] of Object.entries(s))
        if (v && typeof v === 'object' && k !== 'const')
          Array.isArray(v) ? v.forEach((x) => x && typeof x === 'object' && walk(x)) : walk(v);
    };
    walk(turnTool.parameters);
    return new Response(
      JSON.stringify({
        status: 'completed',
        output: [{ type: 'function_call', name: 'plan_turn', arguments: JSON.stringify(d) }],
        usage: { input_tokens: 400, output_tokens: 80 },
      }),
      { status: 200 },
    );
  };
  const result = await new OpenAIBrain('test-key', 'gpt-4.1-mini', fake).decide(
    { instructions: 'Test', observation: {} },
    new AbortController().signal,
  );
  assert.deepEqual(result.decision, d);
  assert.equal(result.inputTokens, 400);
});
test('Responses adapter rejects refusal, malformed output and errors without exposing provider bodies', async () => {
  for (const body of [
    { status: 'incomplete' },
    { status: 'completed', output: [] },
    {
      status: 'completed',
      output: [{ type: 'function_call', name: 'plan_turn', arguments: '{}' }],
    },
  ]) {
    await assert.rejects(() =>
      new OpenAIBrain(
        'test-key',
        'gpt-4.1-mini',
        async () => new Response(JSON.stringify(body)),
      ).decide({ instructions: 'Test', observation: {} }, new AbortController().signal),
    );
  }
  await assert.rejects(
    () =>
      new OpenAIBrain(
        'test-key',
        'gpt-4.1-mini',
        async () => new Response('SECRET', { status: 429 }),
      ).decide({ instructions: 'Test', observation: {} }, new AbortController().signal),
    /^Error: AI provider HTTP 429$/,
  );
});

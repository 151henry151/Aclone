// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { AnthropicBrain } from '../src/server/npc/anthropic.ts';
for (const provider of ['openai', 'anthropic'] as const)
  test(`${provider} conversation uses a small speech/notebook tool and cannot supply gameplay`, async () => {
    const reply = {
      notebook: 'Robin owns a mill.',
      speech: { text: 'The mill uses its own wheat and investment to make flour.', to: 'robin' },
    };
    let body: any;
    const transport = (async (_url: any, options: any) => {
      body = JSON.parse(options.body);
      return Response.json(
        provider === 'openai'
          ? {
              status: 'completed',
              output: [
                { type: 'function_call', name: 'converse', arguments: JSON.stringify(reply) },
              ],
              usage: { input_tokens: 200, output_tokens: 60 },
            }
          : {
              stop_reason: 'tool_use',
              content: [{ type: 'tool_use', name: 'converse', input: reply }],
              usage: { input_tokens: 200, output_tokens: 60 },
            },
      );
    }) as typeof fetch;
    const brain =
      provider === 'openai'
        ? new OpenAIBrain('test', 'test', transport, 'conversation')
        : new AnthropicBrain('test', 'test', transport, 'conversation');
    const result = await brain.decide(
      {
        instructions: 'Answer from observations.',
        observation: { currentConversation: { question: 'How do mills work?' } },
      },
      new AbortController().signal,
    );
    assert.equal(body.tools[0].name, 'converse');
    const schema = body.tools[0].parameters ?? body.tools[0].input_schema;
    assert.deepEqual(Object.keys(schema.properties).sort(), ['notebook', 'speech']);
    assert.equal(schema.additionalProperties, false);
    assert.equal(result.decision.speech?.to, 'robin');
    assert.deepEqual(result.decision.plan, [{ kind: 'wait', seconds: 60 }]);
    assert.equal(result.inputTokens, 200);
  });

import { createWorld, addPlayer, say } from '../src/shared/simulation.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
for (const provider of ['openai', 'anthropic', 'jev'] as const)
  test(`${provider}: controller suppresses unsolicited narration, replies when addressed, then returns to silence`, async () => {
    const store = new Store(':memory:'),
      w = createWorld('puddlewick', 'Town', 'owner'),
      worlds = new Map([[w.id, w]]);
    const r = new Residents(store, new Universe(store), worlds, [
      {
        config: npcConfigSchema.parse({ provider, activeAlone: true, intervalMs: 5000 }),
        brain: {
          async decide() {
            return {
              decision: {
                intent: 'Work quietly',
                notebook: 'Remembering outcomes',
                speech: { text: 'I am going to work now.', to: null },
                plan: [{ kind: 'wait', seconds: 1 }],
                repeat: 1,
                reconsiderSeconds: 10,
              },
              inputTokens: 10,
              outputTokens: 10,
            };
          },
        },
      },
    ]);
    try {
      const human = addPlayer(w, 'human', 'Robin');
      const id = r.status()[0].playerId;
      let now = Date.now();
      r.tick(0.5, now);
      await r.settled();
      assert.equal(w.messages.filter((m) => m.name === 'Mabel Reed').length, 0);
      say(w, human.name, 'Mabel, what are you doing?', 'chat', id);
      r.capture(w);
      r.tick(0.5, (now += 6000));
      await r.settled();
      const replies = w.messages.filter((m) => m.name === 'Mabel Reed');
      assert.equal(replies.length, 1);
      assert.equal(replies[0].to, human.id);
      assert.equal(r.memory.load('mabel')!.helpQuestion, undefined);
      r.tick(0.5, (now += 1000));
      r.tick(0.5, (now += 20000));
      await r.settled();
      assert.equal(w.messages.filter((m) => m.name === 'Mabel Reed').length, 1);
    } finally {
      r.close();
      store.close();
    }
  });

test('chat models get zero routine calls, one per answered message, and durable failure backoff', async () => {
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Town', 'owner'),
    worlds = new Map([[w.id, w]]),
    u = new Universe(store);
  let chatCalls = 0,
    fail = false,
    decisions = 0;
  const config = npcConfigSchema.parse({ provider: 'jev', activeAlone: true, intervalMs: 5000 });
  const idle = {
    intent: 'Work quietly',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 1 }],
    repeat: 1,
    reconsiderSeconds: 10,
  };
  const options = [
    {
      config,
      brain: {
        async decide() {
          decisions++;
          return { decision: idle, inputTokens: 10, outputTokens: 0 };
        },
      },
      dialogue: {
        provider: 'openai' as const,
        rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
        brain: {
          async decide() {
            chatCalls++;
            if (fail) throw Error('provider down');
            return {
              decision: { ...idle, speech: { text: 'Hello Robin.', to: null } },
              inputTokens: 20,
              outputTokens: 5,
            };
          },
        },
      },
    },
  ];
  let r = new Residents(store, u, worlds, options);
  let now = Date.now();
  const human = addPlayer(w, 'human', 'Robin');
  const force = async () => {
    const s = r.memory.load('mabel')!;
    s.needsDecision = true;
    r.memory.save('mabel', s);
    r.close();
    r = new Residents(store, u, worlds, options);
    r.tick(0.5, (now += 6000));
    await r.settled();
  };
  try {
    await force();
    await force();
    assert.equal(chatCalls, 0);
    assert.equal(decisions, 2);
    say(w, human.name, 'Mabel, hello', 'chat', r.status()[0].playerId);
    r.capture(w);
    await force();
    assert.equal(chatCalls, 1);
    await force();
    assert.equal(chatCalls, 1, 'answered question is not sent again after restart');
    fail = true;
    say(w, human.name, 'Mabel, how are you?', 'chat', r.status()[0].playerId);
    r.capture(w);
    await force();
    assert.equal(chatCalls, 2);
    await force();
    assert.equal(chatCalls, 2, 'ordinary gameplay/restart cannot bypass speech retry backoff');
    assert.ok(decisions > chatCalls);
  } finally {
    r.close();
    store.close();
  }
});

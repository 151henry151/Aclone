// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIBrain } from '../src/server/npc/openai.ts';
import { AnthropicBrain } from '../src/server/npc/anthropic.ts';
for (const provider of ['openai', 'anthropic'] as const)
  test(`${provider} conversation supports bounded requests but cannot supply executable gameplay`, async () => {
    const reply = {
      gameplayRequest: {
        summary: 'Deliver wheat',
        cancel: false,
        delivery: {
          item: 'wheat',
          quantity: 118,
          unitPrice: 600,
          sourceBuilding: 'farm',
          destinationBuilding: 'mill',
        },
      },
      notebook: 'Robin owns a mill.',
      preferences: [{ activity: 'employment', stance: 'prefer', reason: 'I enjoy steady wages.' }],
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
    assert.deepEqual(Object.keys(schema.properties).sort(), [
      'gameplayRequest',
      'notebook',
      'preferences',
      'speech',
    ]);
    assert.equal(schema.additionalProperties, false);
    assert.equal(result.decision.speech?.to, 'robin');
    assert.deepEqual(result.decision.plan, [{ kind: 'wait', seconds: 60 }]);
    assert.equal(result.inputTokens, 200);
    assert.deepEqual(result.preferences, reply.preferences);
    assert.deepEqual(result.gameplayRequest, reply.gameplayRequest);
  });

import { decisionSchema } from '../src/server/npc/decision.ts';
import { createWorld, addPlayer, say, act } from '../src/shared/simulation.ts';
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

for (const channel of ['public', 'private'] as const)
  test(`controller keeps ${channel} replies on the initiating channel despite the model's recipient`, async () => {
    const store = new Store(':memory:');
    const w = createWorld('puddlewick', 'Town', 'owner');
    const worlds = new Map([[w.id, w]]);
    const human = addPlayer(w, 'human', 'Robin');
    const bystander = addPlayer(w, 'bystander', 'Bystander');
    const r = new Residents(store, new Universe(store), worlds, [
      {
        config: npcConfigSchema.parse({ provider: 'jev', activeAlone: true }),
        brain: {
          async decide() {
            return {
              decision: {
                intent: 'Keep working',
                notebook: '',
                speech: null,
                plan: [{ kind: 'wait', seconds: 60 }],
                repeat: 1,
                reconsiderSeconds: 60,
              },
              inputTokens: 10,
              outputTokens: 0,
            };
          },
        },
        dialogue: {
          provider: 'openai',
          rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
          brain: {
            async decide(request) {
              assert.equal(
                (request.observation as any).currentConversation.replyTo,
                channel === 'private' ? human.id : null,
              );
              return {
                decision: {
                  intent: 'Reply',
                  notebook: '',
                  speech: {
                    text: 'Hello Robin.',
                    to: channel === 'public' ? human.id : bystander.id,
                  },
                  plan: [{ kind: 'wait', seconds: 60 }],
                  repeat: 1,
                  reconsiderSeconds: 60,
                },
                inputTokens: 20,
                outputTokens: 5,
              };
            },
          },
        },
      },
    ]);
    try {
      const id = r.status()[0].playerId;
      say(w, human.name, 'Mabel, hello.', 'chat', channel === 'private' ? id : undefined);
      r.capture(w);
      r.tick(0.5, Date.now());
      await r.settled();
      const reply = w.messages.find((m) => m.name === 'Mabel Reed')!;
      assert.ok(reply);
      assert.equal(reply.to, channel === 'private' ? human.id : undefined);
    } finally {
      r.close();
      store.close();
    }
  });

test('public follow-ups stay with one resident, survive restart and expire without extra dialogue calls', async (t) => {
  const store = new Store(':memory:');
  const w = createWorld('puddlewick', 'Town', 'owner');
  const worlds = new Map([[w.id, w]]);
  const human = addPlayer(w, 'human', 'Robin');
  const other = addPlayer(w, 'other', 'Alex');
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const calls: string[] = [];
  const idle = {
    intent: 'Wait quietly',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 600 }],
    repeat: 1,
    reconsiderSeconds: 600,
  };
  const options = ['Mabel Reed', 'Elias Vale'].map((name) => ({
    config: npcConfigSchema.parse({
      id: name.split(' ')[0].toLowerCase(),
      name,
      provider: 'jev',
      activeAlone: true,
      intervalMs: 5000,
    }),
    brain: {
      async decide() {
        return { decision: idle, inputTokens: 10, outputTokens: 0 };
      },
    },
    dialogue: {
      provider: 'openai' as const,
      rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
      brain: {
        async decide(request: any) {
          calls.push(name + ': ' + request.observation.currentConversation.question);
          if (request.observation.currentConversation.question.startsWith('I am good.')) {
            assert.ok(
              request.observation.conversationHistory.some(
                (m: any) => m.text === 'How are things with you?',
              ),
            );
          }
          return {
            decision: { ...idle, speech: { text: 'How are things with you?', to: null } },
            inputTokens: 20,
            outputTokens: 5,
          };
        },
      },
    },
  }));
  let r = new Residents(store, new Universe(store), worlds, options);
  const send = async (text: string, speaker = human, to?: string) => {
    now += 6000;
    say(w, speaker.name, text, 'chat', to);
    r.capture(w);
    r.tick(0.5, now);
    await r.settled();
  };
  try {
    await send('Elias, how is it going?');
    assert.equal(calls.length, 1);
    r.close();
    r = new Residents(store, new Universe(store), worlds, options);
    await send('I am good. How can I make some real money?');
    assert.deepEqual(calls, [
      'Elias Vale: Elias, how is it going?',
      'Elias Vale: I am good. How can I make some real money?',
    ]);
    assert.equal(w.messages.at(-1)?.to, undefined);
    await send('I am also looking for work.', other);
    await send('How about the mill?', w.players[r.status()[0].playerId]);
    assert.equal(calls.length, 2, 'bystanders and NPC speech do not trigger replies');
    await send('Mabel, what do you think?');
    await send('And where is that?');
    assert.deepEqual(calls.slice(2), [
      'Mabel Reed: Mabel, what do you think?',
      'Mabel Reed: And where is that?',
    ]);
    // Even mentioning Mabel inside a DM to Elias must not wake her.
    await send('Does Mabel know about this?', human, r.status()[1].playerId);
    await send('Talking in public again.');
    assert.equal(calls.length, 5, 'private chat ends the public follow-up window');
    await send('Elias, hello again.');
    now += 121000;
    await send('This is unrelated later chat.');
    assert.equal(calls.length, 6, 'expired conversations do not call the chat model');
    await send('Mabel and Elias, hello.');
    assert.equal(calls.length, 8);
    await send('An ambiguous follow-up.');
    assert.equal(calls.length, 8, 'group mentions do not make multiple listeners sticky');
    await send('Elias, one more question.');
    await send('Alex, did you see that?');
    await send('I will talk to you later.');
    assert.equal(calls.length, 9, 'addressing a human ends the NPC thread');
    await send('Something eliaslike is not a name.');
    assert.equal(calls.length, 9, 'partial name matches do not trigger dialogue');
  } finally {
    r.close();
    store.close();
  }
});

test('conversation context survives noisy action history and keeps private turns out of public replies', () => {
  const store = new Store(':memory:');
  const r = new Residents(store, new Universe(store), new Map(), []);
  try {
    const add = (sender: string, text: string, to?: string) =>
      r.memory.append('elias', 1, 'chat', { kind: 'chat', sender, text, to });
    add('human', 'Public question');
    add('npc', 'Public answer');
    add('human', 'Private question', 'npc');
    add('npc', 'Private answer', 'human');
    add('npc', 'Another person’s private answer', 'other');
    for (let i = 0; i < 50; i++) r.memory.append('elias', 2, 'action', { type: 'drive' });
    assert.deepEqual(
      r.memory.conversation('elias', 'human', 'npc', false).map((e: any) => e.data.text),
      ['Public question', 'Public answer'],
    );
    assert.deepEqual(
      r.memory.conversation('elias', 'human', 'npc', true).map((e: any) => e.data.text),
      ['Private question', 'Private answer'],
    );
  } finally {
    r.close();
    store.close();
  }
});

test('long NPC and human chat use the same 1200-character limit without truncation', () => {
  const w = createWorld('puddlewick', 'Town', 'owner');
  const human = addPlayer(w, 'human', 'Robin');
  const text = 'A complete answer with detail. '.repeat(30) + 'This is the ending.';
  const d = decisionSchema.parse({
    intent: 'Answer',
    notebook: '',
    speech: { text, to: null },
    plan: [{ kind: 'wait', seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  });
  act(w, human.id, { type: 'chat', text: d.speech!.text });
  assert.equal(w.messages.at(-1)!.text, text);
  assert.throws(() => act(w, human.id, { type: 'chat', text: 'x'.repeat(1201) }), /Invalid text/);
  assert.throws(() => decisionSchema.parse({ ...d, speech: { text: 'x'.repeat(1201), to: null } }));
});

test('scheduled residents answer while preparing to leave, then depart after bounded chat grace', async (t) => {
  let now = Date.parse('2026-10-03T18:00:00Z'),
    chatCalls = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Town', 'owner'),
    worlds = new Map([[w.id, w]]),
    universe = new Universe(store);
  const config = npcConfigSchema.parse({
    id: 'mina',
    name: 'Mina Shaw',
    provider: 'jev',
    presence: 'scheduled',
    intervalMs: 5000,
  });
  const idle = {
    intent: 'Rest',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait' as const, seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  };
  let release: (() => void) | undefined;
  const r = new Residents(store, universe, worlds, [
    {
      config,
      brain: {
        async decide() {
          return { decision: idle, inputTokens: 1, outputTokens: 1 };
        },
      },
      dialogue: {
        rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
        brain: {
          async decide() {
            chatCalls++;
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            return {
              decision: {
                ...idle,
                speech: { text: 'Hello Robin, I am getting ready to head home.', to: null },
              },
              inputTokens: 20,
              outputTokens: 5,
            };
          },
        },
      },
    },
  ]);
  try {
    const human = addPlayer(w, 'human', 'Robin');
    now = r.memory.load('mina')!.presence!.nextAt;
    r.tick(0.5, now);
    await r.settled();
    const visit = r.memory.load('mina')!.presence!;
    now = visit.preparationUntil - 1000;
    say(w, human.name, 'Mina, hello!', 'chat');
    r.capture(w);
    r.tick(0.5, now);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(chatCalls, 1, 'preparing phase must not swallow the queued question');
    now += 2000;
    r.tick(0.5, now);
    assert.equal(
      w.players[r.status()[0].playerId].online,
      true,
      'in-flight reply gets a short grace period',
    );
    release!();
    await r.settled();
    assert.equal(w.messages.filter((m) => m.name === 'Mina Shaw' && m.kind === 'chat').length, 1);
    now = visit.preparationUntil + 120001;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(w.players[r.status()[0].playerId].online, false);
    assert.equal(chatCalls, 1, 'no unsolicited departure-model calls');
  } finally {
    release?.();
    r.close();
    store.close();
  }
});

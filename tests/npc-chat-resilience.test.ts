// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JevBrain, jevPayload, jevInstructions } from '../src/server/npc/jev.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { createWorld, addPlayer, say } from '../src/shared/simulation.ts';
import type { BrainResult } from '../src/server/npc/decision.ts';

test('large gameplay context fits the wire limit without losing candidate actions or local steps', async () => {
  const choices = Array.from({ length: 200 }, (_, i) => ({
    id: `action_${i}`,
    description: `Option ${i}: ` + 'A useful career with costs and outcomes. '.repeat(20),
    plan: [{ kind: 'wait' as const, seconds: i + 1 }],
  }));
  const request = {
    instructions: jevInstructions,
    observation: {
      self: { hunger: 40000, cash: 25000 },
      notebook: 'Working memory',
      choices,
      currentConversation: { question: 'Please deliver my wheat' },
      commitments: [{ summary: '118 wheat at 6d', delivered: 40 }],
      journal: Array(12).fill({ data: 'x'.repeat(1000) }),
      conversationHistory: Array(8).fill({ text: 'a'.repeat(1200) }),
      nearbyBuildings: Array(12).fill({ stock: 'x'.repeat(2500) }),
      gameGuide: 'x'.repeat(50000),
    },
  };
  const body = jevPayload(request, 'jev-latest');
  assert.ok(Buffer.byteLength(JSON.stringify(body)) <= 24000);
  assert.equal(Object.keys(body.questions.next_action.criteria).length, 200);
  assert.deepEqual(body.state.self, request.observation.self);
  assert.deepEqual(body.state.commitments, request.observation.commitments);
  assert.equal(body.state.journal, undefined);
  const brain = new JevBrain('test', 'jev-latest', async (_url, options) => {
    assert.deepEqual(JSON.parse(String(options?.body)), body);
    return Response.json({
      answers: {
        next_action: {
          type: 'choice',
          choice: 'action_199',
          confidence: 1,
          probabilities: Object.fromEntries(
            choices.map((c) => [c.id, c.id === 'action_199' ? 1 : 0]),
          ),
        },
      },
      usage: { input_tokens: 100, output_tokens: 0 },
    });
  });
  assert.deepEqual(
    (await brain.decide(request, new AbortController().signal)).decision.plan,
    choices[199].plan,
  );
});

test('an addressed reply bypasses a broken gameplay provider and its retry cooldown without replaying work', async (t) => {
  let now = Date.now(),
    gameCalls = 0,
    chatCalls = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    world = createWorld('puddlewick', 'Test', 'owner');
  const worlds = new Map([[world.id, world]]);
  const resident = new Residents(store, new Universe(store), worlds, [
    {
      config: npcConfigSchema.parse({
        id: 'mabel',
        provider: 'jev',
        presence: 'always',
        intervalMs: 5000,
      }),
      brain: {
        async decide(): Promise<BrainResult> {
          gameCalls++;
          throw Error('AI provider HTTP 400');
        },
      },
      dialogue: {
        rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
        brain: {
          async decide(request): Promise<BrainResult> {
            chatCalls++;
            assert.equal(
              (request.observation as any).currentConversation.question,
              'Mabel, can you hear me?',
            );
            return {
              decision: {
                intent: 'Reply',
                notebook: 'Heard the player',
                speech: { text: 'Yes, I can hear you.', to: null },
                plan: [{ kind: 'act', action: { type: 'quit' } }],
                repeat: 1,
                reconsiderSeconds: 60,
              },
              inputTokens: 10,
              outputTokens: 10,
            };
          },
        },
      },
    },
  ]);
  try {
    resident.tick(0.5, now);
    await resident.settled();
    assert.equal(gameCalls, 1);
    const human = addPlayer(world, 'human', 'Hank');
    say(world, human.name, 'Mabel, can you hear me?', 'chat');
    resident.capture(world);
    now += 6000;
    resident.tick(0.5, now);
    await resident.settled();
    assert.equal(gameCalls, 1);
    assert.equal(chatCalls, 1);
    const reply = world.messages.find((m) => m.text === 'Yes, I can hear you.')!;
    assert.ok(reply);
    assert.equal(reply.to, undefined);
    assert.equal(resident.status()[0].online, true);
    assert.equal(
      resident.memory.load('mabel')!.plan.length,
      0,
      'chat cannot replace the gameplay plan',
    );
    assert.equal(resident.memory.load('mabel')!.helpQuestion, undefined);
    for (let i = 0; i < 20; i++) {
      now += 500;
      resident.tick(0.5, now);
      await resident.settled();
    }
    assert.equal(chatCalls, 1, 'never replay the answered message');
  } finally {
    resident.close();
    store.close();
  }
});

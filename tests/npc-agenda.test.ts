// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  conversationView,
  decisionAgenda,
  learnedChoices,
  rememberConversation,
} from '../src/server/npc/agenda.ts';
import { unqueuedPromise } from '../src/server/npc/conversation.ts';
import { JevBrain, jevPayload, jevInstructions } from '../src/server/npc/jev.ts';
import { NpcMemory, type ResidentState } from '../src/server/npc/memory.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { createWorld, addPlayer, makeBuilding, say } from '../src/shared/simulation.ts';
const idle = {
  intent: 'Rest between errands',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait' as const, seconds: 60 }],
  repeat: 1,
  reconsiderSeconds: 60,
};
const state = () =>
  ({
    world: 'puddlewick',
    intent: idle.intent,
    notebook: 'LEGACY_SECRET',
    plan: idle.plan,
    index: 0,
  }) as ResidentState;

test('scoped memories survive restart, preserve other relationships and exclude private prose from public replies', () => {
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store),
      s = state();
    rememberConversation(
      s,
      { world: s.world, speakerId: 'alice', private: true },
      'ALICE_SECRET',
      [{ activity: 'fishing', stance: 'avoid', reason: 'SECRET_REASON' }],
      1,
    );
    rememberConversation(
      s,
      { world: s.world, speakerId: 'bob', private: true },
      'BOB_SECRET',
      null,
      2,
    );
    rememberConversation(
      s,
      { world: s.world, speakerId: 'alice', private: false },
      'Alice enjoys milling',
      null,
      3,
    );
    // Empty or malformed updates cannot erase existing relationships/preferences.
    rememberConversation(
      s,
      { world: s.world, speakerId: 'alice', private: false },
      '',
      [{ activity: 'admin', stance: 'prefer' }],
      4,
    );
    memory.save('mabel', s);
    const loaded = memory.load('mabel')!;
    assert.equal(loaded.agenda!.contacts.length, 3);
    assert.equal(loaded.agenda!.preferences.length, 1);
    const dirty = {
      notebook: 'LEGACY_SECRET',
      journal: ['ALICE_SECRET'],
      recalled: ['BOB_SECRET'],
      previousGoal: 'SECRET_REASON',
      agenda: decisionAgenda(loaded),
      currentConversation: { question: 'hello' },
      self: { cash: 2000 },
    };
    const publicView = conversationView(dirty, loaded, 'alice', false);
    assert.doesNotMatch(JSON.stringify(publicView), /SECRET/);
    assert.equal(publicView.notebook, 'Alice enjoys milling');
    assert.equal(publicView.self.cash, 2000);
    const privateOrder = {
      ...loaded,
      commitments: [
        {
          id: 'private-order',
          world: loaded.world,
          speakerId: 'alice',
          replyTo: 'alice',
          status: 'pending',
          summary: 'ALICE_SECRET',
          cancel: false,
          delivery: null,
          employment: { building: 'mill', train: true },
          delivered: 0,
          outcome: 'ALICE_SECRET',
        },
      ],
    } as ResidentState;
    assert.deepEqual(conversationView(dirty, privateOrder, 'bob', false).chosenPlan, []);
    assert.doesNotMatch(
      JSON.stringify(conversationView(dirty, privateOrder, 'bob', true)),
      /ALICE_SECRET/,
    );
    assert.equal(conversationView(dirty, privateOrder, 'alice', true).commitments.length, 1);

    const aliceView = JSON.stringify(conversationView(dirty, loaded, 'alice', true));
    assert.match(aliceView, /ALICE_SECRET/);
    assert.match(aliceView, /SECRET_REASON/);
    assert.doesNotMatch(aliceView, /BOB_SECRET|LEGACY_SECRET/);
    assert.doesNotMatch(
      JSON.stringify(conversationView(dirty, loaded, 'bob', true)),
      /ALICE_SECRET|SECRET_REASON/,
    );
    assert.doesNotMatch(
      JSON.stringify(conversationView(dirty, { ...loaded, world: 'elsewhere' }, 'alice', true)),
      /ALICE_SECRET/,
    );
  } finally {
    store.close();
  }
});

test('learned preferences reach the real Jev wire payload under pressure without removing survival alternatives', async () => {
  const s = state();
  rememberConversation(
    s,
    { world: s.world, speakerId: 'alice', private: true },
    'I prefer steady income.',
    [{ activity: 'fishing', stance: 'avoid', reason: 'PRIVATE_REASON' }],
    1,
  );
  const choices = learnedChoices(s, [
    {
      id: 'fish',
      description: 'Go fishing for supper',
      plan: [{ kind: 'fish' as const, catches: 1 }],
    },
    {
      id: 'meal',
      description: 'Eat carried bread',
      plan: [{ kind: 'act' as const, action: { type: 'use' as const, item: 'bread' } }],
    },
  ]);
  assert.match(choices[0].description, /Conflicts with my learned fishing preference/);
  assert.doesNotMatch(choices[0].description, /PRIVATE_REASON/);
  assert.equal(choices[1].id, 'meal');
  const request = {
    instructions: jevInstructions,
    observation: {
      agenda: decisionAgenda(s),
      choices,
      notebook: 'x'.repeat(3000),
      nearbyBuildings: Array(60).fill('x'.repeat(2000)),
      self: { hunger: 40000 },
    },
  };
  const payload = jevPayload(request, 'test');
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= 24000);
  assert.deepEqual(payload.state.agenda, request.observation.agenda);
  const brain = new JevBrain('test', 'test', async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.state.agenda.preferences[0].stance, 'avoid');
    assert.equal(body.state.self.hunger, 40000);
    return Response.json({
      answers: {
        next_action: {
          type: 'choice',
          choice: 'meal',
          confidence: 1,
          probabilities: { meal: 1, fish: 0 },
        },
      },
      usage: { input_tokens: 10, output_tokens: 0 },
    });
  });
  assert.deepEqual(
    (await brain.decide(request, new AbortController().signal)).decision.plan,
    choices[1].plan,
  );
});

test('chat has the next free slot and omits action-candidate generation while preferences persist into gameplay', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Test', 'owner'),
    worlds = new Map([[w.id, w]]);
  const calls: string[] = [];
  const options = ['mabel', 'toby'].map((id) => ({
    config: npcConfigSchema.parse({
      id,
      name: id,
      provider: 'jev',
      presence: 'always',
      intervalMs: 5000,
    }),
    brain: {
      async decide(req: any) {
        calls.push('game:' + id);
        if (id === 'toby') assert.equal(req.observation.agenda.preferences[0].activity, 'fishing');
        return { decision: idle, inputTokens: 10, outputTokens: 0 };
      },
    },
    dialogue: {
      rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
      brain: {
        async decide(req: any) {
          calls.push('chat:' + id);
          assert.equal(req.observation.choices, undefined);
          assert.equal(req.observation.journal, undefined);
          return {
            decision: {
              ...idle,
              notebook: 'I told Hank I dislike fishing.',
              speech: { text: 'Fishing is a bit slow for my taste, Hank.', to: null },
            },
            preferences: [
              {
                activity: 'fishing' as const,
                stance: 'avoid' as const,
                reason: 'I prefer busier work.',
              },
            ],
            inputTokens: 10,
            outputTokens: 10,
          };
        },
      },
    },
  }));
  const r = new Residents(store, new Universe(store), worlds, options, {
    concurrency: 1,
    dailyUsd: 2,
  });
  try {
    const human = addPlayer(w, 'human', 'Hank');
    say(w, human.name, 'toby, do you like fishing?', 'chat');
    r.capture(w);
    r.tick(0.5, now);
    await r.settled();
    assert.deepEqual(calls, ['chat:toby']);
    assert.equal(r.memory.load('toby')!.agenda!.contacts[0].private, false);
    for (let i = 0; i < 15; i++) {
      now += 1000;
      r.tick(0.5, now);
      await r.settled();
    }
    assert.ok(calls.includes('game:toby'));
    assert.equal(calls.filter((c) => c === 'chat:toby').length, 1);
  } finally {
    r.close();
    store.close();
  }
});

for (const fallback of ['budget', 'error', 'new-proposal'] as const)
  test(`a ${fallback} receipt fallback keeps one durable agreement and never retries speech`, async (t) => {
    let now = Date.now(),
      chats = 0;
    t.mock.method(Date, 'now', () => now);
    const store = new Store(':memory:'),
      w = createWorld('puddlewick', 'Test', 'owner'),
      worlds = new Map([[w.id, w]]);
    const mill = makeBuilding('mill', 'mill', 0, 0);
    w.buildings = [mill];
    mill.owner = 'human';
    const r = new Residents(
      store,
      new Universe(store),
      worlds,
      [
        {
          config: npcConfigSchema.parse({
            id: 'mabel',
            provider: 'jev',
            presence: 'always',
            intervalMs: 5000,
          }),
          brain: {
            async decide() {
              return { decision: idle, inputTokens: 1, outputTokens: 0 };
            },
          },
          dialogue: {
            rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
            brain: {
              async decide(req: any) {
                chats++;
                if (req.observation.responsePhase === 'receipt') {
                  assert.equal(req.observation.agreementResult.accepted, true);
                  if (fallback === 'error') throw Error('provider unavailable');
                }
                return {
                  decision: { ...idle, speech: { text: 'UNVERIFIED_DRAFT', to: null } },
                  gameplayRequest: {
                    summary: 'Train and work',
                    cancel: false,
                    delivery: null,
                    employment: { building: mill.id, train: true },
                  },
                  inputTokens: 10,
                  outputTokens: 10,
                };
              },
            },
          },
        },
      ],
      { callsPerHour: fallback === 'budget' ? 1 : 120, dailyUsd: 2 },
    );
    try {
      const h = addPlayer(w, 'human', 'Hank');
      say(w, h.name, 'Mabel, please learn milling and work at my mill.', 'chat');
      r.capture(w);
      r.tick(0.5, now);
      await r.settled();
      const saved = r.memory.load('mabel')!;
      assert.equal(saved.commitments!.length, 1);
      assert.equal(chats, fallback === 'budget' ? 1 : 2);
      assert.doesNotMatch(
        w.messages
          .filter((m) => m.name === 'Mabel Reed')
          .map((m) => m.text)
          .join('\n'),
        /UNVERIFIED_DRAFT/,
      );
      assert.ok(w.messages.some((m) => m.text.includes('I have agreed to')));
      for (let i = 0; i < 8; i++) {
        now += 1000;
        r.tick(0.5, now);
        await r.settled();
      }
      assert.equal(chats, fallback === 'budget' ? 1 : 2);
      assert.equal(r.memory.load('mabel')!.commitments!.length, 1);
    } finally {
      r.close();
      store.close();
    }
  });

test('ordinary conversational idioms do not trigger the unsupported-errand correction', () => {
  assert.equal(unqueuedPromise("I'll go ahead and explain."), false);
  assert.equal(unqueuedPromise("I'll work out the numbers."), false);
  assert.equal(unqueuedPromise("I'll go ahead and explain, then drive to your mill."), true);
  assert.equal(unqueuedPromise("I'll deliver wheat."), true);
});

test('restart during receipt wording delivers the saved acknowledgement once without another chat call', async (t) => {
  let now = Date.now(),
    chats = 0;
  t.mock.method(Date, 'now', () => now);
  const store = new Store(':memory:');
  const w = createWorld('puddlewick', 'Test', 'owner');
  const human = addPlayer(w, 'human', 'Hank');
  const mill = makeBuilding('mill', 'mill', 0, 0);
  mill.owner = human.id;
  w.buildings = [mill];
  let release!: () => void, receiptStarted!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    receiptStarted = resolve;
  });
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'mabel',
        provider: 'jev',
        presence: 'always',
        intervalMs: 5000,
      }),
      brain: {
        async decide() {
          return { decision: idle, inputTokens: 1, outputTokens: 0 };
        },
      },
      dialogue: {
        rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
        brain: {
          async decide(req: any) {
            chats++;
            if (req.observation.responsePhase === 'receipt') {
              receiptStarted();
              await gate;
              return {
                decision: { ...idle, speech: { text: 'LATE_RECEIPT', to: null } },
                gameplayRequest: null,
                inputTokens: 1,
                outputTokens: 1,
              };
            }
            return {
              decision: { ...idle, speech: { text: 'DRAFT', to: null } },
              gameplayRequest: {
                summary: 'Train at the mill',
                cancel: false,
                delivery: null,
                employment: { building: mill.id, train: true },
              },
              inputTokens: 1,
              outputTokens: 1,
            };
          },
        },
      },
    },
  ];
  let r = new Residents(store, new Universe(store), new Map([[w.id, w]]), options, { dailyUsd: 2 });
  try {
    const id = r.status()[0].playerId;
    say(w, human.name, 'Mabel, please learn milling and work at my mill.', 'chat', id);
    r.capture(w);
    r.tick(0.5, now);
    await started;
    assert.equal(r.memory.load('mabel')!.pendingAgreementReply!.to, human.id);
    r.close();
    const old = r;
    const loadedWorlds = new Map(store.loadWorlds().map((v) => [v.world.id, v.world]));
    r = new Residents(store, new Universe(store), loadedWorlds, options, { dailyUsd: 2 });
    now += 1000;
    r.tick(0.5, now);
    await r.settled();
    const restored = loadedWorlds.get(w.id)!;
    const replies = restored.messages.filter(
      (m) => m.name === 'Mabel Reed' && m.text.includes('I have agreed to'),
    );
    assert.equal(replies.length, 1);
    assert.equal(replies[0].to, human.id);
    assert.equal(r.memory.load('mabel')!.pendingAgreementReply, undefined);
    assert.equal(r.memory.load('mabel')!.commitments!.length, 1);
    assert.equal(chats, 2);
    release();
    await old.settled();
    now += 1000;
    r.tick(0.5, now);
    await r.settled();
    assert.equal(chats, 2);
    assert.ok(!restored.messages.some((m) => m.text === 'LATE_RECEIPT'));
  } finally {
    release();
    r.close();
    store.close();
  }
});

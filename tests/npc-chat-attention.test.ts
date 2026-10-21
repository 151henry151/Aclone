// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicAddressees, isChatDismissal } from '../src/server/npc/chat-attention.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { createWorld, addPlayer, say } from '../src/shared/simulation.ts';
import type { BrainResult } from '../src/server/npc/decision.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

const idle = {
  intent: 'Work quietly',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait' as const, seconds: 600 }],
  repeat: 1,
  reconsiderSeconds: 600,
};
const answer = (): BrainResult => ({
  decision: { ...idle, speech: { text: 'A short answer.', to: null } },
  inputTokens: 10,
  outputTokens: 5,
});

test('public routing distinguishes a direct address from talking about a resident', () => {
  const players = ['Mabel Reed', 'Elias Vale', 'Alex'].map((name) => ({ name }));
  const targets = (s: string) => publicAddressees(s, players).map((p) => p.name);
  for (const text of [
    'Mabel, hello',
    'Hey Mabel how are you?',
    'How are you Mabel?',
    'Can you help, Mabel?',
  ])
    assert.deepEqual(targets(text), ['Mabel Reed'], text);
  for (const text of [
    'so mabel is powered by a chat model',
    'Mabel is being annoying',
    'Mabel Reed is being annoying',
    'I think Mabel has a house',
    'https://example.com/mabel',
  ])
    assert.deepEqual(targets(text), [], text);
  assert.deepEqual(targets('@Alex I think we can talk without mabel interrupting'), ['Alex']);
  assert.deepEqual(targets('Alex, does Mabel have a house?'), ['Alex']);
  assert.deepEqual(targets('Mabel and Elias, hello'), ['Mabel Reed', 'Elias Vale']);
});

test('silence requests do not confuse stopping work or continuing a conversation', () => {
  for (const text of [
    'Mabel: please stop sending messages.',
    'mabel you can stop responding to this convo, we dont need help right now thank you',
    'lol thanks mabel enough for now shh',
    'Please be quiet',
    'Do not reply',
    'mabel okay thank you your input isnt required right now',
    'Mabel, your help isn’t needed right now',
    'No need to respond',
  ])
    assert.equal(isChatDismissal(text), true, text);
  for (const text of [
    'Mabel, stop working at the mill',
    "Don't stop responding",
    'How do I stop sending messages?',
    'Mabel, can you help with my farm?',
  ])
    assert.equal(isChatDismissal(text), false, text);
});

function fixture(t: any, dialogue?: () => Promise<BrainResult>) {
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Town', 'owner');
  const human = addPlayer(w, 'human', 'Robin'),
    other = addPlayer(w, 'other', 'Alex');
  let now = Date.now(),
    calls = 0;
  t.mock.method(Date, 'now', () => now);
  const worlds = new Map([[w.id, w]]),
    universe = new Universe(store);
  const options = [
    {
      config: npcConfigSchema.parse({ provider: 'jev', activeAlone: true, intervalMs: 5000 }),
      brain: {
        async decide() {
          return { decision: idle, inputTokens: 1, outputTokens: 0 };
        },
      },
      dialogue: {
        provider: 'openai' as const,
        rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
        brain: {
          async decide() {
            calls++;
            return dialogue ? dialogue() : answer();
          },
        },
      },
    },
  ];
  let r = new Residents(store, universe, worlds, options);
  t.after(() => {
    r.close();
    store.close();
  });
  const capture = (text: string, speaker = human, to?: string) => {
    now += 6000;
    say(w, speaker.name, text, 'chat', to);
    r.capture(w);
  };
  return {
    store,
    w,
    human,
    other,
    get r() {
      return r;
    },
    get calls() {
      return calls;
    },
    capture,
    tick: () => r.tick(0.5, now),
    async send(text: string, speaker = human, to?: string) {
      capture(text, speaker, to);
      r.tick(0.5, now);
      await r.settled();
    },
    restart(state?: ResidentState) {
      r.close();
      if (state)
        store.db
          .prepare('UPDATE npc_residents SET state=? WHERE id=?')
          .run(JSON.stringify(state), 'mabel');
      r = new Residents(store, universe, worlds, options);
    },
    advance(ms: number) {
      now += ms;
    },
    replies: () => w.messages.filter((m) => m.name === 'Mabel Reed' && m.kind === 'chat'),
  };
}

test('a public stop closes every participant, stays quiet after restart, and permits a fresh invitation', async (t) => {
  const f = fixture(t);
  await f.send('Mabel, hello');
  await f.send('Mabel, how are you?', f.other);
  assert.equal(f.calls, 2);
  await f.send('Mabel, stop responding, we dont need help right now', f.other);
  assert.equal(f.calls, 2, 'silence is handled without a model acknowledgement');
  assert.equal(f.r.memory.load('mabel')!.publicConversations?.length, 0);
  f.restart();
  for (const text of [
    'lol',
    'Are you in the game Discord?',
    'Mabel is powered by a chat model',
    '@Alex we can talk without Mabel interrupting',
  ])
    await f.send(text);
  assert.equal(f.calls, 2);
  assert.equal(f.replies().length, 2);
  await f.send('Mabel, where can I buy water?');
  assert.equal(f.calls, 3, 'an explicit new invitation resumes conversation');
  assert.equal(f.replies().at(-1)?.to, undefined);
});

test('unnamed follow-ups are bounded and acknowledgements and human chat close them', async (t) => {
  const f = fixture(t);
  await f.send('Mabel, where is the mill?');
  await f.send('And can I work there?');
  await f.send('What skill do I need?');
  await f.send('Are you on Discord?');
  assert.equal(f.calls, 3, 'only two implicit follow-ups per invitation');
  await f.send('Mabel, another question');
  await f.send('lol');
  await f.send('Are you on Discord?');
  assert.equal(f.calls, 4, 'bare reactions close attention');
  await f.send('Mabel, where is the school?');
  await f.send('@Alex is Mabel still there?');
  await f.send('Are you on Discord?');
  assert.equal(f.calls, 5, 'human addressee takes priority');
  await f.send('Mabel, help please');
  await f.send('Talking to Robin now', f.other);
  await f.send('Are you on Discord?');
  assert.equal(f.calls, 6, 'human-to-human conversation clears stale listeners');
  await f.send('Mabel, help again');
  f.advance(110000);
  await f.send('And what about the bakery?');
  f.advance(10000);
  await f.send('And the mill?');
  assert.equal(f.calls, 8, 'follow-ups do not extend the original two-minute expiry');
});

for (const failing of [false, true])
  test(`stop drops an in-flight ${failing ? 'failed' : 'successful'} chat reply and prevents retries`, async (t) => {
    let release!: (v: BrainResult) => void, reject!: (e: Error) => void, started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = fixture(t, () => {
      started();
      return new Promise<BrainResult>((resolve, fail) => {
        release = resolve;
        reject = fail;
      });
    });
    f.capture('Mabel, tell me about the mill');
    f.tick();
    await ready;
    f.capture('Mabel, please stop sending messages', f.other);
    if (failing) reject(Error('provider timeout'));
    else
      release({
        ...answer(),
        gameplayRequest: {
          summary: 'Learn milling',
          cancel: false,
          delivery: null,
          employment: { building: 'b6', train: true },
        },
      });
    await f.r.settled();
    assert.equal(f.replies().length, 0);
    assert.equal(
      f.w.messages.some((m) => m.name === 'AI notice'),
      false,
    );
    assert.equal(
      f.r.memory.load('mabel')!.commitments?.length ?? 0,
      0,
      'stale agreement not accepted',
    );
    f.advance(300000);
    f.tick();
    await f.r.settled();
    assert.equal(f.calls, 1, 'no retries or new chat calls after a stop');
    assert.equal(f.r.memory.load('mabel')!.helpQuestion, undefined);
  });

test('private silence is scoped to its channel; public closure cannot cancel an unrelated DM', async (t) => {
  let release!: (v: BrainResult) => void, started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = fixture(t, () => {
    started();
    return new Promise<BrainResult>((resolve) => {
      release = resolve;
    });
  });
  const id = f.r.status()[0].playerId;
  f.capture('Tell me about fishing', f.human, id);
  f.tick();
  await ready;
  f.capture('Mabel, stop talking', f.other);
  release(answer());
  await f.r.settled();
  assert.equal(f.replies().length, 1);
  assert.equal(f.replies()[0].to, f.human.id);
  await f.send('Please stop responding', f.human, id);
  assert.equal(f.calls, 1);
});

test('a stop discards a saved unsent agreement reply without cancelling the agreed work', async (t) => {
  const f = fixture(t);
  await f.send('Mabel, hello');
  const state = f.r.memory.load('mabel')!;
  const id = state.conversationId!;
  state.pendingAgreementReply = {
    world: f.w.id,
    text: 'A saved acknowledgement.',
    conversationId: id,
  };
  state.commitments = [
    {
      id: `${f.w.id}:${id}`,
      speakerId: f.human.id,
      replyTo: null,
      world: f.w.id,
      summary: 'Existing agreement',
      cancel: false,
      delivery: {
        item: 'wheat',
        quantity: 2,
        unitPrice: 600,
        sourceBuilding: null,
        destinationBuilding: 'b6',
      },
      status: 'pending',
      delivered: 0,
      outcome: 'Agreed but not delivered.',
    },
  ];
  f.restart(state);
  assert.ok(f.r.memory.load('mabel')!.pendingAgreementReply);
  await f.send('Mabel: please stop sending messages.');
  f.advance(30000);
  f.tick();
  await f.r.settled();
  assert.equal(f.r.memory.load('mabel')!.pendingAgreementReply, undefined);
  assert.equal(
    f.w.messages.some((m) => m.text === 'A saved acknowledgement.'),
    false,
  );
  assert.notEqual(f.r.memory.load('mabel')!.commitments?.[0].status, 'cancelled');
  assert.equal(f.r.memory.load('mabel')!.commitments?.[0].blockedNoticeSent, true);
  assert.equal(
    f.w.messages.some((m) => m.name === 'Mabel Reed' && m.text.includes('blocked')),
    false,
  );
  assert.equal(f.calls, 1);
});

test('private stop invalidates its in-flight reply and a later direct message can resume', async (t) => {
  let release!: (v: BrainResult) => void, started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  let first = true;
  const f = fixture(t, () => {
    if (!first) return Promise.resolve(answer());
    first = false;
    started();
    return new Promise<BrainResult>((resolve) => {
      release = resolve;
    });
  });
  const id = f.r.status()[0].playerId;
  f.capture('Tell me about milling', f.human, id);
  f.tick();
  await ready;
  f.capture('Please stop responding', f.human, id);
  release(answer());
  await f.r.settled();
  assert.equal(f.replies().length, 0);
  f.restart();
  await f.send('Can you help again?', f.human, id);
  assert.equal(f.calls, 2);
  assert.equal(f.replies().length, 1);
  assert.equal(f.replies()[0].to, f.human.id);
});

test('an unnamed stop still dismisses the last allowed follow-up while it is in flight', async (t) => {
  let calls = 0,
    release!: (v: BrainResult) => void,
    started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const f = fixture(t, () => {
    if (++calls < 3) return Promise.resolve(answer());
    started();
    return new Promise<BrainResult>((resolve) => {
      release = resolve;
    });
  });
  await f.send('Mabel, tell me about the mill');
  await f.send('And the bakery?');
  f.capture('And the farm?');
  f.tick();
  await ready;
  f.capture('Please stop responding');
  release(answer());
  await f.r.settled();
  assert.equal(f.replies().length, 2);
  assert.equal(f.r.memory.load('mabel')!.helpQuestion, undefined);
  assert.equal(f.calls, 3);
});

test('ordinary all-statements do not invite group replies; natural dismissal stays local', async (t) => {
  const f = fixture(t);
  for (const text of [
    'all that disappears when you own a business',
    'all these farms have max stocks',
    'all my prices are lower now',
    'i find myself reading the tool tip for stock info',
  ])
    await f.send(text);
  assert.equal(f.calls, 0);
  await f.send('Hey everyone, hello!');
  assert.equal(f.calls, 1, 'explicit group greetings still work');
  await f.send('mabel okay thank you your input isnt required right now');
  await f.send('What about your farm?');
  assert.equal(f.calls, 1, 'dismiss without an acknowledgement call or follow-up');
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { groupResponder } from '../src/server/npc/group-chat';
import { npcConfigSchema } from '../src/server/npc/config';
import { Store } from '../src/server/store';
import { OpenAIBrain } from '../src/server/npc/openai';
import { AnthropicBrain } from '../src/server/npc/anthropic';
const fixture = () => {
  const w = createWorld('communication', 'Communication', 'owner');
  w.script = '';
  const p = addPlayer(w, 'owner', 'Owner');
  const other = addPlayer(w, 'other', 'Neighbour');
  return { w, p, other };
};
const patch = (w: ReturnType<typeof fixture>['w'], values: Record<string, number>) =>
  act(w, 'owner', { type: 'settings', patch: values });

test('chat defaults and local limits apply to complete public/private and NPC speech without changing history', () => {
  const { w, p, other } = fixture();
  assert.equal((w.settings as any).chatMaxLength, 1200);
  const send = (text: string, to?: string) =>
    act(w, p.id, { type: 'chat', text, ...(to ? { to } : {}) });
  send('a'.repeat(1200));
  assert.throws(() => send('a'.repeat(1201)), /Invalid text/);
  delete (w.settings as any).chatMaxLength;
  send('b'.repeat(1200), other.id);
  assert.throws(() => send('b'.repeat(1201), other.id), /Invalid text/);
  const history = structuredClone(w.messages);
  patch(w, { chatMaxLength: 80 });
  assert.deepEqual(w.messages, history);
  for (const npc of [false, true]) {
    p.npc = npc;
    for (const to of [undefined, other.id]) {
      send('c'.repeat(80), to);
      assert.equal(w.messages.at(-1)?.text, 'c'.repeat(80));
      assert.throws(() => send('c'.repeat(81), to), /Invalid text/);
    }
  }
  patch(w, { chatMaxLength: 1600 });
  send('x'.repeat(1590) + ' complete.');
  assert.equal(w.messages.at(-1)?.text.length, 1600);
  assert.throws(() => send('x'.repeat(1601)), /Invalid text/);
  for (const text of ['', '   ']) assert.throws(() => send(text), /Invalid text/);
  p.muted = true;
  assert.throws(() => send('hello'), /muted/);
  p.muted = false;
  w.settings.chatLocked = true;
  assert.throws(() => send('hello', other.id), /muted/);
});

test('CB uses the smaller local chat and radio limit', () => {
  for (const [chat, radio, cap] of [
    [80, 200, 80],
    [1600, 1200, 1200],
  ]) {
    const { w, p } = fixture();
    p.vehicle = 0;
    p.online = true;
    patch(w, { chatMaxLength: chat, radioMaxLength: radio });
    assert.throws(
      () => act(w, p.id, { type: 'radio', operation: 'key', text: 'x'.repeat(cap + 1) }),
      /Invalid text/,
    );
    act(w, p.id, { type: 'radio', operation: 'key', text: 'x'.repeat(cap) });
  }
});

test('group delay uses real seconds and saved reply times while preserving one interested respondent', () => {
  const { w, p } = fixture();
  assert.equal((w.settings as any).npcGroupReplyCooldown, 30);
  p.online = true;
  p.hunger = p.thirst = 0;
  const candidate = {
    config: npcConfigSchema.parse({ id: 'owner' }),
    state: { playerId: p.id, world: w.id, groupReplyAt: 100000 } as any,
  };
  const select = (now: number) => groupResponder(w, [candidate], '@all Hello neighbours', 20, now);
  assert.equal(select(129999), undefined);
  assert.equal(select(130000), candidate);
  delete (w.settings as any).npcGroupReplyCooldown;
  assert.equal(select(129999), undefined);
  patch(w, { npcGroupReplyCooldown: 5 });
  assert.equal(select(104999), undefined);
  assert.equal(select(105000), candidate);
  patch(w, { npcGroupReplyCooldown: 60 });
  assert.equal(select(130000), undefined);
  patch(w, { npcGroupReplyCooldown: 0 });
  assert.equal(select(100000), candidate);
  assert.equal(candidate.state.groupReplyAt, 100000);
  candidate.state = JSON.parse(JSON.stringify(candidate.state));
  patch(w, { npcGroupReplyCooldown: 30 });
  assert.equal(select(129999), undefined);
  p.online = false;
  assert.equal(select(160000), undefined);
});

test('communication fields validate atomically and round trip through every world-building surface', async () => {
  const { w, p } = fixture();
  for (const [key, values] of Object.entries({
    chatMaxLength: [0, -1, 1.5, 12001, NaN, Infinity],
    npcGroupReplyCooldown: [-1, 86401, NaN, Infinity],
  }))
    for (const value of values) {
      const before = structuredClone(w.settings);
      assert.throws(() => patch(w, { [key]: value }));
      assert.deepEqual(w.settings, before);
    }
  delete (w.settings as any).chatMaxLength;
  delete (w.settings as any).npcGroupReplyCooldown;
  patch(w, { chatMaxLength: 1600, npcGroupReplyCooldown: 5 });
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design'),
    { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  assert.match(settingsFields(w.settings), /name="chatMaxLength"[^>]*value="1600"/);
  assert.match(settingsFields(w.settings), /name="npcGroupReplyCooldown"[^>]*value="5"/);
  assert.match(rulesSummary(w), /1600/);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    const dest = createWorld('dest', 'Destination', 'other');
    applyDesign(dest, exportDesign(w));
    const observed = observe(
      w,
      p,
      { plan: [], index: 0 } as any,
      new NpcMemory(store),
      'resident',
    ).worldRules;
    for (const rules of [saved.settings, dest.settings, observed]) {
      assert.equal((rules as any).chatMaxLength, 1600);
      assert.equal((rules as any).npcGroupReplyCooldown, 5);
    }
    const bad = structuredClone(exportDesign(w));
    (bad.settings as any).chatMaxLength = 0;
    const before = structuredClone(dest);
    assert.throws(() => applyDesign(dest, bad));
    assert.deepEqual(dest, before);
  } finally {
    store.close();
  }
});

for (const provider of ['openai', 'anthropic'] as const)
  for (const mode of ['plan', 'conversation'] as const)
    test(`${provider} ${mode} advertises and enforces the local speech limit`, async () => {
      for (const cap of [80, 1600]) {
        let length = cap;
        const transport: typeof fetch = async (_url, init) => {
          const body = JSON.parse(String(init?.body));
          const schema = body.tools[0].parameters ?? body.tools[0].input_schema;
          const speech = schema.properties.speech.anyOf.find((s: any) => s.type === 'object');
          assert.equal(speech.properties.text.maxLength, cap);
          const conversation = {
            notebook: '',
            speech: { text: 'x'.repeat(length), to: null },
            gameplayRequest: null,
            preferences: null,
          };
          const value =
            mode === 'conversation'
              ? conversation
              : {
                  intent: 'Reply',
                  notebook: '',
                  speech: conversation.speech,
                  plan: [{ kind: 'wait', seconds: 60 }],
                  repeat: 1,
                  reconsiderSeconds: 60,
                };
          const name = mode === 'conversation' ? 'converse' : 'plan_turn';
          return new Response(
            JSON.stringify(
              provider === 'openai'
                ? {
                    status: 'completed',
                    output: [{ type: 'function_call', name, arguments: JSON.stringify(value) }],
                    usage: { input_tokens: 10, output_tokens: 10 },
                  }
                : {
                    stop_reason: 'tool_use',
                    content: [{ type: 'tool_use', name, input: value }],
                    usage: { input_tokens: 10, output_tokens: 10 },
                  },
            ),
          );
        };
        const brain =
          provider === 'openai'
            ? new OpenAIBrain('fake', 'fake', transport, mode)
            : new AnthropicBrain('fake', 'fake', transport, mode);
        const request = {
          instructions: 'Test',
          observation: { worldRules: { chatMaxLength: cap } },
        };
        const result = await brain.decide(request, new AbortController().signal);
        assert.equal(result.decision.speech?.text.length, cap);
        length++;
        await assert.rejects(() => brain.decide(request, new AbortController().signal));
      }
    });

test('family chat uses the local limit and retains privacy and moderation', async () => {
  const { w, p, other } = fixture();
  act(w, p.id, { type: 'family', operation: 'create', name: 'Neighbours' });
  act(w, p.id, { type: 'family', operation: 'invite', player: other.id });
  act(w, other.id, { type: 'family', operation: 'join', family: p.family });
  Object.assign(w.settings, { chatMaxLength: 80 });
  const send = (text: string) => act(w, p.id, { type: 'family', operation: 'message', text });
  assert.throws(() => send('x'.repeat(81)));
  send('x'.repeat(80));
  assert.deepEqual(
    w.messages
      .slice(-2)
      .map((m) => m.to)
      .sort(),
    [p.id, other.id].sort(),
  );
  const { socialHtml } = await import('../src/client/social');
  assert.match(socialHtml(w, p), /Family message<textarea[^>]*maxlength="80"/);
  patch(w, { chatMaxLength: 1600 });
  send('x'.repeat(1600));
  assert.equal(w.messages.at(-1)?.text.length, 1600);
  p.muted = true;
  assert.throws(() => send('hello'), /muted/);
});

for (const dialogue of [false, true])
  test(`resident controller publishes complete local-limit replies through ${dialogue ? 'dialogue' : 'planning'}`, async () => {
    const { Residents } = await import('../src/server/npc/residents'),
      { Universe } = await import('../src/server/universe'),
      { say } = await import('../src/shared/simulation');
    const store = new Store(':memory:'),
      w = createWorld('puddlewick', 'Town', 'owner');
    Object.assign(w.settings, { chatMaxLength: 1600 });
    const text = 'A complete neighbourly reply. '.repeat(45).trim();
    assert.ok(text.length > 1200 && text.length < 1600);
    const brain = {
      async decide() {
        return {
          decision: {
            intent: 'Rest',
            notebook: '',
            speech: { text, to: null },
            plan: [{ kind: 'wait' as const, seconds: 1 }],
            repeat: 1,
            reconsiderSeconds: 10,
          },
          inputTokens: 10,
          outputTokens: 10,
        };
      },
    };
    const residents = new Residents(store, new Universe(store), new Map([[w.id, w]]), [
      {
        config: npcConfigSchema.parse({
          provider: dialogue ? 'jev' : 'openai',
          activeAlone: true,
          intervalMs: 5000,
        }),
        brain,
        ...(dialogue
          ? {
              dialogue: {
                provider: 'openai' as const,
                rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
                brain,
              },
            }
          : {}),
      },
    ]);
    try {
      const human = addPlayer(w, 'human', 'Robin'),
        id = residents.status()[0].playerId;
      const now = Date.now();
      residents.tick(0.5, now);
      await residents.settled();
      assert.equal(
        w.messages.some((m) => m.text === text),
        false,
      );
      say(w, human.name, 'Mabel, hello', 'chat', id);
      residents.capture(w);
      residents.tick(0.5, now + 6000);
      await residents.settled();
      const replies = w.messages.filter((m) => m.name === 'Mabel Reed');
      assert.equal(replies.length, 1);
      assert.equal(replies[0].text, text);
      assert.equal(replies[0].to, human.id);
    } finally {
      residents.close();
      store.close();
    }
  });

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, createWorld, say } from '../src/shared/simulation.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { groupInterest, groupResponder, isGroupAddress } from '../src/server/npc/group-chat.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

const offer =
  'Hey guys, I just set my wage at my mixed-crop farm to 24d; any farmers interested in working here, or anyone want to learn the farmer skill to run my farm?';
const idle = {
  intent: 'Keep playing',
  notebook: '',
  speech: null,
  plan: [{ kind: 'wait' as const, seconds: 600 }],
  repeat: 1,
  reconsiderSeconds: 600,
};

test('explicit group salutations exclude incidental prose and word prefixes', () => {
  for (const text of [
    offer,
    '@all I am hiring',
    'Everyone, hello',
    'Hi everybody!',
    'Anyone interested in work?',
    'Hey, folks!',
  ])
    assert.ok(isGroupAddress(text), text);
  for (const text of [
    'I saw everyone at the mill',
    'Guysborough is nice',
    'Alligator!',
    'Rowan, are you there?',
  ])
    assert.equal(isGroupAddress(text), false, text);
});
test('group interest uses qualifications, training budget, needs and remembered job wages', () => {
  const w = createWorld('puddlewick', 'Town', 'owner');
  const p = addPlayer(w, 'farmer', 'Farmer');
  p.online = true;
  p.skills = ['farmer'];
  const c = {
    config: npcConfigSchema.parse({ id: 'farmer', preference: 'farmer' }),
    state: { playerId: p.id, world: w.id } as ResidentState,
  };
  assert.ok(groupInterest(w, p, c, offer));
  p.thirst = 45000;
  assert.equal(groupInterest(w, p, c, offer), undefined);
  p.thirst = 0;
  p.skills = [];
  p.cash = 100;
  assert.equal(groupInterest(w, p, c, offer), undefined);
  p.cash = 20000;
  assert.ok(groupInterest(w, p, c, offer));
  p.skills = ['farmer'];
  p.job = 'elsewhere';
  c.state.markets = {
    world: w.id,
    visits: { elsewhere: { at: w.time, building: { wage: 3000 } as any, staff: [] } },
  };
  assert.equal(groupInterest(w, p, c, offer), undefined);
  // Do not consult a different live wage somewhere the resident has not inspected.
  c.state.markets.visits.elsewhere.building.wage = 1000;
  assert.ok(groupInterest(w, p, c, offer));
  c.state.helpQuestion = 'A direct question';
  assert.equal(groupInterest(w, p, c, offer), undefined);
  delete c.state.helpQuestion;
  c.state.groupReplyAt = Date.now();
  assert.equal(groupResponder(w, [c], offer, 10, Date.now()), undefined);
});
test('all online NPCs hear a group offer, only one interested resident calls chat, and its agreement reaches gameplay', async () => {
  const store = new Store(':memory:');
  const w = createWorld('puddlewick', 'Town', 'owner');
  const human = addPlayer(w, 'human', 'Robin');
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.owner = human.id;
  farm.wage = 2400;
  const calls: string[] = [];
  const options = ['Mabel Reed', 'Rowan Field', 'Toby Finch'].map((name, i) => ({
    config: npcConfigSchema.parse({
      id: name.split(' ')[0].toLowerCase(),
      name,
      provider: 'jev',
      activeAlone: true,
      intervalMs: 5000,
      preference: i === 1 ? 'farmer' : i === 2 ? 'employee' : 'balanced',
    }),
    brain: {
      async decide() {
        return { decision: idle, inputTokens: 0, outputTokens: 0 };
      },
    },
    dialogue: {
      provider: 'openai' as const,
      rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
      brain: {
        async decide(request: any) {
          calls.push(name);
          if (request.observation.currentConversation?.audience === 'public-group') {
            assert.equal(request.observation.currentConversation.replyTo, null);
            assert.ok(
              request.observation.currentConversation.groupGuidance.includes('not verified'),
            );
            return {
              decision: { ...idle, speech: { text: 'I am interested in the farm job.', to: null } },
              inputTokens: 10,
              outputTokens: 10,
              gameplayRequest: {
                summary: 'Take Robin’s farm job',
                cancel: false,
                delivery: null,
                employment: { building: farm.id, train: true },
              },
            };
          }
          return {
            decision: {
              ...idle,
              speech: {
                text: 'I have agreed to take the farm job after checking its terms.',
                to: null,
              },
            },
            inputTokens: 10,
            outputTokens: 10,
          };
        },
      },
    },
  }));
  const r = new Residents(store, new Universe(store), new Map([[w.id, w]]), options);
  try {
    for (const resident of r.status()) {
      const p = w.players[resident.playerId];
      p.online = true;
      p.hunger = p.thirst = 0;
      p.cash = 100000;
      p.x = farm.x;
      p.z = farm.z + 12;
      if (resident.id === 'rowan') p.skills = ['farmer'];
    }
    say(w, human.name, offer, 'chat');
    r.capture(w);
    for (const resident of r.status()) {
      assert.ok(
        r.memory
          .recent(resident.id, 10)
          .some((e: any) => e.kind === 'chat' && e.data.text === offer),
      );
      assert.equal(!!r.memory.load(resident.id)?.helpQuestion, resident.id === 'rowan');
    }
    r.tick(0.5, Date.now());
    await r.settled();
    assert.ok(calls.length > 0);
    assert.ok(
      calls.every((n) => n === 'Rowan Field'),
      'no chat calls for uninterested listeners',
    );
    assert.ok(r.memory.load('rowan')!.commitments?.some((c) => c.employment?.building === farm.id));
    assert.ok(w.messages.some((m) => m.name === 'Rowan Field' && !m.to));
    const before = calls.length;
    r.capture(w);
    r.tick(0.5, Date.now() + 1000);
    await r.settled();
    assert.equal(calls.length, before, 'capturing the same message does not replay replies');
    say(w, human.name, '@all Any other farmers interested in working here?', 'chat');
    r.capture(w);
    assert.ok(
      r.status().every((c) => !r.memory.load(c.id)!.helpQuestion),
      'rapid group repeat cannot fan out to everyone',
    );
  } finally {
    r.close();
    store.close();
  }
});

test('group decline is silent and not retried; offline listeners and private messages never fan out', async () => {
  const store = new Store(':memory:');
  const w = createWorld('puddlewick', 'Town', 'owner');
  const human = addPlayer(w, 'human', 'Robin');
  let calls = 0;
  const options = ['mabel', 'rowan'].map((id) => ({
    config: npcConfigSchema.parse({
      id,
      name: id === 'mabel' ? 'Mabel Reed' : 'Rowan Field',
      provider: 'jev',
      activeAlone: true,
    }),
    brain: {
      async decide() {
        return { decision: idle, inputTokens: 0, outputTokens: 0 };
      },
    },
    dialogue: {
      provider: 'openai' as const,
      rates: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
      brain: {
        async decide() {
          calls++;
          return { decision: idle, inputTokens: 1, outputTokens: 1 };
        },
      },
    },
  }));
  const r = new Residents(store, new Universe(store), new Map([[w.id, w]]), options);
  try {
    const [mabel, rowan] = r.status();
    for (const c of r.status()) {
      const p = w.players[c.playerId];
      p.online = false;
      p.hunger = p.thirst = 0;
    }
    say(w, human.name, '@all Hello everyone!', 'chat');
    r.capture(w);
    assert.ok(r.status().every((c) => !r.memory.load(c.id)!.helpQuestion));
    w.players[mabel.playerId].online = true;
    say(w, human.name, '@all Hello neighbours!', 'chat');
    r.capture(w);
    assert.ok(r.memory.load('mabel')!.helpQuestion);
    assert.equal(r.memory.load('rowan')!.helpQuestion, undefined);
    r.tick(0.5, Date.now());
    await r.settled();
    assert.equal(calls, 1);
    assert.equal(r.memory.load('mabel')!.helpQuestion, undefined);
    assert.equal(w.messages.filter((m) => m.name === 'Mabel Reed' && m.kind === 'chat').length, 0);
    r.tick(0.5, Date.now() + 6000);
    await r.settled();
    assert.equal(calls, 1, 'speech:null completes the invitation');
    const saved = r.status().map((c) => ({
      config: options.find((o) => o.config.id === c.id)!.config,
      state: r.memory.load(c.id)!,
    }));
    assert.equal(
      groupResponder(w, saved, '@all Hello again', 100, Date.now()),
      undefined,
      'saved cooldown survives reconstruction',
    );
    say(w, human.name, '@all this is private', 'chat', rowan.playerId);
    r.capture(w);
    assert.equal(r.memory.load('mabel')!.helpQuestion, undefined);
    assert.equal(r.memory.load('rowan')!.helpQuestion, '@all this is private');
    assert.ok(
      !r.memory
        .recent('mabel', 100)
        .some(
          (e) => e.kind === 'chat' && (e.data as { text?: string }).text === '@all this is private',
        ),
    );
  } finally {
    r.close();
    store.close();
  }
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameGuide, searchGuide } from '../src/server/npc/knowledge.ts';

test('NPC always knows the controls and retrieves relevant player help without the full manual', () => {
  const guide = gameGuide('How do I reset my password by email?');
  assert.match(guide.controls, /F4/);
  assert.match(guide.controls, /\*\*M\*\*/);
  assert.match(guide.controls, /Parish map/);
  assert.match(guide.controls, /Space/);
  assert.ok(
    guide.excerpts.some((e) => /verified/i.test(e.text) && /Forgot your password/i.test(e.text)),
  );
  assert.ok(JSON.stringify(guide).length < 35000);
  assert.ok(guide.fundamentals.reduce((n, e) => n + e.text.length, 0) <= 12500);
  assert.match(
    searchGuide('loans credit mortgage')
      .map((e) => e.text)
      .join('\n'),
    /repayment|instalment/,
  );
  const combined = gameGuide('How do I produce water?', 'How do I produce water?');
  const ids = [...combined.fundamentals, ...combined.excerpts, ...combined.activityExcerpts].map(
    (e) => e.id,
  );
  assert.equal(new Set(ids).size, ids.length, 'guide sections are not sent multiple times');
  assert.ok(!ids.includes('faq:controls'), 'controls are included separately');
  assert.ok(gameGuide('').excerpts.length === 0);
  const core = gameGuide('')
    .fundamentals.map((e) => e.text)
    .join('\n');
  assert.match(core, /Take this job/);
  assert.match(core, /Work two cycles/);
  assert.match(core, /5 wheat/);
  assert.match(core, /Stockroom/);
  assert.match(core, /Ultrakricket/);
  assert.match(core, /offline/i);
});
test('guide lookup covers FAQ, economy and defaults directly from the catalog', () => {
  for (const [query, expected] of [
    ['What does parp mean?', /horn/i],
    ['Can I give money to someone or refuel a stranded player?', /Players & roadside help/],
    ['Why can I not sell to my own shop?', /Stockroom/],
    ['How do I leave my house and walk?', /Go outside/],
    ['What happens when I log out offline?', /ageing/],
    ['How do I grow coffee crops?', /10 hours|ten hours|60 days/],
    ['Ultrakricket rules', /three seconds/],
    ['hotel booking pantry', /1–24/],
    ['recipe:sawmill', /"logs":2/],
    ['recipe:waterworks', /"water":12/],
    ['How do I produce water?', /shoreline/i],
    ['jump between stars', /parsec/],
  ] as const) {
    assert.match(
      searchGuide(query)
        .map((e) => e.text)
        .join('\n'),
      expected,
      query,
    );
  }
});
test('guide is bounded, cites bundled sources and never treats a query as a path', () => {
  assert.deepEqual(searchGuide('../../.env'), []);
  assert.deepEqual(searchGuide('https://example.com/secret'), []);
  const result = searchGuide('farm school inventory water '.repeat(10000));
  assert.ok(result.length <= 3);
  assert.ok(result.reduce((n, e) => n + e.text.length, 0) <= 6500);
  for (const entry of result) assert.match(entry.source, /^(docs|data)\//);
  assert.ok(gameGuide('').topics.some((t) => t.id.includes('farming')));
});

test('long memory excerpts and help fit the resident request budget together', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const { observe, instructions } = await import('../src/server/npc/observation.ts');
  const { createWorld } = await import('../src/shared/simulation.ts');
  const { turnTool } = await import('../src/server/npc/openai.ts');
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Puddlewick', 'server');
  const residents = new Residents(store, new Universe(store), new Map([[w.id, w]]), [
    {
      config: npcConfigSchema.parse({}),
      brain: {
        async decide() {
          throw Error('No network in test');
        },
      },
    },
  ]);
  try {
    const state = residents.memory.load('mabel')!;
    state.notebook = 'N'.repeat(3000);
    state.helpQuestion = 'farm school inventory water';
    for (let i = 0; i < 12; i++)
      residents.memory.append('mabel', 0, 'chat', { text: 'x'.repeat(1000) });
    state.recall = Array.from({ length: 20 }, (_, i) => ({
      id: 20 - i,
      time: 0,
      kind: 'chat',
      data: { text: 'y'.repeat(1500) },
    }));
    const observation = observe(w, w.players[state.playerId], state, residents.memory, 'mabel');
    const request = { instructions: instructions + 'P'.repeat(3000), observation };
    assert.ok(
      Buffer.byteLength(JSON.stringify(request)) + Buffer.byteLength(JSON.stringify(turnTool)) <
        96000,
    );
    assert.equal(observation.moreRecallAvailable, true);
    assert.equal(observation.recalled?.length, 8);
    assert.equal(state.recall.length, 20, 'full stored results stay intact');
  } finally {
    residents.close();
    store.close();
  }
});

test('a distant workplace remains in context even when local buildings crowd the selection', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { NpcMemory } = await import('../src/server/npc/memory.ts');
  const { observe } = await import('../src/server/npc/observation.ts');
  const { createWorld, addPlayer } = await import('../src/shared/simulation.ts');
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store);
    const w = createWorld('puddlewick', 'Test', 'owner');
    const p = addPlayer(w, 'resident', 'Mabel');
    const b = w.buildings.find((b) => b.kind === 'mill')!;
    b.owner = 'owner';
    b.x = 150;
    b.z = 100;
    b.investment = 1459;
    b.stock = { wheat: 12, flour: 29 };
    p.x = 0;
    p.z = 0;
    p.job = b.id;
    p.skills = ['miller'];
    b.employees = [p.id];
    for (let i = 0; i < 20; i++)
      w.buildings.push({ ...w.buildings[0], id: 'near-' + i, x: 1, z: 1 });
    const state = {
      playerId: p.id,
      world: w.id,
      name: p.name,
      personality: 'Helpful',
      notebook: '',
      intent: 'Work at the mill',
      cursor: 0,
      nextAt: 0,
      plan: [],
      index: 0,
      repeats: 0,
      until: 0,
      waitUntil: 0,
      status: 'Ready',
      errors: 0,
      helpQuestion: 'Mabel, why is my mill stalled?',
      questionFrom: 'owner',
    };
    const o = observe(w, p, state, memory, 'mabel');
    assert.equal(o.nearbyBuildings[0].id, b.id);
    assert.equal(o.currentWork[0].questionerOwnsBuilding, true);
    assert.match(o.currentWork[0].diagnosis!, /7\.41d/);
    assert.ok(o.nearbyBuildings.length <= 12);
    assert.equal(o.currentConversation!.speakerId, 'owner');
    assert.equal(o.currentConversation!.replyTo, null, 'public conversation stays public');
  } finally {
    store.close();
  }
});

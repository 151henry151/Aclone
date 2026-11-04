// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameGuide, searchGuide } from '../src/server/npc/knowledge.ts';
function embeddedEntries(group: ReturnType<typeof gameGuide>['fundamentals']) {
  return Object.entries(group).map(([id, value]) =>
    typeof value === 'string' ? { id, text: value } : { id, ...value },
  );
}
function topicIndex(guide: ReturnType<typeof gameGuide>) {
  return Object.fromEntries(
    Object.entries(guide.topics).flatMap(([prefix, sections]) =>
      Object.entries(sections).map(([section, title]) => [`${prefix}:${section}`, title]),
    ),
  );
}

test('NPC always knows the controls and retrieves relevant player help without the full manual', () => {
  const guide = gameGuide('How do I reset my password by email?');
  assert.match(guide.controls, /F4/);
  assert.equal(
    new Set(Object.values(topicIndex(guide))).size,
    Object.keys(topicIndex(guide)).length,
  );
  assert.match(guide.controls, /\*\*M\*\*/);
  assert.match(guide.controls, /Parish map/);
  assert.match(guide.controls, /Space/);
  assert.ok(
    embeddedEntries(guide.excerpts).some(
      (e) => /verified/i.test(e.text) && /Forgot your password/i.test(e.text),
    ),
  );
  assert.ok(JSON.stringify(guide).length < 35000);
  assert.ok(embeddedEntries(guide.fundamentals).reduce((n, e) => n + e.text.length, 0) <= 12500);
  assert.match(
    searchGuide('loans credit mortgage')
      .map((e) => e.text)
      .join('\n'),
    /repayment|instalment/,
  );
  const combined = gameGuide('How do I produce water?', 'How do I produce water?');
  const ids = [
    ...embeddedEntries(combined.fundamentals),
    ...embeddedEntries(combined.excerpts),
    ...embeddedEntries(combined.activityExcerpts),
  ].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'guide sections are not sent multiple times');
  assert.ok(!ids.includes('faq:controls'), 'controls are included separately');
  assert.ok(Object.keys(gameGuide('').excerpts).length === 0);
  const core = embeddedEntries(gameGuide('').fundamentals)
    .map((e) => e.text)
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
  assert.ok(Object.keys(topicIndex(gameGuide(''))).some((id) => id.includes('farming')));
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
    const requestBytes =
      Buffer.byteLength(JSON.stringify(request)) + Buffer.byteLength(JSON.stringify(turnTool));
    assert.ok(
      requestBytes < 96000,
      `Request bytes: ${requestBytes}; ` +
        JSON.stringify(
          Object.fromEntries(
            Object.entries(request.observation).map(([key, value]) => [
              key,
              Buffer.byteLength(JSON.stringify(value) ?? ''),
            ]),
          ),
        ),
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

test('guide compaction removes only prose soft wraps, retaining every word, paragraph, list and code line', async () => {
  const { compactGuideText } = await import('../src/server/npc/knowledge');
  assert.equal(
    compactGuideText('First wrapped\nparagraph continues.\n\nNext paragraph.'),
    'First wrapped paragraph continues.\n\nNext paragraph.',
  );
  for (const block of [
    '- First\n- Second',
    '1. First\n2. Second',
    '```\ncode\n```',
    '| A | B |\n| C | D |',
    '> First\n> Second',
    '    indented\n    code',
  ])
    assert.equal(compactGuideText(block), block);
});

test('selected manual headings occur once in the topic index without repeating them in each excerpt', () => {
  const guide = gameGuide('farm school inventory water');
  for (const entry of [
    ...embeddedEntries(guide.fundamentals),
    ...embeddedEntries(guide.excerpts),
    ...embeddedEntries(guide.activityExcerpts),
  ]) {
    if (!Object.hasOwn(guide.sources, entry.id.split(':')[0])) continue;
    assert.ok(
      Object.hasOwn(topicIndex(guide), entry.id.replace(/:\d+$/, '')),
      'heading remains available by section id',
    );
    assert.equal('title' in entry, false, 'do not repeat an indexed heading');
    assert.ok(entry.text.length > 0);
    assert.ok(guide.sources[entry.id.split(':')[0] as keyof typeof guide.sources]);
  }
});

test('outside investment help has its own topic instead of expanding school guidance', () => {
  const topic = Object.entries(topicIndex(gameGuide(''))).find(
    ([, title]) => title === 'Outside investment terms (unreleased)',
  );
  assert.ok(topic, 'Investment terms need their own searchable player-guide section');
  const entries = searchGuide('outside investments operating reserve');
  assert.ok(entries.some((e) => e.id.startsWith(topic[0]) && /principal plus 8%/.test(e.text)));
  const schools = searchGuide('Local school and relief terms');
  for (const entry of schools.filter((e) => e.id.startsWith('playing:local-school')))
    assert.doesNotMatch(entry.text, /Outside investments default/);
});

test('resident guide keeps complete cited text and ids without repeating section anchors', async () => {
  const { compactGuideText } = await import('../src/server/npc/knowledge');
  const query = 'Local cash transfer limits',
    original = searchGuide(query),
    guide = gameGuide(query);
  for (const entry of embeddedEntries(guide.excerpts)) {
    const full = original.find((e) => e.id === entry.id)!;
    assert.ok(full);
    assert.equal(entry.text, compactGuideText(full.text));
    if (full.source.startsWith('docs/')) {
      assert.equal(
        guide.sources[entry.id.split(':')[0] as keyof typeof guide.sources],
        full.source.split('#')[0],
      );
      assert.equal('source' in entry, false, 'manual source is retained once per prefix');
      assert.ok(full.source.includes('#'), 'direct lookup retains the precise citation');
      assert.ok(Object.hasOwn(topicIndex(guide), entry.id.replace(/:\d+$/, '')));
    }
  }
});

test('topic index retains every manual heading and lookup id in a compact keyed index', async () => {
  const { readFileSync } = await import('node:fs');
  const expected = new Map<string, string>();
  for (const file of ['FAQ', 'PLAYING', 'ECONOMY']) {
    const sections = readFileSync(new URL(`../docs/${file}.md`, import.meta.url), 'utf8')
      .split(/^## /m)
      .slice(1);
    for (const section of sections) {
      const title = section.slice(0, section.indexOf('\n')).trim();
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      expected.set(title, `${file.toLowerCase()}:${slug}`);
    }
  }
  assert.equal(Object.keys(topicIndex(gameGuide(''))).length, expected.size);
  assert.deepEqual(
    topicIndex(gameGuide('')),
    Object.fromEntries([...expected].map(([title, id]) => [id, title])),
  );
});

test('embedded manual source dictionary preserves every selected citation without repeating paths', () => {
  const guide = gameGuide('farm school inventory water', 'miller bakery water');
  assert.deepEqual(guide.sources, {
    faq: 'docs/FAQ.md',
    playing: 'docs/PLAYING.md',
    economy: 'docs/ECONOMY.md',
  });
  for (const entry of [
    ...embeddedEntries(guide.fundamentals),
    ...embeddedEntries(guide.excerpts),
    ...embeddedEntries(guide.activityExcerpts),
  ]) {
    const prefix = entry.id.split(':')[0] as keyof typeof guide.sources;
    if (Object.hasOwn(guide.sources, prefix)) {
      const original = searchGuide(entry.id).find((e) => e.id === entry.id)!;
      assert.ok(original);
      assert.equal(guide.sources[prefix], original.source.split('#')[0]);
      assert.equal('source' in entry, false);
    } else {
      assert.ok('source' in entry);
    }
  }
});

test('gameplay instructions retain explicit AI identity and one copy of the operator impersonation prohibition', async () => {
  const { instructions } = await import('../src/server/npc/observation');
  assert.match(instructions, /You are openly an AI NPC/);
  assert.equal(instructions.match(/never pretend to be a human operator/gi)?.length, 1);
});

test('guide groups manual topic prefixes once and documents the complete lookup ID format', () => {
  const guide = gameGuide('farm school inventory water');
  assert.deepEqual(Object.keys(guide.topics), ['faq', 'playing', 'economy']);
  assert.equal(guide.topicIdFormat, 'prefix:section');
  assert.ok(Object.keys(guide.topics.faq).includes('controls'));
  assert.equal(topicIndex(guide)['faq:controls'], 'Controls');
});

test('embedded guide uses keyed sections while preserving selected text and catalogue citations', async () => {
  const { compactGuideText } = await import('../src/server/npc/knowledge');
  for (const query of [
    'farm school inventory water',
    'recipe:sawmill',
    'Local cash transfer limits',
  ]) {
    const guide = gameGuide(query);
    for (const group of [guide.fundamentals, guide.excerpts, guide.activityExcerpts])
      assert.equal(
        Array.isArray(group),
        false,
        'Lookup IDs are dictionary keys, not repeated fields',
      );
    const selected = searchGuide(query);
    assert.deepEqual(
      Object.keys(guide.excerpts),
      selected.map((e) => e.id),
    );
    for (const original of selected) {
      const value = (guide.excerpts as any)[original.id];
      if (original.source.startsWith('docs/')) assert.equal(value, compactGuideText(original.text));
      else
        assert.deepEqual(value, {
          title: original.title,
          source: original.source,
          text: compactGuideText(original.text),
        });
    }
  }
});

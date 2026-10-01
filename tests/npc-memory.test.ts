// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { NpcMemory } from '../src/server/npc/memory.ts';
import { npcConfigSchema, npcEnvironment } from '../src/server/npc/config.ts';
import { decisionSchema } from '../src/server/npc/decision.ts';

test('NPC journal retains events, pages old memories and isolates residents', () => {
  const store = new Store(':memory:');
  try {
    const memory = new NpcMemory(store);
    for (let i = 0; i < 150; i++) memory.append('mabel', 1, 'chat', { text: `Ada turn ${i}` });
    memory.append('other', 1, 'chat', { text: 'Ada secret' });
    assert.equal(memory.recent('mabel', 20).length, 20);
    const page = memory.search('mabel', 'Ada', null);
    assert.equal(page.length, 20);
    assert.ok(!JSON.stringify(page).includes('secret'));
    assert.equal(memory.search('mabel', 'Ada', page.at(-1)!.id).length, 20);
    assert.equal(memory.search('mabel', 'turn 149', null).length, 1);
    assert.equal(memory.search('mabel', "' OR 1=1 --", null).length, 0);
    assert.equal(memory.count('mabel'), 150);
  } finally {
    store.close();
  }
});
test('NPC model has no admin, chat-command or arbitrary code action', () => {
  const base = {
    intent: 'Try work',
    notebook: '',
    speech: null,
    repeat: 1,
    reconsiderSeconds: 300,
  };
  for (const action of [
    { type: 'command', text: '*cash 9999' },
    { type: 'settings', fighting: true },
    { type: 'script', source: 'x' },
    { type: 'chat', text: '*owner' },
  ])
    assert.equal(
      decisionSchema.safeParse({ ...base, plan: [{ kind: 'act', action }] }).success,
      false,
    );
  assert.equal(
    decisionSchema.safeParse({
      ...base,
      plan: [
        {
          kind: 'act',
          action: {
            type: 'trade',
            building: 'market',
            item: 'bread',
            quantity: -1,
            direction: 'buy',
          },
        },
      ],
    }).success,
    false,
  );
  assert.equal(npcEnvironment({}), undefined);
  assert.throws(() => npcEnvironment({ NPC_ENABLED: 'true' }), /OPENAI_API_KEY/);
  assert.equal(npcConfigSchema.parse({}).name, 'Mabel Reed');
});

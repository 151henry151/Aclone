// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema, bakerDefaults } from '../src/server/npc/config.ts';
import { createWorld, advance, addPlayer, say } from '../src/shared/simulation.ts';
import type { Brain, BrainRequest, Decision } from '../src/server/npc/decision.ts';
const turn = (plan: Decision['plan'], notebook = '') => ({
  decision: {
    intent: 'Bake bread',
    notebook,
    speech: null,
    plan,
    repeat: 1,
    reconsiderSeconds: 600,
  },
  inputTokens: 100,
  outputTokens: 50,
});

test('Toby learns baking and earns ordinary bakery wages; both residents retain separate identities and memories', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  const worlds = new Map([[w.id, w]]);
  const school = w.buildings.find((b) => b.kind === 'school')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  const requests: BrainRequest[] = [];
  const mabelBrain: Brain = {
    async decide() {
      return turn([{ kind: 'wait', seconds: 600 }], 'Mabel remembers her tools');
    },
  };
  let calls = 0;
  const bakerBrain: Brain = {
    async decide(request) {
      requests.push(request);
      calls++;
      if (calls === 1) {
        assert.match((request.observation as any).previousGoal, /learn baker/);
        return turn(
          [
            { kind: 'act', action: { type: 'learn', building: school.id, skill: 'baker' } },
            { kind: 'wait', seconds: 60 },
          ],
          'Toby remembers learning breadmaking',
        );
      }
      return turn(
        [
          { kind: 'act', action: { type: 'job', building: bakery.id } },
          { kind: 'act', action: { type: 'work', building: bakery.id } },
          { kind: 'wait', seconds: 600 },
        ],
        'Toby remembers learning breadmaking',
      );
    },
  };
  const configs = [
    npcConfigSchema.parse({ activeAlone: true, intervalMs: 5000 }),
    npcConfigSchema.parse({ ...bakerDefaults, activeAlone: true, intervalMs: 5000 }),
  ];
  const options = [
    { config: configs[0], brain: mabelBrain },
    {
      config: configs[1],
      brain: bakerBrain,
      rates: {
        inputUsdPerMillion: 1,
        outputUsdPerMillion: 5,
        cacheWriteMultiplier: 1.25,
        cacheReadMultiplier: 0.1,
      },
    },
  ];
  let residents = new Residents(store, universe, worlds, options, { dailyUsd: 2 });
  try {
    const identities = residents.status().map((r) => r.playerId);
    const toby = w.players[identities[1]];
    assert.equal(toby.name, 'Toby Finch');
    assert.equal(toby.skills.length, 0);
    const initialCash = toby.cash;
    toby.x = school.x;
    toby.z = school.z;
    const now = Date.now();
    residents.tick(0.05, now);
    await residents.settled();
    residents.tick(0.05, now + 500);
    assert.equal(toby.cash, initialCash - 8000);
    advance(w, 60);
    assert.ok(toby.skills.includes('baker'));
    toby.x = bakery.x;
    toby.z = bakery.z;
    bakery.owner = 'owner';
    bakery.stock = { flour: 10, bread: 0 };
    bakery.investment = 20000;
    const human = addPlayer(w, 'human', 'Test neighbour');
    say(w, human.name, 'Toby, work at the bakery now. Secret word: sourdough.', 'chat', toby.id);
    residents.capture(w);
    residents.tick(0.05, now + 61000);
    await residents.settled();
    residents.tick(0.05, now + 61500);
    residents.tick(0.05, now + 62000);
    const cash = toby.cash;
    advance(w, 540);
    assert.equal(bakery.stock.flour, 8);
    assert.equal(bakery.stock.bread, 3);
    assert.ok(toby.cash > cash);
    assert.equal(residents.memory.search('mabel', 'sourdough', null).length, 0);
    assert.equal(residents.memory.search('toby', 'sourdough', null).length, 1);
    assert.match(requests.at(-1)!.instructions, /male village baker/);
    residents.close();
    const loaded = new Map(store.loadWorlds().map((r) => [r.world.id, r.world]));
    residents = new Residents(store, universe, loaded, options, { dailyUsd: 2 });
    assert.deepEqual(
      residents.status().map((r) => r.playerId),
      identities,
    );
    assert.equal(residents.memory.load('mabel')!.notebook, 'Mabel remembers her tools');
    assert.equal(residents.memory.load('toby')!.notebook, 'Toby remembers learning breadmaking');
    assert.ok(loaded.get(w.id)!.players[toby.id].skills.includes('baker'));
    assert.equal(loaded.get(w.id)!.players[toby.id].job, bakery.id);
    assert.equal(calls, 2);
  } finally {
    residents.close();
    store.close();
  }
});

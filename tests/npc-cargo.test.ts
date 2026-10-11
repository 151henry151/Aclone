// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, advance, addPlayer, createWorld, carry } from '../src/shared/simulation.ts';
import { strandedCargo, canKeepFishing } from '../src/server/npc/cargo.ts';
import { cargoRelief } from '../src/server/npc/business-policy.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';

function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'fisher', 'Fisher');
  Object.assign(p, {
    fuel: 0,
    inventory: { fish: 141, water: 1, tackle: 1, pickaxe: 1, shovel: 1, chainsaw: 1 },
    x: -500,
    z: -500,
  });
  return { w, p };
}

test('empty-tank cargo recovery preserves tools, meals and cash and makes walking possible', () => {
  const { w, p } = fixture();
  const cash = p.cash;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }));
  const plan = strandedCargo(p, w);
  assert.ok(plan.some((s) => s.kind === 'act' && s.action.type === 'discard'));
  for (const s of plan) if (s.kind === 'act') act(w, p.id, s.action);
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(carry(p, w), 60);
  assert.equal(p.inventory.water, 1);
  assert.equal(p.inventory.pickaxe, 1);
  assert.equal(p.inventory.chainsaw, 1);
  assert.equal(p.inventory.shovel, 1);
  assert.ok(p.inventory.fish >= 3);
  assert.equal(p.cash, cash);
});

test('stranded residents sell to an adjacent funded buyer instead of discarding', () => {
  const { w, p } = fixture();
  const b = w.buildings.find((b) => b.kind === 'market')!;
  p.x = b.x;
  p.z = b.z;
  b.buy.fish = 1200;
  b.stock.fish = 0;
  b.investment = 200000;
  const cash = p.cash;
  for (const s of strandedCargo(p, w))
    if (s.kind === 'act') {
      assert.notEqual(s.action.type, 'discard');
      act(w, p.id, s.action);
    }
  assert.ok(p.cash > cash);
  assert.ok(carry(p, w) <= 60);
  p.inventory.fuel = 1;
  p.inventory.fish = 100;
  assert.deepEqual(strandedCargo(p, w), [], 'carried fuel takes priority over cargo removal');
});

test('fish reserves stop further catches and excess food is offered for sale before full', () => {
  const { w, p } = fixture();
  p.inventory = { fish: 10, tackle: 1 };
  p.fuel = 20;
  const b = w.buildings.find((b) => b.kind === 'market')!;
  b.buy.fish = 1200;
  b.investment = 100000;
  b.stock.fish = 0;
  assert.equal(canKeepFishing(w, p), false);
  assert.ok(
    cargoRelief(w, p).some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'fish',
    ),
  );
  p.inventory.fish = 1;
  assert.equal(canKeepFishing(w, p), true);
});

test('the controller recovers a stranded overloaded fisher and buys a drink without model calls', async () => {
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const { w } = fixture();
  delete w.players.fisher;
  completePuddlewick(w);
  const worlds = new Map([[w.id, w]]);
  const residents = new Residents(
    store,
    universe,
    worlds,
    [
      {
        config: npcConfigSchema.parse({
          id: 'mabel',
          provider: 'jev',
          presence: 'always',
          activeAlone: true,
        }),
        brain: {
          async decide(): Promise<never> {
            throw Error('No model needed');
          },
        },
      },
    ],
    { dailyUsd: 0 },
  );
  const id = residents.status()[0].playerId;
  Object.assign(w.players[id], {
    cash: 2076,
    fuel: 0,
    hunger: 23381,
    thirst: 35000,
    x: 20,
    z: 153,
    inventory: { fish: 141, tackle: 1, pickaxe: 1, shovel: 1, chainsaw: 1 },
  });
  let now = Date.now();
  try {
    for (let i = 0; i < 30000 && worlds.get(w.id)!.players[id].thirst >= 35000; i++) {
      const current = worlds.get(w.id)!;
      advance(current, 0.1);
      now += 100;
      residents.tick(0.1, now);
      if (i % 20 === 0) await residents.settled();
    }
    const p = worlds.get(w.id)!.players[id];
    assert.equal(p.deaths, 0);
    assert.ok(
      p.thirst < 35000,
      `still stranded: ${JSON.stringify({ thirst: p.thirst, inventory: p.inventory, position: [p.x, p.z] })}`,
    );
    assert.ok(p.inventory.fish < 141);
    assert.equal(p.inventory.pickaxe, 1);
    const errors = residents.memory.recent('mabel', 500).filter((e) => e.kind === 'failure');
    assert.ok(errors.length < 5, JSON.stringify(errors));
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
  } finally {
    residents.close();
    store.close();
  }
});

test('an accepted fishing plan stops when its catch reserve is full instead of retrying reel', () => {
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const { w } = fixture();
  delete w.players.fisher;
  const worlds = new Map([[w.id, w]]);
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'mabel',
        provider: 'jev',
        presence: 'always',
        activeAlone: true,
      }),
      brain: {
        async decide(): Promise<never> {
          throw Error('No model needed');
        },
      },
    },
  ];
  let residents = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  const state = residents.memory.load('mabel')!;
  residents.close();
  const p = w.players[state.playerId];
  Object.assign(p, {
    inventory: { fish: 141, tackle: 1 },
    game: 'fishing',
    fishAt: w.time,
    fishUntil: w.time + 8,
    hunger: 0,
    thirst: 0,
    fuel: 20,
  });
  Object.assign(state, {
    plan: [
      { kind: 'fish', catches: 3 },
      { kind: 'wait', seconds: 60 },
    ],
    index: 0,
    repeats: 1,
    until: Date.now() + 600000,
    nextAt: Date.now() + 600000,
    needsDecision: false,
    waitUntil: 0,
  });
  residents.memory.save('mabel', state);
  residents = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  try {
    for (let i = 0; i < 20; i++) residents.tick(0.1, Date.now() + i * 100);
    assert.notEqual(p.game, 'fishing');
    assert.equal(p.inventory.fish, 141);
    const recent = residents.memory.recent('mabel', 50);
    assert.ok(recent.some((e) => e.kind === 'fishing-load-limit'));
    assert.ok(!recent.some((e) => e.kind === 'failure'));
  } finally {
    residents.close();
    store.close();
  }
});

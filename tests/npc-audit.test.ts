// SPDX-License-Identifier: GPL-3.0-or-later
import { completePuddlewick } from '../src/server/parish-services.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  move,
  distance,
  makeBuilding,
} from '../src/shared/simulation.ts';
import { Navigator, serviceRadius } from '../src/server/npc/navigation.ts';
import { supplyChoices, continueSupply } from '../src/server/npc/survival.ts';
import { perceivedWorld, inspectionChoices } from '../src/server/npc/perception.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { carePlan } from '../src/server/npc/care.ts';
import { failStep } from '../src/server/npc/recovery.ts';
import { suspendPlan, resumePlan, employmentRoutine } from '../src/server/npc/routines.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';
function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  completePuddlewick(w);
  const p = addPlayer(w, 'npc', 'Test');
  const state = {
    world: w.id,
    playerId: p.id,
    intent: '',
    notebook: '',
    plan: [],
    index: 0,
  } as unknown as ResidentState;
  return { w, p, state };
}
test('spaceport approach drives through physics and trades inside the same range as humans', () => {
  const { w, p } = fixture();
  const b = w.buildings.find((b) => b.kind === 'starport')!;
  const nav = new Navigator(w, p, b, serviceRadius);
  let arrived = false;
  for (let i = 0; i < 6000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.error, undefined);
    move(w, p, result.input, 0.05);
    if (result.arrived) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
  assert.ok(distance(p, b) < 18);
  const cash = p.cash;
  act(w, p.id, { type: 'trade', building: b.id, item: 'fuel', quantity: 1, direction: 'buy' });
  assert.equal(p.cash, cash - b.sell.fuel);
});
test('unseen market changes do not change observations or candidates; visits and Mabel do see them', () => {
  const { w, p, state } = fixture();
  const shop = w.buildings.find((b) => b.kind === 'starport')!;
  const first = perceivedWorld(w, p, state);
  const before = JSON.stringify(adaptiveChoices(first, p, state));
  shop.sell.water = 123456;
  shop.stock.water = 499;
  shop.investment = 876543;
  const second = perceivedWorld(w, p, state);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.equal(JSON.stringify(adaptiveChoices(second, p, state)), before);
  assert.ok(inspectionChoices(w, p, state).some((c) => c.id === `inspect_${shop.id}`));
  assert.equal(
    perceivedWorld(w, p, state, true).buildings.find((b) => b.id === shop.id)!.sell.water,
    123456,
  );
  Object.assign(p, { x: shop.x, z: shop.z });
  const visited = perceivedWorld(w, p, state).buildings.find((b) => b.id === shop.id)!;
  assert.equal(visited.sell.water, 123456);
  p.x = 0;
  p.z = 0;
  w.time += 5;
  shop.sell.water = 42;
  assert.equal(
    perceivedWorld(w, p, state).buildings.find((b) => b.id === shop.id)!.sell.water,
    123456,
  );
});
function execute(s: ReturnType<typeof fixture>, plan: Step[]) {
  for (const step of plan) {
    if (step.kind === 'travel') {
      const b = s.w.buildings.find((b) => b.id === step.destination)!;
      // Unit scenario isolates economic rules; separate navigation test uses physics.
      s.p.x = b.x;
      s.p.z = b.z;
    } else if (step.kind === 'act') act(s.w, s.p.id, step.action);
    else if (step.kind === 'wait') advance(s.w, step.seconds);
  }
}
function shortage() {
  const s = fixture(),
    { w, p } = s;
  const pump = w.buildings.find((b) => b.kind === 'waterworks')!;
  assert.ok(pump);
  w.settings.hungerRate = 0;
  w.settings.thirstRate = 2.5;
  p.hunger = 0;
  p.thirst = 30000;
  p.skills = [];
  p.inventory = {};
  p.cash = 50000;
  pump.owner = 'owner';
  pump.stock = { fuel: 0, water: 0 };
  pump.investment = 30000;
  pump.wage = 2200;
  pump.buy.fuel = 2240;
  pump.sell.water = 600;
  const port = w.buildings.find((b) => b.kind === 'starport')!;
  port.stock.fuel = 20;
  port.sell.fuel = 3300;
  for (const b of w.buildings) if (b.id !== port.id) delete b.sell.fuel;
  return { ...s, pump, port };
}
test('loss-making fuel delivery, training and work produce real water that the resident buys and drinks', () => {
  const s = shortage();
  const { w, p, state, pump } = s;
  let trained = false,
    delivered = false,
    worked = false,
    drank = false;
  for (let i = 0; i < 100 && !drank; i++) {
    const c = state.supplyGoal
      ? continueSupply(w, p, state)
      : supplyChoices(w, p, state).find((c) => c.supplyGoal?.building === pump.id);
    assert.ok(c, `missing next stage ${i}`);
    state.supplyGoal ??= c.supplyGoal;
    for (const step of c.plan)
      if (step.kind === 'act') {
        trained ||= step.action.type === 'learn';
        delivered ||= step.action.type === 'trade' && step.action.direction === 'sell';
        worked ||= step.action.type === 'job';
        drank ||= step.action.type === 'use';
      }
    execute(s, c.plan);
  }
  assert.ok(trained && delivered && worked && drank);
  assert.ok(w.ledger.some((e) => e.reason === 'wage' && e.to === p.id));
  assert.ok(pump.stock.water > 0 && pump.stock.water < 12);
  assert.ok(p.thirst < 15000);
  assert.ok(p.history?.some((e) => e.kind === 'trade' && e.item === 'fuel' && e.amount === 3300));
  assert.ok(p.history?.some((e) => e.kind === 'trade' && e.item === 'fuel' && e.amount === 2240));
});
test('survival plans reject unaffordable tuition, bankrupt buyers and impossible health deadlines', () => {
  const { w, p, state, pump } = shortage();
  p.cash = 100;
  assert.equal(supplyChoices(w, p, state).length, 0);
  p.cash = 50000;
  pump.investment = pump.buy.fuel; // no wage cash after buying input
  assert.equal(supplyChoices(w, p, state).length, 0);
  pump.investment = 30000;
  p.thirst = 49999;
  assert.equal(supplyChoices(w, p, state).length, 0);
});
test('care chooses a different known supplier after a failed route', () => {
  const { w, p, state } = fixture();
  p.thirst = 40000;
  p.inventory = {};
  const plan = carePlan(w, p, state);
  const destination = plan.find((s) => s.kind === 'travel');
  assert.ok(destination?.kind === 'travel');
  failStep((state.recovery ??= {}), w.time, destination, 'No safe ground route');
  assert.ok(
    !carePlan(w, p, state).some(
      (s) => s.kind === 'travel' && s.destination === destination.destination,
    ),
  );
});
test('care preserves an accepted plan through persistence and discards it after death', () => {
  const { w, p, state } = fixture();
  state.intent = 'Deliver goods';
  state.plan = [
    { kind: 'wait', seconds: 10 },
    { kind: 'travel', destination: 'b6' },
  ];
  state.index = 1;
  suspendPlan(w, p, state);
  state.plan = [];
  const saved = JSON.parse(JSON.stringify(state)) as ResidentState;
  assert.ok(resumePlan(w, p, saved));
  assert.deepEqual(saved.plan, [{ kind: 'travel', destination: 'b6' }]);
  p.deaths++;
  assert.equal(resumePlan(w, p, state), false);
});
test('local invalid gameplay context makes no transport call and no budget reservation', async () => {
  const store = new Store(':memory:');
  const universe = new Universe(store);
  const { w } = fixture();
  const brain = new JevBrain('test', 'test', async () => {
    throw Error('Transport must not run');
  });
  const prepare = brain.prepare.bind(brain);
  brain.prepare = (request) => prepare({ ...request, instructions: 'oversized '.repeat(10000) });
  const r = new Residents(store, universe, new Map([[w.id, w]]), [
    { config: npcConfigSchema.parse({ id: 'test', provider: 'jev', activeAlone: true }), brain },
  ]);
  try {
    r.tick(0.5, Date.now());
    await r.settled();
    assert.equal(store.db.prepare('SELECT count(*) n FROM npc_calls').get()!.n, 0);
  } finally {
    r.close();
    store.close();
  }
});

test('a two-producer bread chain is repaired through real milling and baking, without personal inventory grants', () => {
  const s = fixture(),
    { w, p, state } = s;
  p.inventory = {};
  p.skills = ['miller', 'baker'];
  p.hunger = 30000;
  p.thirst = 0;
  p.cash = 100000;
  w.settings.thirstRate = 0;
  w.settings.hungerRate = 1;
  const mill = w.buildings.find((b) => b.kind === 'mill')!,
    bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  for (const b of w.buildings) {
    b.stock.bread = 0;
    b.stock.flour = 0;
    delete b.sell.flour;
  }
  mill.sell.flour = 2000;
  mill.stock.wheat = 20;
  mill.investment = 50000;
  mill.owner = 'owner';
  bakery.stock = {};
  bakery.buy.flour = 2200;
  bakery.sell.bread = 3000;
  bakery.investment = 50000;
  bakery.owner = 'owner';
  let drank = false;
  for (let i = 0; i < 160 && !drank; i++) {
    const c = state.supplyGoal
      ? continueSupply(w, p, state)
      : supplyChoices(w, p, state).find((c) => c.supplyGoal?.building === bakery.id);
    assert.ok(c, `No chain stage ${i}`);
    state.supplyGoal ??= c.supplyGoal;
    drank = c.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'use' && s.action.item === 'bread',
    );
    execute(s, c.plan);
  }
  assert.ok(drank);
  assert.ok(p.hunger < 30000);
  assert.ok(w.ledger.some((e) => e.reason === 'wage' && e.from === mill.id));
  assert.ok(w.ledger.some((e) => e.reason === 'wage' && e.from === bakery.id));
});

test('an accepted goal rechecks vanished output and does not consume nonexistent water', () => {
  const s = shortage(),
    { w, p, state, pump } = s;
  const first = supplyChoices(w, p, state).find((c) => c.supplyGoal?.building === pump.id)!;
  state.supplyGoal = first.supplyGoal;
  pump.stock.water = 1;
  const purchase = continueSupply(w, p, state)!;
  assert.ok(purchase.plan.some((s) => s.kind === 'act' && s.action.type === 'use'));
  pump.stock.water = 0;
  pump.investment = 0;
  assert.equal(continueSupply(w, p, state), undefined);
  assert.equal(p.inventory.water, undefined);
});

test('resuming after a meal returns to the shop before the pending purchase without replaying a sale', () => {
  const { w, p, state } = fixture();
  const shop = w.buildings.find((b) => b.kind === 'starport')!;
  state.plan = [
    {
      kind: 'act',
      action: { type: 'trade', building: shop.id, direction: 'sell', item: 'wheat', quantity: 1 },
    },
    {
      kind: 'act',
      action: { type: 'trade', building: shop.id, direction: 'buy', item: 'water', quantity: 1 },
    },
  ];
  state.index = 1;
  suspendPlan(w, p, state);
  p.x = 0;
  p.z = 0;
  assert.ok(resumePlan(w, p, state));
  assert.equal(state.plan[0].kind, 'travel');
  assert.equal(state.plan.filter((s) => s.kind === 'act').length, 1);
  execute({ w, p, state }, state.plan);
  assert.ok(p.inventory.water > 0);
});

test('market inspections never reveal another guest pantry or bank accounts, including to Mabel', () => {
  const { w, p, state } = fixture(),
    shop = w.buildings.find((b) => b.kind === 'starport')!;
  shop.accounts = { secret: 123 } as never;
  shop.lodging = {
    open: true,
    rate: 600,
    guests: {
      other: { until: 99999, stock: { water: 37 } },
      [p.id]: { until: 99999, stock: { water: 3 } },
    },
  };
  p.x = shop.x;
  p.z = shop.z;
  for (const guide of [false, true]) {
    const view = perceivedWorld(w, p, state, guide).buildings.find((b) => b.id === shop.id)!;
    assert.equal(view.accounts, undefined);
    assert.deepEqual(view.lodging!.guests.other.stock, {});
    assert.equal(view.lodging!.guests[p.id].stock.water, 3);
  }
  assert.equal(shop.lodging.guests.other.stock.water, 37);
});

test('asset evaluation treats business investment as a transfer and ignores inflated owner quotes', async () => {
  const { netAssets } = await import('../src/server/npc/wealth.ts');
  const { w, p } = fixture(),
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  const before = netAssets(w, p);
  p.cash -= 10000;
  mill.investment += 10000;
  mill.sell.flour = 99999999;
  assert.equal(netAssets(w, p), before);
  p.cash -= 1000;
  assert.equal(netAssets(w, p), before - 1000);
});

for (const id of ['mabel', 'rowan'])
  test(`${id}: a local shortage plan executes through the real controller without AI credits and survives restart`, async () => {
    const store = new Store(':memory:'),
      universe = new Universe(store),
      s = shortage(),
      { w, pump } = s;
    w.owner = 'human';
    for (const b of w.buildings)
      for (const item of ['water', 'tea', 'beer', 'wine', 'teaBlend', 'roastCoffee', 'milk'])
        b.stock[item] = 0;
    const config = npcConfigSchema.parse({
      id,
      provider: 'jev',
      presence: 'always',
      activeAlone: true,
    });
    let calls = 0;
    const options = [
      {
        config,
        brain: {
          async decide(): Promise<never> {
            calls++;
            throw Error('No model needed');
          },
        },
      },
    ];
    let r = new Residents(store, universe, new Map([[w.id, w]]), options, { dailyUsd: 0 });
    const p = w.players[r.status()[0].playerId];
    Object.assign(p, { cash: 50000, inventory: {}, skills: [], hunger: 0, thirst: 30000 });
    delete w.players[s.p.id];
    const initialThirst = p.thirst;
    let now = Date.now(),
      restarted = false;
    try {
      for (let i = 0; i < 36000 && p.thirst >= initialThirst; i++) {
        advance(w, 0.1);
        now += 100;
        r.tick(0.1, now);
        if (i % 10 === 0) await r.settled();
        if (p.job === pump.id && !restarted) {
          r.close();
          r = new Residents(store, universe, new Map([[w.id, w]]), options, { dailyUsd: 0 });
          restarted = true;
        }
      }
      assert.ok(restarted, 'learned, delivered fuel and took the pump job');
      assert.ok(p.thirst < initialThirst, 'bought and drank actual produced water');
      assert.equal(calls, 0);
      assert.equal(p.deaths, 0);
      assert.ok(w.ledger.some((e) => e.reason === 'wage' && e.to === p.id));
    } finally {
      r.close();
      store.close();
    }
  });

test('public supply intentions discourage duplicate errands but expire and never override urgent care', async () => {
  const { publishSupplyIntent } = await import('../src/server/npc/cooperation.ts');
  const s = shortage(),
    { w, p, state, pump } = s;
  const choice = supplyChoices(w, p, state).find((c) => c.supplyGoal?.building === pump.id)!;
  assert.ok(choice);
  const other = addPlayer(w, 'helper', 'Helper');
  other.online = true;
  publishSupplyIntent(w, other, { ...choice.supplyGoal!, deaths: other.deaths }, true);
  assert.ok(w.supplyIntents?.some((c) => c.name === 'Helper'));
  assert.ok(!supplyChoices(w, p, state).some((c) => c.supplyGoal?.building === pump.id));
  p.thirst = 46000;
  p.skills = ['pump operator'];
  assert.ok(
    supplyChoices(w, p, state).some((c) => c.supplyGoal?.building === pump.id),
    'urgent affordable care may proceed',
  );
  p.thirst = 30000;
  w.time += 601;
  assert.ok(
    supplyChoices(w, p, state).some((c) => c.supplyGoal?.building === pump.id),
    'abandoned intention expires',
  );
});

test('one invalid resident does not starve the other eighteen of their planning turns', async () => {
  const store = new Store(':memory:'),
    universe = new Universe(store),
    { w } = fixture();
  const calls = new Set<number>();
  const options = Array.from({ length: 19 }, (_, i) => ({
    config: npcConfigSchema.parse({
      id: `resident${i}`,
      name: `Resident ${i}`,
      presence: 'always',
      activeAlone: true,
    }),
    brain: {
      prepare(request: import('../src/server/npc/decision.ts').BrainRequest) {
        if (!i) throw Error('Invalid local request');
        return request;
      },
      async decide(): Promise<import('../src/server/npc/decision.ts').BrainResult> {
        calls.add(i);
        return {
          decision: {
            intent: 'Rest',
            notebook: '',
            speech: null,
            plan: [{ kind: 'wait', seconds: 60 }],
            repeat: 1,
            reconsiderSeconds: 300,
          },
          inputTokens: 1,
          outputTokens: 1,
        };
      },
    },
    rates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
  }));
  const r = new Residents(store, universe, new Map([[w.id, w]]), options);
  try {
    let now = Date.now();
    for (let i = 0; i < 25; i++) {
      r.tick(0.5, (now += 500));
      await r.settled();
    }
    assert.equal(calls.size, 18);
    assert.ok(!calls.has(0));
    assert.equal(
      store.db.prepare('SELECT count(*) n FROM npc_calls WHERE resident=?').get('resident0')!.n,
      0,
    );
  } finally {
    r.close();
    store.close();
  }
});

test('nineteen stocked households survive twelve game days, offline schedules and a controller restart without model calls', async () => {
  let now = Date.parse('2026-10-04T12:00:00Z'),
    calls = 0;
  const store = new Store(':memory:'),
    universe = new Universe(store),
    { w } = fixture(),
    worlds = new Map([[w.id, w]]);
  const options = Array.from({ length: 19 }, (_, i) => ({
    config: npcConfigSchema.parse({
      id: i ? 'resident' + i : 'mabel',
      name: 'Resident ' + i,
      presence: i ? 'scheduled' : 'always',
      activeAlone: true,
    }),
    brain: {
      async decide(): Promise<never> {
        calls++;
        throw Error('No model needed');
      },
    },
  }));
  let r = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  r.close();
  const residents = options.map((o, i) => {
    const s = r.memory.load(o.config.id)!;
    const p = w.players[s.playerId] ?? addPlayer(w, s.playerId, s.name);
    p.npc = true;
    // Starter pocket rations are eaten during logout preparation and would hide pantry use.
    delete p.inventory.bread;
    delete p.inventory.water;
    const home = makeBuilding(`house${i}`, 'home', -160 + i * 16, -160);
    home.owner = p.id;
    home.stock = { water: 100, bread: 100 };
    w.buildings.push(home);
    Object.assign(p, {
      home: home.id,
      atHome: true,
      x: home.x,
      z: home.z,
      hunger: 20000,
      thirst: 20000,
    });
    if (i)
      s.presence = {
        phase: 'playing',
        sessions: 1,
        nextAt: now,
        startedAt: now,
        endsAt: now + 600000,
        nextRegularAt: now + 86400000,
        preparationUntil: now + 1200000,
      };
    r.memory.save(o.config.id, s);
    return { p, home };
  });
  r = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  try {
    for (let i = 0; i < 720; i++) {
      advance(w, 10);
      now += 10000;
      r.tick(10, now);
      if (i % 5 === 0) await r.settled();
      // Public shelves empty halfway through; stocked homes do not depend on them.
      if (i === 359) {
        for (const b of w.buildings) if (b.kind !== 'home') b.stock = {};
        r.close();
        r = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
      }
    }
    for (const { p, home } of residents) {
      assert.equal(p.deaths, 0, p.name);
      assert.ok((home.stock.water ?? 0) < 100, p.name + ' used stored water');
      assert.ok(p.hunger < 30000 && p.thirst < 30000, p.name);
    }
    assert.equal(residents[0].p.online, true);
    assert.ok(residents.slice(1).every(({ p }) => !p.online));
    assert.equal(calls, 0);
  } finally {
    r.close();
    store.close();
  }
});

test('an understocked household logs off at home and returns before starvation', async () => {
  let now = Date.parse('2026-10-04T12:00:00Z');
  const store = new Store(':memory:'),
    universe = new Universe(store),
    { w } = fixture(),
    worlds = new Map([[w.id, w]]);
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'resident1',
        name: 'Resident 1',
        presence: 'scheduled',
        activeAlone: true,
      }),
      brain: {
        async decide(): Promise<never> {
          throw Error('No model needed');
        },
      },
    },
  ];
  let r = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  r.close();
  const s = r.memory.load('resident1')!;
  const p = w.players[s.playerId] ?? addPlayer(w, s.playerId, s.name);
  p.npc = true;
  p.cash = 0;
  p.inventory = {};
  const home = makeBuilding('house', 'home', -160, -160);
  home.owner = p.id;
  home.stock = { water: 1, bread: 1 };
  w.buildings.push(home);
  Object.assign(p, {
    home: home.id,
    atHome: true,
    x: home.x,
    z: home.z,
    hunger: 20000,
    thirst: 20000,
  });
  s.presence = {
    phase: 'playing',
    sessions: 1,
    nextAt: now,
    startedAt: now,
    endsAt: now + 600000,
    nextRegularAt: now + 86400000,
    preparationUntil: now + 1200000,
  };
  r.memory.save('resident1', s);
  r = new Residents(store, universe, worlds, options, { dailyUsd: 0 });
  let shelteredDeparture = false,
    returned = false;
  try {
    for (let i = 0; i < 500 && !p.deaths; i++) {
      advance(w, 10);
      now += 10000;
      r.tick(10, now);
      if (i % 5 === 0) await r.settled();
      const phase = r.memory.load('resident1')?.presence?.phase;
      if (phase === 'offline' && p.atHome) shelteredDeparture = true;
      if (shelteredDeparture && p.online) returned = true;
    }
    assert.equal(p.deaths, 0);
    assert.equal(shelteredDeparture, true);
    assert.equal(returned, true);
    assert.ok(p.thirst < 50000 && p.hunger < 50000);
  } finally {
    r.close();
    store.close();
  }
});

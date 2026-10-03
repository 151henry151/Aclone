import { refreshOrders } from '../src/shared/procurement.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adaptiveChoices, parishSurvey } from '../src/server/npc/adaptive.ts';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation.ts';
import { stepSchema, type Step } from '../src/server/npc/decision.ts';
import { operation, operationAction } from '../src/server/npc/player-operations.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { spaceChoices, spaceAction, exchange } from '../src/server/npc/space.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner'),
    p = addPlayer(w, 'resident', 'Resident');
  const state: ResidentState = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Practical and inquisitive',
    notebook: '',
    intent: 'Build a long life and savings',
    cursor: 0,
    nextAt: 0,
    plan: [],
    index: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: '',
    errors: 0,
  };
  const choices = () => adaptiveChoices(w, p, state);
  const run = (plan: Step[]) => {
    for (const s of plan) {
      stepSchema.parse(s);
      if (s.kind === 'travel') {
        const b = w.buildings.find((b) => b.id === s.destination)!;
        p.x = b.x;
        p.z = b.z;
      } else if (s.kind === 'move') {
        p.x = s.x;
        p.z = s.z;
      } else if (s.kind === 'act') act(w, p.id, s.action);
      else if (s.kind === 'operation') act(w, p.id, operationAction(s));
    }
  };
  return { w, p, state, choices, run };
}
test('common adaptive planner offers every career, living choices, leisure and measured trade without mutating the parish', () => {
  const { w, p, choices } = fixture();
  p.cash = 200000;
  const before = JSON.stringify(w);
  const start = performance.now();
  const list = choices();
  assert.equal(JSON.stringify(w), before);
  assert.ok(list.length <= 200);
  assert.ok(Buffer.byteLength(JSON.stringify(list)) < 50000);
  for (const skill of ['baker', 'farmer', 'miller', 'innkeeper', 'forester', 'excavator'])
    assert.ok(
      list.some((c) =>
        c.plan.some(
          (s) => s.kind === 'act' && s.action.type === 'learn' && s.action.skill === skill,
        ),
      ),
      skill,
    );
  assert.ok(list.some((c) => c.description.startsWith('Trade route:')));
  assert.ok(list.some((c) => c.description.startsWith('Paint my tractor')));
  assert.ok(list.some((c) => c.plan.some((s) => s.kind === 'fish')));
  list.forEach((c) => c.plan.forEach((s) => stepSchema.parse(s)));
  assert.ok(performance.now() - start < 2000, 'Bounded planning work must not take seconds');
});
test('trade plans produce the quoted real cash margin and a receipt, without manufacturing goods', () => {
  const { w, p, choices, run } = fixture();
  p.cash = 200000;
  const c = choices().find((c) => c.description.startsWith('Trade route:'))!;
  assert.ok(c);
  const prior = p.cash,
    inventory = structuredClone(p.inventory);
  run(c.plan);
  const actions = c.plan
    .filter((s) => s.kind === 'act' && s.action.type === 'trade')
    .map((s) => (s as Extract<Step, { kind: 'act' }>).action as any);
  const buy = actions[0],
    sell = actions[1];
  const a = w.buildings.find((b) => b.id === buy.building)!,
    b = w.buildings.find((b) => b.id === sell.building)!;
  assert.equal(p.cash - prior, buy.quantity * (b.buy[buy.item] - a.sell[buy.item]));
  assert.equal(p.inventory[buy.item] ?? 0, inventory[buy.item] ?? 0);
  assert.ok(parishSurvey(w, p).actualReceipts.some((r) => r.reason === 'sale'));
});
test('housing plans charge for a room, store only the guest pantry and allow home feeding', () => {
  const { w, p, choices, run } = fixture();
  p.cash = 200000;
  const b = makeBuilding('inn', 'bnb', 0, 17);
  w.buildings.push(b);
  b.stock = {};
  b.owner = 'innkeeper';
  b.lodging = { open: true, rate: 600, guests: {} };
  run(
    choices().find(
      (c) => c.description.startsWith('Rent one real hour') && c.description.includes(b.name),
    )!.plan,
  );
  assert.equal(b.lodging.guests[p.id].until, w.time + 3600);
  run(
    choices().find((c) => c.description.startsWith('deposit') && c.description.includes('bread'))!
      .plan,
  );
  assert.ok(b.lodging.guests[p.id].stock.bread > 0);
  assert.equal(b.stock.bread ?? 0, 0);
  run(choices().find((c) => c.description.startsWith('Rest in my booked room'))!.plan);
  p.hunger = 29999;
  advance(w, 30);
  assert.ok(p.hunger < 29999);
});
test('construction plans leave a paid unfinished site; later deliveries complete it normally', () => {
  const { w, p, choices, run } = fixture();
  p.cash = 1000000;
  const c = choices().find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'operation' &&
        s.operation === 'construct' &&
        s.parameters.some((p) => p.name === 'kind' && p.value === 'home'),
    ),
  )!;
  assert.ok(c);
  run(c.plan);
  const b = w.buildings.find((b) => b.owner === p.id && b.construction)!;
  assert.ok(b);
  assert.ok(p.cash < 1000000);
  p.inventory = { ...b.construction };
  run(choices().find((c) => c.description.startsWith('Supply materials'))!.plan);
  assert.equal(b.construction, undefined);
});
test('parish survey reports unavailable wages rather than concealing missing supplies', () => {
  const { w, p } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.stock = {};
  mill.investment = 0;
  p.skills = ['miller'];
  const row = parishSurvey(w, p).jobs.find((j) => j.id === mill.id)!;
  assert.ok(row.blockers?.length);
  assert.equal(row.qualified, true);
});
test('operation allowlist rejects administrative commands and duplicate parameters', () => {
  assert.throws(() =>
    stepSchema.parse({ kind: 'operation', operation: 'command', parameters: [] }),
  );
  assert.throws(
    () =>
      operationAction({
        kind: 'operation',
        operation: 'give',
        parameters: [
          { name: 'amount', value: 1 },
          { name: 'amount', value: 2 },
        ],
      }),
    /Duplicate/,
  );
});
test('galactic plans pay normal costs, retain cargo, and nested savepoints roll back with the resident checkpoint', () => {
  const store = new Store(':memory:'),
    u = new Universe(store);
  try {
    const { account: a } = u.register('Elias Test');
    const w = createWorld('puddlewick', 'Town', 'owner'),
      p = addPlayer(w, a.id, a.name),
      worlds = new Map([[w.id, w]]);
    let c = spaceChoices(a, worlds, u).find((c) =>
      c.plan.some((s) => s.kind === 'operation' && s.operation === 'survey'),
    )!;
    spaceAction(u, a, operationAction(c.plan[0] as any));
    assert.equal(a.credits, 65);
    assert.throws(() =>
      store.transaction(() => {
        u.upgrade(a, 'hold');
        throw Error('checkpoint failure');
      }),
    );
    const persisted = JSON.parse(
      String(store.db.prepare('SELECT state FROM accounts WHERE id=?').get(a.id)!.state),
    );
    assert.equal(persisted.credits, 65);
    assert.equal(persisted.upgrades, undefined);
    const port = w.buildings.find((b) => b.kind === 'starport')!;
    p.x = port.x;
    p.z = port.z;
    const cash = p.cash;
    exchange(w, p, persisted, 1);
    assert.equal(p.cash, cash - w.settings.exchangeRate * 100);
    assert.equal(persisted.credits, 66);
  } finally {
    store.close();
  }
});
test('resident fishing controller reels locally and real fish can be eaten without another AI call', async () => {
  const store = new Store(':memory:'),
    u = new Universe(store),
    w = createWorld('puddlewick', 'Town', 'owner'),
    worlds = new Map([[w.id, w]]);
  let calls = 0;
  const r = new Residents(store, u, worlds, [
    {
      config: npcConfigSchema.parse({ provider: 'jev', activeAlone: true }),
      brain: {
        async decide() {
          calls++;
          return {
            decision: {
              intent: 'Fish for supper',
              notebook: '',
              speech: null,
              plan: [
                { kind: 'fish', catches: 1 },
                operation('leaveGame'),
                { kind: 'act', action: { type: 'use', item: 'fish' } },
              ],
              repeat: 1,
              reconsiderSeconds: 600,
            },
            inputTokens: 10,
            outputTokens: 0,
          };
        },
      },
    },
  ]);
  try {
    const p = w.players[r.status()[0].playerId];
    p.hunger = 20000;
    let now = Date.now();
    r.tick(0.5, now);
    await r.settled();
    r.tick(0.5, (now += 1000));
    assert.equal(p.game, 'fishing');
    w.time = p.fishAt!;
    r.tick(0.5, (now += 1000));
    assert.equal(p.inventory.fish, 1);
    r.tick(0.5, (now += 1000));
    r.tick(0.5, (now += 1000));
    assert.equal(p.inventory.fish, 0);
    assert.ok(p.hunger < 20000);
    assert.equal(calls, 1);
  } finally {
    r.close();
    store.close();
  }
});
test('resident takeoff, landing and restart preserve identity, local property and durable location', async () => {
  const store = new Store(':memory:'),
    u = new Universe(store),
    w = createWorld('puddlewick', 'Town', 'owner'),
    worlds = new Map([[w.id, w]]);
  const config = npcConfigSchema.parse({ provider: 'jev', activeAlone: true });
  const brain = {
    async decide() {
      return {
        decision: {
          intent: 'Visit orbit and return',
          notebook: 'Remember home',
          speech: null,
          plan: [operation('takeoff'), operation('survey'), operation('land', { world: w.id })],
          repeat: 1,
          reconsiderSeconds: 600,
        },
        inputTokens: 10,
        outputTokens: 0,
      };
    },
  };
  let r = new Residents(store, u, worlds, [{ config, brain }]);
  try {
    const id = r.status()[0].playerId,
      p = w.players[id],
      port = w.buildings.find((b) => b.kind === 'starport')!;
    p.x = port.x;
    p.z = port.z;
    const cash = p.cash;
    let now = Date.now();
    r.tick(0.5, now);
    await r.settled();
    r.tick(0.5, (now += 1000));
    assert.equal(p.online, false);
    assert.equal(r.memory.load('mabel')!.inSpace, true);
    r.close();
    r = new Residents(store, u, worlds, [{ config, brain }]);
    assert.equal(r.status()[0].playerId, id);
    r.tick(0.5, (now += 1000));
    r.tick(0.5, (now += 1000));
    assert.equal(r.memory.load('mabel')!.inSpace, false);
    assert.equal(p.online, true);
    assert.equal(p.cash, cash);
    assert.equal(
      JSON.parse(String(store.db.prepare('SELECT state FROM accounts WHERE id=?').get(id)!.state))
        .credits,
      65,
    );
  } finally {
    r.close();
    store.close();
  }
});

test('a resident visiting a different template can restart without resetting their configured home or identity', () => {
  const store = new Store(':memory:'),
    u = new Universe(store),
    home = createWorld('puddlewick', 'Home', 'owner'),
    away = createWorld('playground', 'Playground', 'owner', 'creative'),
    worlds = new Map([
      [home.id, home],
      [away.id, away],
    ]);
  const config = npcConfigSchema.parse({ provider: 'jev', activeAlone: true });
  const brain = {
    async decide() {
      throw Error('no calls required');
    },
  };
  let r = new Residents(store, u, worlds, [{ config, brain }]);
  try {
    const saved = r.memory.load('mabel')!,
      id = saved.playerId;
    r.close();
    saved.world = away.id;
    saved.originWorld = home.id;
    r.memory.save('mabel', saved);
    r = new Residents(store, u, worlds, [{ config, brain }]);
    assert.equal(r.status()[0].playerId, id);
    assert.equal(r.status()[0].world, away.id);
    assert.equal(r.memory.load('mabel')!.originWorld, home.id);
  } finally {
    r.close();
    store.close();
  }
});

test('parish supply plans buy from a local supplier and return to the collection point', () => {
  const { w, p, choices, run } = fixture();
  w.settings.parishOrders = true;
  refreshOrders(w);
  const order = w.procurement!.orders.find((o) => o.item === 'wood')!;
  const source = w.buildings.find((b) => b.kind === 'sawmill')!;
  source.stock.wood = 20;
  source.sell.wood = 500;
  const harbour = w.buildings.find((b) => b.id === w.procurement!.building)!;
  p.x = harbour.x;
  p.z = harbour.z;
  const choice = choices().find((c) => c.description.startsWith('Supply Replace public benches'));
  assert.ok(
    choice,
    'a funded profitable local delivery is available even when starting at Harbour',
  );
  const before = p.cash;
  run(choice.plan);
  assert.ok(order.delivered > 0);
  assert.equal(p.cash - before, (order.unitPrice - 500) * order.delivered);
  assert.equal(p.x, harbour.x);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation.ts';
import {
  ownerRoutine,
  ownerBidRoutine,
  inputStockTarget,
  productionBudget,
} from '../src/server/npc/business-policy.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
import { inventHypotheses } from '../src/server/npc/hypotheses.ts';
import { inventChainPlans } from '../src/server/npc/chains.ts';
import { startCareer, continueCareer } from '../src/server/npc/projects.ts';
import { employmentRoutine } from '../src/server/npc/routines.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';
function fixture() {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1000000;
  p.inventory = { bread: 10, water: 20 };
  const state = { world: w.id, playerId: p.id, plan: [], index: 0 } as unknown as ResidentState;
  return { w, p, state };
}
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
  for (const s of plan) {
    if (s.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === s.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (s.kind === 'act') act(w, p.id, s.action);
    else if (s.kind === 'operation') act(w, p.id, operationAction(s));
  }
}
test('an overstocked owner pauses paid input bids before another cash deposit and reopens after sales/consumption', () => {
  const { w, p, state } = fixture(),
    b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = p.id;
  b.stock = { flour: 388, bread: 416 };
  b.buy.flour = 2100;
  b.investment = 0;
  assert.equal(inputStockTarget(b, 'flour'), 0);
  const before = p.cash;
  const plan = ownerRoutine(w, p, state);
  assert.ok(plan.some((s) => s.kind === 'operation'));
  run(w, p, plan);
  assert.equal(b.buy.flour, 0);
  assert.equal(p.cash, before);
  const persisted = JSON.parse(JSON.stringify(state));
  assert.deepEqual(ownerBidRoutine(w, p, persisted), []);
  // Other candidate builders cannot undo the suspension while goods are backed up.
  const options = [
    ...enterpriseChoices(w, p),
    ...inventHypotheses(w, p, persisted),
    ...inventChainPlans(w, p, persisted),
  ];
  assert.ok(
    !options.some((c) =>
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'buildingAdmin' &&
          s.parameters.some((v) => v.name === 'side' && v.value === 'buy'),
      ),
    ),
  );
  b.stock = { flour: 1, bread: 0 };
  run(w, p, ownerBidRoutine(w, p, persisted));
  assert.equal(b.buy.flour, 2100);
  assert.ok(productionBudget(w, b)!.reserve > 0);
});
test("stock policy does not halt livestock upkeep or alter another owner's prices", () => {
  const { w, p, state } = fixture(),
    b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = 'human';
  b.stock.flour = 499;
  b.stock.bread = 499;
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  const herd = makeBuilding('herd', 'dairy', 0, 0);
  assert.equal(inputStockTarget(herd, 'water'), undefined);
});
test('current payroll blocks fresh top-ups even when the hypothetical ideal crew is profitable', () => {
  const { w, p, state } = fixture(),
    b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = p.id;
  b.investment = 0;
  b.stock = { flour: 0, bread: 0 };
  b.buy.flour = 1000;
  b.sell.bread = 2400;
  b.wage = 2000;
  w.settings.activeWork = false;
  for (let i = 0; i < 4; i++) {
    const worker = addPlayer(w, 'worker' + i, 'Worker');
    worker.job = b.id;
    b.employees.push(worker.id);
  }
  const budget = productionBudget(w, b)!;
  assert.ok(budget.idealMargin >= 0);
  assert.ok(budget.margin < 0);
  assert.deepEqual(ownerRoutine(w, p), []);
  assert.ok(!enterpriseChoices(w, p).some((c) => c.description.startsWith('Fund my')));
  assert.ok(!inventHypotheses(w, p, state).some((c) => c.idea === 'fund shop'));
});
test('cash-poor residents release completed housing goals to earn, and career reviews really expire', () => {
  const { w, p, state } = fixture(),
    home = makeBuilding('home', 'home', 0, 0);
  home.owner = p.id;
  home.stock = {};
  w.buildings.push(home);
  p.home = home.id;
  p.cash = 0;
  p.bank = 0;
  p.inventory = {};
  startCareer(w, p, state, { kind: 'housing', target: home.id });
  continueCareer(w, p, state);
  assert.equal(state.career, undefined);
  assert.match(state.projectHistory!.at(-1)!.reason, /earn living/);
  startCareer(w, p, state, { kind: 'gather', target: 'stone-1', item: 'stone' });
  w.time = state.career!.reviewAt;
  continueCareer(w, p, state);
  assert.equal(state.career, undefined);
  assert.match(state.projectHistory!.at(-1)!.reason, /scheduled career review/);
});
test('a surplus worker switches only to a funded qualified vacancy without forcing unemployment', () => {
  const { w, p, state } = fixture(),
    bakery = w.buildings.find((b) => b.kind === 'bakery')!,
    mill = w.buildings.find((b) => b.kind === 'mill')!;
  w.settings.activeWork = false;
  p.skills = ['baker', 'miller'];
  p.job = bakery.id;
  for (let i = 0; i < 2; i++) {
    const q = addPlayer(w, 'first' + i, 'First');
    q.job = bakery.id;
    bakery.employees.push(q.id);
  }
  bakery.employees.push(p.id);
  mill.investment = 100000;
  mill.stock.wheat = 50;
  mill.stock.flour = 0;
  const plan = employmentRoutine(w, p, state);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'job' && s.action.building === mill.id),
  );
  run(w, p, plan);
  assert.equal(p.job, mill.id);
  assert.ok(!bakery.employees.includes(p.id));
});

test('owner purchasing maintenance executes through the controller without AI credit', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Puddlewick', 'server');
  let calls = 0;
  const residents = new Residents(
    store,
    new Universe(store),
    new Map([[w.id, w]]),
    [
      {
        config: npcConfigSchema.parse({ id: 'mabel', provider: 'jev', presence: 'always' }),
        brain: {
          async decide() {
            calls++;
            throw Error('No budget for transport');
          },
        },
      },
    ],
    { dailyUsd: 0, monthlyUsd: 0 },
  );
  try {
    const p = w.players[residents.status()[0].playerId],
      b = w.buildings.find((b) => b.kind === 'bakery')!;
    p.hunger = p.thirst = 0;
    p.inventory = { bread: 10, water: 20 };
    p.vehicle = 0;
    p.engine = true;
    p.fuel = 80;
    b.owner = p.id;
    b.stock = { flour: 388, bread: 416 };
    b.buy.flour = 2100;
    b.investment = 0;
    p.x = b.x;
    p.z = b.z + 9;
    const before = p.cash,
      now = Date.now();
    for (let i = 0; i < 6; i++) {
      residents.tick(0.5, now + i * 1000);
      await residents.settled();
    }
    assert.equal(b.buy.flour, 0);
    assert.equal(p.cash, before);
    assert.equal(calls, 0);
    assert.ok(store.db.prepare("SELECT 1 FROM npc_journal WHERE kind='owner-purchasing'").get());
  } finally {
    residents.close();
    store.close();
  }
});

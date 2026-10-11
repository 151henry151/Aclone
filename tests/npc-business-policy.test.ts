// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { productionBudget, usefulShift, ownerRoutine } from '../src/server/npc/business-policy.ts';

test('extra workers cannot increase fixed batch output and should find other work', () => {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'one', 'One'),
    q = addPlayer(w, 'two', 'Two');
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.investment = 100000;
  b.buy.flour = 2100;
  b.sell.bread = 4800;
  b.wage = 2200;
  q.job = b.id;
  q.activeUntil = w.time + 1200;
  b.employees = [q.id];
  assert.equal(usefulShift(w, p, b), false);
  assert.equal(usefulShift(w, q, b), true);
  const estimate = productionBudget(w, b);
  assert.ok(estimate && estimate.retailReceipts < 3 * 4800);
});
test('an owner with a dry till reinvests surplus personal cash', () => {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = p.id;
  b.investment = 0;
  p.cash = 100000;
  p.inventory = { bread: 10, water: 20 };
  const plan = ownerRoutine(w, p);
  assert.ok(
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'investment' && s.action.direction === 'deposit',
    ),
  );
  for (const s of plan) {
    if (s.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === s.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (s.kind === 'act') act(w, p.id, s.action);
  }
  assert.ok(b.investment > 0);
});

test('owner top-ups protect meals even when hungry and never fund structurally losing batches', () => {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  b.owner = p.id;
  b.investment = 0;
  p.cash = 100;
  p.inventory = {};
  p.hunger = p.thirst = 40000;
  assert.deepEqual(ownerRoutine(w, p), []);
  p.cash = 100000;
  b.sell.bread = 1;
  assert.deepEqual(ownerRoutine(w, p), []);
});

test('full work cargo is unloaded to make room for water without selling tools or meals', async () => {
  const { cargoRelief } = await import('../src/server/npc/business-policy.ts');
  const { canCarry } = await import('../src/shared/simulation.ts');
  const { carePlan } = await import('../src/server/npc/care.ts');
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'worker', 'Worker');
  p.inventory = { tools: 1, logs: 49, bread: 1 };
  p.thirst = 45000;
  p.cash = 10000;
  const b = w.buildings.find((b) => b.kind === 'sawmill')!;
  b.buy.logs = 1000;
  b.stock.logs = 0;
  b.investment = 100000;
  assert.equal(canCarry(p, 'water', 1, w), false);
  assert.equal(carePlan(w, p).length, 0);
  const plan = cargoRelief(w, p);
  assert.ok(plan.length);
  for (const s of plan) {
    if (s.kind === 'travel') {
      const target = w.buildings.find((b) => b.id === s.destination)!;
      p.x = target.x;
      p.z = target.z;
    } else if (s.kind === 'act') act(w, p.id, s.action);
  }
  assert.equal(canCarry(p, 'water', 1, w), true);
  assert.equal(p.inventory.tools, 1);
  assert.equal(p.inventory.bread, 1);
  assert.ok(carePlan(w, p).some((s) => s.kind === 'act' && s.action.type === 'use'));
});

test('a worker can deliver held input with a full load, without buying it twice', async () => {
  const { employmentRoutine } = await import('../src/server/npc/routines.ts');
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'worker', 'Worker');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.inventory = { wheat: 150 };
  p.job = b.id;
  p.skills = ['miller'];
  b.employees = [p.id];
  b.stock.wheat = 0;
  b.investment = 100000;
  const plan = employmentRoutine(w, p, { plan: [], index: 0 } as never);
  assert.ok(
    plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'sell',
    ),
  );
  assert.ok(
    !plan.some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.direction === 'buy',
    ),
  );
});

test('a cash-poor farm owner can save for meals and a cottage without stripping seed capital or stakes', async () => {
  const { retainedCapital, ownerLivingDraw } = await import('../src/server/npc/business-policy.ts');
  const { remainingClaim } = await import('../src/shared/stakes.ts');
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  b.owner = p.id;
  b.investment = 136264;
  b.stakes = [{ investor: 'neighbour', principal: 10000, claim: 10800, paid: 0, opened: w.time }];
  p.cash = 3856;
  p.inventory = { bread: 3, water: 6 };
  const before = p.cash + b.investment;
  const amount = ownerLivingDraw(w, p, b);
  assert.ok(amount > 0);
  const plan = ownerRoutine(w, p);
  for (const s of plan)
    if (s.kind === 'travel') {
      p.x = b.x;
      p.z = b.z;
    } else if (s.kind === 'act') act(w, p.id, s.action);
  assert.ok(p.cash > 3856);
  assert.equal(p.cash + b.investment, before, 'household draw is a transfer, not new income');
  assert.ok(b.investment >= retainedCapital(w, b) + remainingClaim(b));
  b.investment = retainedCapital(w, b) + remainingClaim(b);
  assert.equal(ownerLivingDraw(w, p, b), 0, 'never withdraw seed/wage reserves or investor claims');
});

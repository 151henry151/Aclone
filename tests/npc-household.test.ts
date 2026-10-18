// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance } from '../src/shared/simulation.ts';
import { offlineReadiness, homecomingPlan } from '../src/server/npc/homecoming.ts';
import { affordableLoad, livingReserve } from '../src/server/npc/travel.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
import { startCareer, continueCareer } from '../src/server/npc/projects.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

function fixture() {
  const w = createWorld('household', 'Household', 'owner');
  const p = addPlayer(w, 'resident', 'Resident');
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  p.home = home.id;
  p.atHome = true;
  p.hunger = p.thirst = 20000;
  home.stock = { bread: 2, water: 2 };
  return { w, p, home };
}
test('pantry forecasts use the same full nutritional value as actual home feeding', () => {
  const { w, p, home } = fixture();
  const expected = Math.min(
    (10000 + 32000) / (w.settings.hungerRate * 0.8),
    (10000 + 40000) / (w.settings.thirstRate * 0.8),
  );
  assert.equal(offlineReadiness(w, p, 1000).coveredSeconds, expected);
  assert.deepEqual(homecomingPlan(w, p, 1000), []);
  advance(w, expected - 1);
  assert.ok(p.health >= 59000);
  assert.ok(p.hunger < 50000 && p.thirst < 50000);
});
test('optional trading never overrides the living reserve for one more item', () => {
  assert.equal(affordableLoad(5000, 4000, 3000, 10), 0);
  const { w, p } = fixture();
  p.atHome = false;
  p.home = undefined;
  w.buildings = w.buildings.filter((b) => b.owner !== p.id);
  p.inventory = {};
  p.hunger = 40000;
  assert.ok(livingReserve(w, p) > 0, 'danger increases rather than removes protection');
});

test('optional spending reserves a fuel purchase, but refuelling can spend that reserved amount', async () => {
  const { householdBudget } = await import('../src/server/npc/household.ts');
  const { drivePlan } = await import('../src/server/npc/travel.ts');
  const { w, p, home } = fixture();
  home.stock = { bread: 50, water: 50 };
  p.inventory = {};
  p.fuel = 0;
  const budget = householdBudget(w, p);
  assert.equal(budget.food + budget.drink, 0);
  assert.ok(budget.fuel > 0);
  p.cash = budget.fuel;
  assert.equal(affordableLoad(p.cash, 100, budget.reserve, 8), 0);
  assert.ok(
    drivePlan(w, p).some(
      (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'fuel',
    ),
  );
  p.inventory.fuel = 1;
  assert.equal(householdBudget(w, p).fuel, 0);
});

test('a stocked home completes its project outside and never offers the enter/exit loop', () => {
  const { w, p, home } = fixture();
  p.atHome = false;
  p.hunger = p.thirst = 0;
  home.stock = { bread: 100, water: 100 };
  const state = { plan: [], index: 0 } as unknown as ResidentState;
  startCareer(w, p, state, { kind: 'housing', target: home.id });
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(homecomingPlan(w, p, 86400, undefined, false), []);
    assert.ok(!enterpriseChoices(w, p).some((c) => c.id === `household_${home.id}`));
    assert.equal(continueCareer(w, p, state, enterpriseChoices(w, p)), undefined);
    w.time += 60;
  }
  assert.equal(state.career, undefined);
  assert.ok(
    homecomingPlan(w, p, 86400).some((s) => s.kind === 'act' && s.action.type === 'home'),
    'actual logout still enters the house',
  );
});

test('a cash-poor producer can provision a pantry from their own output without buying from themselves', () => {
  const { w, p, home } = fixture();
  p.cash = 0;
  p.atHome = false;
  p.hunger = p.thirst = 0;
  p.inventory = {};
  home.stock = { bread: 100 };
  const producer = w.buildings.find((b) => b.kind === 'mill')!;
  producer.owner = p.id;
  producer.stock = { water: 100 };
  const plan = homecomingPlan(w, p, 86400, undefined, false);
  assert.ok(
    plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'stock' &&
        s.action.building === producer.id &&
        s.action.item === 'water' &&
        s.action.direction === 'withdraw',
    ),
  );
  assert.ok(!plan.some((s) => s.kind === 'act' && s.action.type === 'home'));
});

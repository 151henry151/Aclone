// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation.ts';
import { travelPrep, livingReserve, affordableLoad } from '../src/server/npc/travel.ts';
import { inventHypotheses, rankIdeas } from '../src/server/npc/hypotheses.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('ideas', 'Ideas', 'owner');
  const p = addPlayer(w, 'trader', 'Ada');
  p.npc = true;
  const state = {
    playerId: p.id,
    world: w.id,
    name: p.name,
    personality: 'Curious',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    experiences: [],
  } as unknown as ResidentState;
  return { w, p, state };
}

test('walking residents with fuel remount instead of staying on foot', () => {
  const { p } = fixture();
  p.vehicle = 5;
  p.fuel = 16;
  p.engine = true;
  const prep = travelPrep(p);
  assert.ok(
    prep.some((s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 0),
  );
  assert.ok(
    !prep.some((s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 5),
  );
});

test('a modest purse can still buy one unit of a cheap trade', () => {
  const { w, p } = fixture();
  p.cash = 3000;
  p.hunger = 0;
  p.thirst = 0;
  const reserve = livingReserve(w, p);
  assert.ok(reserve < 3000);
  assert.equal(affordableLoad(3000, 2000, reserve, 8), 1);
  assert.equal(affordableLoad(1500, 2000, reserve, 8), 0);
});

test('invented ideas include a live mill-to-bakery flour loop and an expired shift', () => {
  const { w, p, state } = fixture();
  p.cash = 3500;
  p.skills = ['miller'];
  p.vehicle = 5;
  p.fuel = 10;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  mill.stock.flour = 10;
  mill.sell.flour = 2000;
  mill.investment = 60;
  bakery.buy.flour = 2100;
  bakery.investment = 50000;
  bakery.stock.flour = 0;
  mill.employees = [p.id];
  p.job = mill.id;
  p.activeUntil = 0;
  w.settings.activeWork = true;

  const ideas = inventHypotheses(w, p, state);
  const trade = ideas.find(
    (c) =>
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'flour' && s.action.direction === 'buy',
      ) &&
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'flour' && s.action.direction === 'sell',
      ),
  );
  assert.ok(trade, 'a broke-looking trader can still try one bag of flour');
  assert.ok((trade.expectedCash ?? 0) > 0);
  assert.ok(
    ideas.some((c) =>
      c.plan.some((s) => s.kind === 'act' && s.action.type === 'work' && s.action.building === mill.id),
    ),
    'expired shift is an idea',
  );
  assert.ok(
    ideas.some((c) =>
      c.plan.some((s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === 0),
    ),
    'remounting is an idea',
  );
});

test('a baker with till money but empty pockets can still restock flour', () => {
  const { w, p, state } = fixture();
  p.cash = 500;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  bakery.owner = p.id;
  bakery.investment = 80000;
  bakery.stock.flour = 0;
  bakery.buy.flour = 2100;
  mill.stock.flour = 8;
  mill.sell.flour = 2000;
  const ideas = inventHypotheses(w, p, state);
  const restock = ideas.find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'stock' &&
        s.action.building === bakery.id &&
        s.action.item === 'flour' &&
        s.action.direction === 'deposit',
    ),
  );
  assert.ok(restock, 'owner restock uses the business till');
  assert.ok(
    restock.plan.some(
      (s) => s.kind === 'act' && s.action.type === 'investment' && s.action.direction === 'withdraw',
    ),
  );
});

test('failed experiments rank below untested or successful ones', () => {
  const failed = rankIdeas(
    [
      { id: 'a', description: 'Trade route: flour', plan: [], expectedCash: 100 },
      { id: 'b', description: 'Fish and sell', plan: [], expectedCash: 80 },
    ],
    [{ goal: 'Trade route: flour', cashChange: -500, elapsedSeconds: 30, bankChange: 0, healthChange: 0, previousJob: null, currentJob: null }],
  );
  assert.equal(failed[0]!.id, 'b');
});

test('adaptive planner offers invented experiments, not only the old 120d trades', () => {
  const { w, p, state } = fixture();
  p.cash = 4000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const bakery = w.buildings.find((b) => b.kind === 'bakery')!;
  mill.stock.flour = 6;
  mill.sell.flour = 2000;
  bakery.buy.flour = 2100;
  bakery.investment = 40000;
  const list = adaptiveChoices(w, p, state);
  assert.ok(
    list.some(
      (c) => /flour/i.test(c.description) && /trade|experiment/i.test(c.description),
    ),
  );
});

test('an owner funds a starved mill so it can actually pay for wheat', () => {
  const { w, p, state } = fixture();
  p.cash = 12000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.investment = 60;
  mill.buy.wheat = 600;
  const ideas = inventHypotheses(w, p, state);
  assert.ok(
    ideas.some(
      (c) =>
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            s.action.type === 'investment' &&
            s.action.building === mill.id &&
            s.action.direction === 'deposit' &&
            Number(s.action.amount) >= 600,
        ),
    ),
    'working capital is an experiment when the till cannot cover a posted bid',
  );
});

test('an owner posts a wheat bid and a hiring wage when the mill cannot attract trade or labour', () => {
  const { w, p, state } = fixture();
  p.cash = 8000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.employees = [];
  mill.wage = 400;
  mill.buy = {};
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.stock.wheat = 20;
  farm.sell.wheat = 500;
  const ideas = inventHypotheses(w, p, state);
  assert.ok(
    ideas.some((c) =>
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'buildingAdmin' &&
          s.parameters.some((q) => q.name === 'item' && q.value === 'wheat') &&
          s.parameters.some((q) => q.name === 'side' && q.value === 'buy'),
      ),
    ),
    'post a live buy price so neighbours can sell wheat here',
  );
  assert.ok(
    ideas.some((c) =>
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'buildingAdmin' &&
          s.parameters.some((q) => q.name === 'wage' && Number(q.value) > mill.wage),
      ),
    ),
    'raise the wage when the mill has no worker',
  );
});

test('fishing experiments include selling the catch when someone is buying fish', () => {
  const { w, p, state } = fixture();
  p.inventory.tackle = 1;
  p.inventory.fish = 3;
  const market = w.buildings.find((b) => b.kind === 'market')!;
  market.buy.fish = 1200;
  market.investment = 50000;
  const ideas = inventHypotheses(w, p, state);
  assert.ok(ideas.some((c) => c.plan.some((s) => s.kind === 'fish')));
  assert.ok(
    ideas.some((c) =>
      c.plan.some(
        (s) =>
          s.kind === 'act' &&
          s.action.type === 'trade' &&
          s.action.item === 'fish' &&
          s.action.direction === 'sell',
      ),
    ),
  );
  p.inventory.fish = 1;
  p.hunger = 30000;
  const hungry = inventHypotheses(w, p, state);
  assert.ok(
    !hungry.some((c) =>
      c.plan.some(
        (s) =>
          s.kind === 'act' &&
          s.action.type === 'trade' &&
          s.action.item === 'fish' &&
          s.action.direction === 'sell',
      ),
    ),
    'keep the last meal',
  );
});

test('a resident with cash can try buying an unowned mill and funding its till', () => {
  const { w, p, state } = fixture();
  p.cash = 200000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  delete mill.owner;
  mill.forSale = false;
  mill.investment = 60;
  mill.buy.wheat = 600;
  const ideas = inventHypotheses(w, p, state);
  assert.ok(
    ideas.some(
      (c) =>
        c.plan.some((s) => s.kind === 'act' && s.action.type === 'buyBuilding' && s.action.building === mill.id) &&
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            s.action.type === 'investment' &&
            s.action.direction === 'deposit',
        ),
    ),
    'starting a mill is a live experiment, not a canned career pick',
  );
});

const usesSlot = (plan: Step[], slot: 0 | 5) =>
  plan.some((s) => s.kind === 'act' && s.action.type === 'vehicle' && s.action.slot === slot);
test('adaptive travel remounts a fueled walker', () => {
  const { w, p, state } = fixture();
  p.vehicle = 5;
  p.fuel = 20;
  p.cash = 200000;
  const c = adaptiveChoices(w, p, state).find((c) => c.plan.some((s) => s.kind === 'travel'));
  assert.ok(c);
  assert.ok(usesSlot(c.plan, 0));
});

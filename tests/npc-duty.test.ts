// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';
import { calendar } from '../src/shared/environment.ts';
import { crops } from '../src/shared/farming.ts';
import { employmentRoutine, preparingDuty } from '../src/server/npc/routines.ts';
import { perceivedWorld } from '../src/server/npc/perception.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  completePuddlewick(w);
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'worker', 'Worker');
  p.npc = true;
  p.hunger = 0;
  p.thirst = 0;
  p.cash = 200000;
  const state = {
    playerId: p.id,
    world: w.id,
    intent: '',
    plan: [],
    index: 0,
  } as unknown as ResidentState;
  return { w, p, state };
}

function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
  for (const step of plan) {
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      p.x = b.x;
      p.z = b.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
    else if (step.kind === 'wait') advance(w, step.seconds);
  }
}

test('a farmer already employed on an empty funded farm plants a seasonal crop', () => {
  const { w, p, state } = fixture();
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  farm.investment = 80000;
  farm.plots = [
    { planted: 0, ready: 0, water: 0, fertilized: false, previous: 'potatoes' },
    { planted: 0, ready: 0, water: 0, fertilized: false, previous: 'wheat' },
    { planted: 0, ready: 0, water: 0, fertilized: false, previous: 'wheat' },
    { planted: 0, ready: 0, water: 0, fertilized: false, previous: 'wheat' },
  ];
  p.skills = ['farmer'];
  p.job = farm.id;
  farm.employees = [p.id];
  const season = calendar(w).season;
  assert.ok(
    Object.values(crops).some((crop) => crop.seasons.includes(season)),
    'the fixture season must allow planting',
  );
  const plan = employmentRoutine(w, p, state);
  assert.ok(
    plan.some((s) => s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'plant'),
    'holding a farm job means planting empty plots, not waiting for Jev',
  );
  run(w, p, plan);
  assert.ok(farm.plots.some((plot) => plot.crop));
});

test('a miller buys the last missing wheat, sells it to the mill, then renews the shift', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  const shop = w.buildings.find((b) => b.kind === 'market' || b.kind === 'starport')!;
  mill.stock = { wheat: 4, flour: 2 };
  mill.buy.wheat = 600;
  mill.sell.flour = 2000;
  mill.investment = 80000;
  mill.wage = 1000;
  shop.stock.wheat = 20;
  shop.sell.wheat = 500;
  p.skills = ['miller'];
  p.job = mill.id;
  mill.employees = [p.id];
  p.activeUntil = 0;
  const plan = employmentRoutine(w, p, state);
  assert.ok(
    plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'trade' &&
        s.action.item === 'wheat' &&
        s.action.direction === 'buy',
    ),
    'a mill short one sack is a haul, not a blocker',
  );
  assert.ok(
    plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'trade' &&
        s.action.building === mill.id &&
        s.action.item === 'wheat' &&
        s.action.direction === 'sell',
    ),
  );
  run(w, p, plan);
  assert.ok((mill.stock.wheat ?? 0) >= 5);
  const finish = employmentRoutine(w, p, state);
  assert.ok(finish.some((s) => s.kind === 'act' && s.action.type === 'work'));
  run(w, p, finish);
  assert.ok(p.activeUntil > w.time);
});

test('a pump operator renews the shift when the waterworks already has fuel', () => {
  const { w, p, state } = fixture();
  const pump = w.buildings.find((b) => b.kind === 'waterworks')!;
  assert.ok(pump, 'economy worlds ship a shoreline pump');
  pump.stock = { fuel: 6, water: 0 };
  pump.investment = 80000;
  pump.wage = 2200;
  p.skills = ['pump operator'];
  p.job = pump.id;
  pump.employees = [p.id];
  p.activeUntil = 0;
  const plan = employmentRoutine(w, p, state);
  assert.ok(plan.some((s) => s.kind === 'act' && s.action.type === 'work'));
  run(w, p, plan);
  assert.ok(p.activeUntil > w.time);
});

test('the workplace I already hold stays in my live model even when I am across town', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.stock = { wheat: 4, flour: 2 };
  p.job = mill.id;
  mill.employees = [p.id];
  p.x = mill.x + 80;
  p.z = mill.z + 80;
  const view = perceivedWorld(w, p, state).buildings.find((b) => b.id === mill.id);
  assert.ok(view, 'an employee still sees the mill they work');
  assert.equal(view.stock.wheat, 4);
});

test('a comfortable resident still works a viable job before going home', () => {
  const { w, p, state } = fixture();
  const pump = w.buildings.find((b) => b.kind === 'waterworks')!;
  pump.stock = { fuel: 6, water: 0 };
  pump.investment = 80000;
  pump.wage = 2200;
  p.skills = ['pump operator'];
  p.job = pump.id;
  pump.employees = [p.id];
  p.activeUntil = 0;
  const duty = preparingDuty(w, p, state);
  assert.ok(duty.some((s) => s.kind === 'act' && s.action.type === 'work'));
  state.routine = 'employment';
  assert.deepEqual(preparingDuty(w, p, state), []);
});

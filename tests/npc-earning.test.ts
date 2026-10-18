// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { worldResources } from '../src/shared/resources.ts';
import { careerChoices } from '../src/server/npc/projects.ts';
import { economicMenu } from '../src/server/npc/enterprise.ts';
import { shiftBlocker } from '../src/server/npc/workplace.ts';
import { employmentRoutine, hustleRoutine } from '../src/server/npc/routines.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('earn', 'Earn', 'server'),
    p = addPlayer(w, 'worker', 'Worker');
  const state = {
    plan: [],
    index: 0,
    intent: 'Earn my living',
    world: w.id,
    playerId: p.id,
  } as unknown as ResidentState;
  p.hunger = p.thirst = 0;
  p.inventory = { chainsaw: 1, bread: 2, water: 4 };
  const run = (plan: Step[]) => {
    for (const s of plan) {
      if (s.kind === 'travel') {
        const b =
          w.buildings.find((b) => b.id === s.destination) ??
          worldResources(w).find((n) => n.id === s.destination)!;
        p.x = b.x;
        p.z = b.z;
      } else if (s.kind === 'act') {
        act(w, p.id, s.action);
        if (p.task) advance(w, p.task.end - w.time + 0.01);
      } else if (s.kind === 'wait') advance(w, s.seconds);
    }
  };
  return { w, p, state, run };
}
test('a broke resident with tools can earn from a bulk gathering trip without relief or an up-front cash reserve', () => {
  const { w, p, state, run } = fixture();
  p.cash = 0;
  const market = w.buildings.find((b) => b.kind === 'market')!;
  market.buy.logs = 1500;
  market.stock.logs = 0;
  market.investment = 100000;
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  )!;
  assert.ok(choice, 'owned equipment must remain usable below the cash reserve');
  assert.equal(choice.plan.filter((s) => s.kind === 'act' && s.action.type === 'gather').length, 6);
  const before = market.investment;
  run(choice.plan);
  assert.equal(p.cash, 27000);
  assert.equal(market.stock.logs, 18);
  assert.equal(before - market.investment, 27000);
  assert.equal(p.inventory.chainsaw, 1);
  assert.ok(p.health > 59000);
});

test('idle earning never gathers raw material with no funded buyer', () => {
  const { w, p, state } = fixture();
  p.cash = 0;
  for (const b of w.buildings) b.buy = {};
  const plan = hustleRoutine(w, p, state);
  assert.ok(!plan.some((s) => s.kind === 'act' && s.action.type === 'gather'));
  assert.ok(plan.some((s) => s.kind === 'act' && s.action.type === 'task'));
});

test('job screening uses action targets, including expired shifts, and rejects full output and unfunded batches', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.skills = ['miller'];
  p.job = mill.id;
  mill.employees = [p.id];
  p.activeUntil = 0;
  mill.stock = { wheat: 50, flour: mill.capacity };
  mill.investment = 100000;
  const option = {
    id: 'expired',
    description: 'Renew my expired shift',
    plan: [{ kind: 'act' as const, action: { type: 'work' as const, building: mill.id } }],
  };
  assert.match(shiftBlocker(w, p, mill)!, /Make room/);
  assert.ok(!economicMenu(w, p, [option], 'employee', true, state).some((c) => c.id === option.id));
  assert.ok(
    !careerChoices(w, p, state).some(
      (c) => c.careerGoal?.target === mill.id && c.careerGoal.kind === 'employment',
    ),
  );
  mill.stock.flour = 0;
  mill.investment = 0;
  assert.match(shiftBlocker(w, p, mill)!, /wage bill/);
  mill.investment = 100000;
  assert.equal(shiftBlocker(w, p, mill), undefined);
  assert.ok(economicMenu(w, p, [option], 'employee', true, state).some((c) => c.id === option.id));
});

test('a worker does not buy inputs with the last money needed for their own wages', () => {
  const { w, p, state } = fixture();
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  p.skills = ['miller'];
  p.job = mill.id;
  mill.employees = [p.id];
  p.activeUntil = 0;
  mill.stock = { wheat: 0, flour: 0 };
  mill.buy.wheat = 1000;
  mill.investment = mill.wage;
  p.inventory.wheat = 5;
  assert.deepEqual(employmentRoutine(w, p, state), []);
});

test('healthy livestock notes do not disqualify a productive funded job', () => {
  const { w, p } = fixture();
  const cattle = makeBuilding('herd', 'dairy', 80, 80);
  w.buildings.push(cattle);
  cattle.stock = { cows: 20, feed: 100, water: 100 };
  cattle.herdCondition = 100;
  cattle.investment = 100000;
  p.skills = ['livestock farmer'];
  assert.equal(shiftBlocker(w, p, cattle), undefined);
});

test('the controller keeps the old job when the destination fills after a plan was accepted', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const store = new Store(':memory:'),
    universe = new Universe(store);
  const w = createWorld('puddlewick', 'Puddlewick', 'server'),
    worlds = new Map([[w.id, w]]);
  const options = [
    {
      config: npcConfigSchema.parse({ id: 'mabel', provider: 'jev', activeAlone: true }),
      brain: {
        async decide() {
          return {
            decision: {
              intent: 'Reconsider',
              notebook: '',
              speech: null,
              plan: [{ kind: 'wait' as const, seconds: 60 }],
              repeat: 1,
              reconsiderSeconds: 600,
            },
            inputTokens: 0,
            outputTokens: 0,
          };
        },
      },
    },
  ];
  let r = new Residents(store, universe, worlds, options);
  try {
    const p = w.players[r.status()[0].playerId];
    const farm = w.buildings.find((b) => b.kind === 'farm')!,
      mill = w.buildings.find((b) => b.kind === 'mill')!;
    p.job = farm.id;
    farm.employees = [p.id];
    p.skills = ['farmer', 'miller'];
    p.hunger = p.thirst = 0;
    p.inventory = { bread: 10, water: 20 };
    p.x = mill.x;
    p.z = mill.z + 10;
    mill.investment = 100000;
    mill.stock = { wheat: 20, flour: mill.capacity };
    r.close();
    const now = Date.now(),
      state = r.memory.load('mabel')!;
    Object.assign(state, {
      plan: [
        { kind: 'act', action: { type: 'quit' } },
        { kind: 'act', action: { type: 'job', building: mill.id } },
      ],
      index: 0,
      repeats: 1,
      waitUntil: 0,
      until: now + 3600000,
      nextAt: now + 3600000,
      needsDecision: false,
      pending: false,
      strategyReviewedAt: w.time,
    });
    delete state.routine;
    r.memory.save('mabel', state);
    r = new Residents(store, universe, worlds, options);
    r.tick(0.1, now);
    await r.settled();
    assert.equal(worlds.get(w.id)!.players[p.id].job, farm.id);
    assert.match(r.memory.load('mabel')!.lastOutcome!.message, /Make room/);
  } finally {
    r.close();
    store.close();
  }
});

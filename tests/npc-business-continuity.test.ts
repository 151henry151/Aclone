// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, makeBuilding } from '../src/shared/simulation.ts';
import { accounts } from '../src/shared/reports.ts';
import {
  ownerBidRoutine,
  ownerStaffingRoutine,
  inputStockTarget,
  inputBidQuote,
  retainedCapital,
  procurementDraw,
  procurementTarget,
  businessReturnDelay,
} from '../src/server/npc/business-policy.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { inventHypotheses } from '../src/server/npc/hypotheses.ts';
import { inventChainPlans } from '../src/server/npc/chains.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
import { checkOwnerCapitalAction, planQuotes } from '../src/server/npc/execution.ts';
import { fundProject } from '../src/server/npc/project-funding.ts';
import { startCareer, continueCareer } from '../src/server/npc/projects.ts';
import { jobTraining } from '../src/server/npc/job-training.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
import type { Step } from '../src/server/npc/decision.ts';

function fixture() {
  const w = createWorld('test', 'Test', 'server');
  w.settings.activeWork = false;
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1000000;
  p.inventory = { bread: 10, water: 20 };
  p.skills = ['baker'];
  const b = w.buildings.find((b) => b.kind === 'bakery')!;
  const supplier = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  b.investment = 1000000;
  b.stock = { flour: 1, bread: 27 };
  b.buy = {};
  b.pausedPrices = { buy: { flour: 0 } };
  b.sell = { bread: 4000 };
  b.wage = 1200;
  supplier.sell = { flour: 2000 };
  supplier.stock = { flour: 500 };
  supplier.x = b.x + 20;
  supplier.z = b.z;
  w.buildings = [b, supplier];
  const state = {
    world: w.id,
    playerId: p.id,
    plan: [],
    index: 0,
    pausedInputBids: { world: w.id, deaths: p.deaths, bids: {} },
  } as unknown as ResidentState;
  return { w, p, b, supplier, state };
}
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, steps: Step[]) {
  for (const s of steps) {
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
}
test('bakery retains raw input reserve alongside ordinary finished stock and repairs a legacy zero bid', () => {
  const { w, p, b, supplier, state } = fixture();
  assert.ok(inputStockTarget(b, 'flour', w)! > b.stock.flour);
  run(w, p, ownerBidRoutine(w, p, state));
  assert.ok(b.buy.flour > supplier.sell.flour, 'deliveries have a positive spread');
  const haulier = addPlayer(w, 'haulier', 'Haulier');
  haulier.cash = 100000;
  const before = haulier.cash;
  run(w, haulier, [
    { kind: 'travel', destination: supplier.id },
    {
      kind: 'act',
      action: {
        type: 'trade',
        building: supplier.id,
        item: 'flour',
        quantity: 6,
        direction: 'buy',
      },
    },
    { kind: 'travel', destination: b.id },
    {
      kind: 'act',
      action: { type: 'trade', building: b.id, item: 'flour', quantity: 6, direction: 'sell' },
    },
  ]);
  assert.ok(haulier.cash > before);
  assert.equal(b.stock.flour, 7);
});
test('stock buffers grow with measured sales but halt at real backlog or a blocked joint output', () => {
  const { w, b } = fixture();
  const base = inputStockTarget(b, 'flour', w)!;
  accounts(w, b).sold.bread = 120;
  w.time += 7200;
  assert.ok(inputStockTarget(b, 'flour', w)! > base);
  b.stock.bread = b.capacity;
  assert.equal(inputStockTarget(b, 'flour', w), 0);
  b.production = {
    skill: 'baker',
    seconds: 600,
    tier: 1,
    inputs: { flour: 2 },
    outputs: { bread: 3, compost: 1 },
  };
  b.stock = { bread: 0, compost: b.capacity };
  assert.equal(inputStockTarget(b, 'flour', w), 0, 'cannot ignore one blocked coproduct');
});
test('unknown suppliers, loss-making freight and explicit holds cannot be overridden by another planner', () => {
  const { w, p, b, supplier, state } = fixture();
  supplier.sell.flour = 1000000;
  assert.equal(inputBidQuote(w, p, b, 'flour'), undefined);
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  w.buildings = [b];
  assert.deepEqual(ownerBidRoutine(w, p, state), [], 'zero bid is not an invented market quote');
  w.buildings.push(supplier);
  supplier.sell.flour = 2000;
  b.pausedPrices = {}; // A manual hold need not have a previous positive quote.
  state.pausedInputBids!.manual = { [`${b.id}:flour`]: true };
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
  for (const c of [...inventHypotheses(w, p, state), ...inventChainPlans(w, p, state)])
    assert.ok(
      !c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'buildingAdmin' &&
          s.parameters.some((v) => v.name === 'side' && v.value === 'buy'),
      ),
      c.description,
    );
});
test('reopening funds inputs and payroll without spending the household reserve', () => {
  const { w, p, b, state } = fixture();
  b.investment = 0;
  const total = p.cash;
  run(w, p, ownerBidRoutine(w, p, state));
  assert.ok(b.buy.flour > 0);
  assert.ok(b.investment >= retainedCapital(w, b));
  assert.equal(p.cash + b.investment, total);
  b.buy = {};
  b.investment = 0;
  p.cash = 0;
  assert.deepEqual(ownerBidRoutine(w, p, state), []);
});
test('vacancies receive bounded competitive wages and funded reserves, not an endless wage ratchet', () => {
  const { w, p, b } = fixture();
  p.skills = [];
  b.wage = 100;
  b.investment = 0;
  b.buy.flour = 2200;
  const first = ownerStaffingRoutine(w, p);
  assert.ok(first.length);
  run(w, p, first);
  assert.ok(b.wage > 100);
  assert.ok(b.investment >= retainedCapital(w, b));
  assert.deepEqual(ownerStaffingRoutine(w, p), []);
  const worker = addPlayer(w, 'worker', 'Worker');
  worker.skills = ['baker'];
  run(w, worker, [
    { kind: 'travel', destination: b.id },
    { kind: 'act', action: { type: 'job', building: b.id } },
  ]);
  assert.ok(b.employees.includes(worker.id));
});
test('project financing withdraws only its shortfall and protects claims and working capital', () => {
  const { w, p, b } = fixture();
  p.cash = 10000;
  b.stakes = [{ investor: 'outsider', principal: 100000, claim: 108000, paid: 0, opened: 0 }];
  const before = b.investment;
  const plan = fundProject(w, p, 150000, () => []);
  assert.ok(plan);
  run(w, p, plan);
  assert.equal(p.cash, 150000);
  assert.equal(b.investment, before - 140000);
  assert.ok(b.investment >= retainedCapital(w, b) + 108000);
  assert.equal(
    fundProject(w, p, 2000000, () => []),
    undefined,
  );
  b.owner = 'someone-else';
  assert.equal(
    fundProject(w, p, 200000, () => []),
    undefined,
  );
});
test('cash-poor owner sees an executable acquisition funded from surplus instead of only a standalone withdrawal', () => {
  const { w, p, b, supplier } = fixture();
  p.cash = 1000;
  b.investment = 10000000;
  supplier.owner = undefined;
  supplier.price = 100000;
  supplier.investment = 100000;
  supplier.buy.wheat = 100;
  supplier.sell.flour = 2000;
  supplier.wage = 100;
  const choice = enterpriseChoices(w, p).find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'act' && s.action.type === 'buyBuilding' && s.action.building === supplier.id,
    ),
  );
  assert.ok(choice);
  assert.equal(choice.careerGoal?.target, supplier.id);
  run(w, p, choice.plan);
  assert.equal(supplier.owner, p.id);
  assert.ok(b.investment >= retainedCapital(w, b));
});
test('training retains the workplace goal and continues into paid employment after qualification', () => {
  const { w, p, b } = fixture();
  b.owner = 'other';
  b.stock.flour = 30;
  p.skills = [];
  p.job = undefined;
  const school = makeBuilding('school', 'school', b.x + 10, b.z);
  w.buildings.push(school);
  const choice = jobTraining(w, p, b);
  assert.ok(choice);
  const state = { world: w.id, playerId: p.id, plan: [], index: 0 } as unknown as ResidentState;
  startCareer(w, p, state, choice.careerGoal!);
  run(w, p, choice.plan);
  advance(w, 61);
  assert.ok(p.skills.includes('baker'));
  const next = continueCareer(w, p, state);
  assert.ok(next);
  run(w, p, next.plan);
  assert.equal(p.job, b.id);
});
test('business absences are bounded without changing non-owner schedules', () => {
  const { w, p, b } = fixture();
  assert.equal(businessReturnDelay(w, p, 86400), 1800);
  assert.equal(businessReturnDelay(w, p, 300), 300);
  b.owner = 'other';
  assert.equal(businessReturnDelay(w, p, 86400), 86400);
});

test('a planned draw is rechecked when wages or investor claims change on the way', () => {
  const { w, p, b } = fixture();
  p.cash = 1000;
  const plan = fundProject(w, p, 900000, () => []);
  assert.ok(plan);
  const step = plan.find((s) => s.kind === 'act' && s.action.type === 'investment');
  assert.ok(step?.kind === 'act');
  b.investment = 10000;
  assert.throws(() => checkOwnerCapitalAction(w, p, step.action), /reserves changed/);
  b.investment = 1000000;
  b.stakes = [{ investor: 'other', principal: 800000, claim: 864000, paid: 0, opened: 0 }];
  assert.throws(() => checkOwnerCapitalAction(w, p, step.action), /reserves changed/);
});

test('a persisted offline owner returns for purchasing and repairs a closed bid without a model call', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const store = new Store(':memory:');
  const { w, b, supplier } = fixture();
  w.time = 10000;
  const now = Date.now();
  let calls = 0;
  const options = [
    {
      config: npcConfigSchema.parse({
        id: 'toby',
        provider: 'jev',
        presence: 'scheduled',
        activeAlone: true,
      }),
      brain: {
        async decide(): Promise<never> {
          calls++;
          throw Error('No paid calls expected');
        },
      },
    },
  ];
  const universe = new Universe(store),
    worlds = new Map([[w.id, w]]);
  // The controller's configured default world is Puddlewick.
  w.id = 'puddlewick';
  worlds.clear();
  worlds.set(w.id, w);
  let residents = new Residents(store, universe, worlds, options, { dailyUsd: 0, monthlyUsd: 0 });
  try {
    const p = addPlayer(w, residents.status()[0].playerId, 'Toby');
    b.owner = p.id;
    b.stock = { flour: 0, bread: 0 };
    p.cash = 1000000;
    p.skills = ['baker'];
    p.hunger = p.thirst = 0;
    p.inventory = { bread: 10, water: 20 };
    p.lastSeen = w.time - 1801;
    p.x = b.x;
    p.z = b.z;
    p.vehicle = 0;
    p.fuel = 100;
    const state = residents.memory.load('toby')!;
    state.world = w.id;
    state.markets = {
      world: w.id,
      visits: { [supplier.id]: { at: w.time, building: structuredClone(supplier), staff: [] } },
    };
    state.presence = {
      phase: 'offline',
      sessions: 2,
      nextAt: now + 86400000,
      nextRegularAt: now + 86400000,
      endsAt: now - 1000,
      preparationUntil: now - 1,
    };
    state.plan = [];
    state.index = 0;
    residents.close();
    residents.memory.save('toby', state);
    residents = new Residents(store, universe, worlds, options, { dailyUsd: 0, monthlyUsd: 0 });
    for (let i = 0; i < 12 && !b.buy.flour; i++) {
      residents.tick(0.5, now + i * 1000);
      await residents.settled();
    }
    assert.ok(b.buy.flour > supplier.sell.flour);
    assert.notEqual(residents.memory.load('toby')!.presence!.phase, 'offline');
    assert.equal(calls, 0);
  } finally {
    residents.close();
    store.close();
  }
});

test('48-hour mechanical soak keeps supplier payments, production and wages circulating across owner absences', () => {
  const { w, p, b, supplier, state } = fixture();
  w.settings.ownerOperation = true;
  supplier.stock.flour = 20000;
  supplier.capacity = 20000;
  b.stock = { flour: 0, bread: 0 };
  const buyer = makeBuilding('customer', 'warehouse', b.x + 15, b.z);
  buyer.buy = { bread: 4500 };
  buyer.investment = 100000000;
  buyer.capacity = 20000;
  w.buildings.push(buyer);
  const haulier = addPlayer(w, 'carrier', 'Carrier');
  haulier.cash = 1000000;
  const worker = addPlayer(w, 'baker', 'Baker');
  worker.skills = ['baker'];
  run(w, worker, [
    { kind: 'travel', destination: b.id },
    { kind: 'act', action: { type: 'job', building: b.id } },
  ]);
  let memory = state,
    supplied = 0,
    sold = 0;
  const wageBefore = worker.cash;
  for (let minute = 0; minute < 48 * 60; minute += 10) {
    // A routine business check every half hour, with serialized memory between visits.
    if (minute % 30 === 0) {
      p.online = true;
      run(w, p, ownerBidRoutine(w, p, memory));
      memory = JSON.parse(JSON.stringify(memory));
      p.online = false;
    }
    if (b.buy.flour) {
      const n = Math.min(12, Math.max(0, inputStockTarget(b, 'flour', w)! - b.stock.flour));
      if (n) {
        run(w, haulier, [
          { kind: 'travel', destination: supplier.id },
          {
            kind: 'act',
            action: {
              type: 'trade',
              building: supplier.id,
              item: 'flour',
              quantity: n,
              direction: 'buy',
            },
          },
          { kind: 'travel', destination: b.id },
          {
            kind: 'act',
            action: {
              type: 'trade',
              building: b.id,
              item: 'flour',
              quantity: n,
              direction: 'sell',
            },
          },
        ]);
        supplied += n;
      }
    }
    for (let i = 0; i < 10; i++) advance(w, 60);
    const n = Math.min(12, b.stock.bread ?? 0);
    if (n) {
      run(w, haulier, [
        { kind: 'travel', destination: b.id },
        {
          kind: 'act',
          action: { type: 'trade', building: b.id, item: 'bread', quantity: n, direction: 'buy' },
        },
        { kind: 'travel', destination: buyer.id },
        {
          kind: 'act',
          action: {
            type: 'trade',
            building: buyer.id,
            item: 'bread',
            quantity: n,
            direction: 'sell',
          },
        },
      ]);
      sold += n;
    }
    assert.ok(b.investment > 0, `cash ran out at minute ${minute}`);
  }
  assert.ok(supplied > 400);
  assert.ok(sold > 600);
  assert.ok(worker.cash > wageBefore);
  assert.ok(b.investment > 1000000);
  assert.equal(p.deaths, 0);
});

test('qualified owner maintenance can renew an unpaid shift through the controller', async () => {
  const { Store } = await import('../src/server/store.ts');
  const { Universe } = await import('../src/server/universe.ts');
  const { Residents } = await import('../src/server/npc/residents.ts');
  const { npcConfigSchema } = await import('../src/server/npc/config.ts');
  const store = new Store(':memory:');
  const { w, b } = fixture();
  w.id = 'puddlewick';
  w.settings.activeWork = true;
  w.settings.ownerOperation = true;
  const residents = new Residents(
    store,
    new Universe(store),
    new Map([[w.id, w]]),
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
    { dailyUsd: 0, monthlyUsd: 0 },
  );
  try {
    const p = w.players[residents.status()[0].playerId];
    b.owner = p.id;
    p.skills = ['baker'];
    p.cash = 1000000;
    p.hunger = p.thirst = 0;
    p.inventory = { bread: 10, water: 20 };
    p.x = b.x;
    p.z = b.z;
    p.fuel = 100;
    b.stock.flour = 30;
    b.ownerActiveUntil = -1;
    const before = p.cash,
      now = Date.now();
    for (let i = 0; i < 10 && !(b.ownerActiveUntil > w.time); i++) {
      residents.tick(0.5, now + i * 1000);
      await residents.settled();
    }
    assert.ok(b.ownerActiveUntil > w.time);
    assert.equal(p.cash, before);
    assert.ok(!b.employees.includes(p.id));
  } finally {
    residents.close();
    store.close();
  }
});

test('reserved procurement cash can become delivered inputs without freeing payroll for unrelated spending', async () => {
  const { planQuotes } = await import('../src/server/npc/execution.ts');
  const { w, p, b, supplier } = fixture();
  p.cash = 0;
  b.stock = { flour: 0, bread: 0 };
  b.buy.flour = 2200;
  b.investment = retainedCapital(w, b);
  const choice = enterpriseChoices(w, p).find(
    (c) =>
      c.description.startsWith('Supply my') &&
      c.plan.some((s) => s.kind === 'act' && s.action.type === 'investment'),
  );
  assert.ok(choice);
  const drawIndex = choice.plan.findIndex(
    (s) => s.kind === 'act' && s.action.type === 'investment',
  );
  const step = choice.plan[drawIndex];
  assert.ok(step.kind === 'act');
  const quotes = planQuotes(w, choice.plan),
    remaining = choice.plan.slice(drawIndex + 1);
  assert.throws(() => checkOwnerCapitalAction(w, p, step.action), /reserves changed/);
  assert.doesNotThrow(() => checkOwnerCapitalAction(w, p, step.action, remaining, quotes));
  // No exceptions for a purchase with no delivery to the funding business.
  assert.throws(
    () =>
      checkOwnerCapitalAction(
        w,
        p,
        step.action,
        remaining.filter((s) => !(s.kind === 'act' && s.action.type === 'stock')),
        quotes,
      ),
    /reserves changed/,
  );
  run(w, p, choice.plan);
  assert.ok(b.stock.flour > 0);
  assert.ok(b.investment >= retainedCapital(w, b));
  assert.ok(supplier.investment > 0);
});

test('both procurement planners draw exactly the purchase shortfall and preserve other inputs and payroll', () => {
  for (const kind of ['enterprise', 'experiment']) {
    const { w, p, b, state } = fixture();
    p.cash = 500;
    p.inventory = {};
    w.settings.hungerRate = w.settings.thirstRate = 1;
    b.stock = { flour: 0, bread: 0 };
    b.production = {
      skill: 'baker',
      seconds: 600,
      tier: 1,
      inputs: { flour: 2, fuel: 1 },
      outputs: { bread: 3 },
    };
    b.buy = { flour: 2200, fuel: 5000 };
    b.investment = retainedCapital(w, b);
    const options = kind === 'enterprise' ? enterpriseChoices(w, p) : inventHypotheses(w, p, state);
    const choice = options.find(
      (c) =>
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            s.action.type === 'trade' &&
            s.action.direction === 'buy' &&
            s.action.item === 'flour',
        ) &&
        c.plan.some(
          (s) =>
            s.kind === 'act' &&
            s.action.type === 'stock' &&
            s.action.building === b.id &&
            s.action.direction === 'deposit',
        ),
    );
    assert.ok(choice, kind);
    const quotes = planQuotes(w, choice.plan);
    for (let i = 0; i < choice.plan.length; i++) {
      const step = choice.plan[i];
      if (step.kind === 'act')
        checkOwnerCapitalAction(w, p, step.action, choice.plan.slice(i + 1), quotes);
      run(w, p, [step]);
    }
    assert.ok(b.stock.flour > 0);
    assert.ok(b.investment >= retainedCapital(w, b));
    assert.equal(p.cash, 500, 'protect household cash, no excess draw left in pocket');
  }
});

test('livestock procurement retains other operating supplies and respects breeding stock targets', () => {
  const { w, p } = fixture();
  const b = makeBuilding('dairy', 'dairy', 0, 0);
  b.owner = p.id;
  b.stock = { cows: 2 };
  b.investment = 1000000;
  p.cash = 0;
  w.buildings.push(b);
  const target = procurementTarget(w, b, 'water');
  assert.ok(target > 0);
  assert.equal(procurementTarget(w, b, 'cows'), 2);
  const draw = procurementDraw(w, p, b, 'water', target, 100);
  assert.equal(draw, target * 100);
  assert.equal(procurementDraw(w, p, b, 'water', target + 1, 100), undefined);
  const plan: Step[] = [
    {
      kind: 'act',
      action: {
        type: 'trade',
        building: 'supplier',
        direction: 'buy',
        item: 'water',
        quantity: target,
      },
    },
    {
      kind: 'act',
      action: {
        type: 'stock',
        building: b.id,
        direction: 'deposit',
        item: 'water',
        quantity: target,
      },
    },
  ];
  assert.doesNotThrow(() =>
    checkOwnerCapitalAction(
      w,
      p,
      { type: 'investment', building: b.id, direction: 'withdraw', amount: draw! },
      plan,
      { 'supplier:buy:water': 100 },
    ),
  );
});

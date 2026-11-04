// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  terrainHeight,
} from '../src/shared/simulation';
import { gameplayChoices } from '../src/server/npc/farmer';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { adaptiveChoices } from '../src/server/npc/adaptive';
import { careerChoices } from '../src/server/npc/projects';
import { constructionChoices } from '../src/server/npc/construction-projects';
import { employmentRoutine } from '../src/server/npc/routines';
import { worldResources } from '../src/shared/resources';
import { operationAction } from '../src/server/npc/player-operations';
import type { Step } from '../src/server/npc/decision';
import type { ResidentState } from '../src/server/npc/memory';
function memoryState(
  w: ReturnType<typeof createWorld>,
  p: ReturnType<typeof addPlayer>,
): ResidentState {
  return {
    world: w.id,
    playerId: p.id,
    name: p.name,
    personality: 'Helpful',
    notebook: '',
    intent: '',
    plan: [],
    index: 0,
    cursor: 0,
    nextAt: 0,
    repeats: 0,
    until: 0,
    waitUntil: 0,
    status: 'Ready',
    errors: 0,
  };
}
function setup() {
  const w = createWorld('limit', 'Limit', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('bakery', 'bakery', 0, 0),
    seller = makeBuilding('seller', 'market', 20, 0),
    buyer = makeBuilding('buyer', 'market', 40, 0),
    farm = makeBuilding('farm', 'farm', 60, 0);
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, salesTax: 0, seaLevel: -10 });
  w.towns = [];
  w.resources = {};
  Object.assign(p, {
    cash: 1000000,
    inventory: {},
    fuel: 64,
    x: 0,
    z: 0,
    hunger: 0,
    thirst: 0,
    skills: ['baker', 'farmer'],
  });
  Object.assign(b, {
    owner: p.id,
    stock: { flour: 0, bread: 30 },
    buy: { flour: 100 },
    sell: { bread: 200 },
    wage: 100,
    investment: 100000,
    production: {
      skill: 'baker',
      tier: 1,
      seconds: 600,
      inputs: { flour: 2 },
      outputs: { bread: 3 },
    },
  });
  Object.assign(seller, {
    owner: 'seller',
    stock: { flour: 100, wood: 100, water: 100, bread: 100 },
    sell: { flour: 100, wood: 100, water: 100, bread: 100 },
    buy: {},
    investment: 100000,
  });
  Object.assign(buyer, {
    owner: 'buyer',
    stock: {},
    sell: {},
    buy: { bread: 300, wheat: 400, flour: 200 },
    investment: 100000,
    capacity: 1000,
  });
  Object.assign(farm, { owner: p.id, stock: { wheat: 50 }, investment: 100000 });
  w.buildings = [b, seller, buyer, farm];
  const state = memoryState(w, p);
  act(w, p.id, { type: 'settings', patch: { transactionItemLimit: 1 } });
  return { w, p, b, seller, buyer, farm, state };
}
const transfers = (plan: Step[]) =>
  plan.flatMap((s) =>
    s.kind === 'act' && (s.action.type === 'trade' || s.action.type === 'stock') ? [s.action] : [],
  );
function bounded(plan: Step[]) {
  const actions = transfers(plan);
  assert.ok(actions.length > 0, 'Expected a goods-transfer plan');
  for (const a of actions) assert.equal(a.quantity, 1, JSON.stringify(a));
}
function run(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>, plan: Step[]) {
  for (const s of plan) {
    if (s.kind === 'travel') {
      const target =
        w.buildings.find((b) => b.id === s.destination) ??
        worldResources(w).find((n) => n.id === s.destination)!;
      assert.ok(target);
      Object.assign(p, { x: target.x, z: target.z, y: terrainHeight(w, target.x, target.z) });
    } else if (s.kind === 'act') {
      act(w, p.id, s.action);
      if (p.task) advance(w, p.task.end - w.time + 0.01);
    } else if (s.kind === 'operation') act(w, p.id, operationAction(s));
  }
}
test('ordinary farm and economy choices cap purchases collection deposits and carried sales', () => {
  const { w, p, state } = setup();
  p.inventory = { wheat: 40, flour: 20 };
  const choices = gameplayChoices(w, p, state, 'farmer');
  for (const prefix of ['Collect', 'Deposit', 'Sell'])
    assert.ok(
      choices.some((c) => c.description.startsWith(prefix)),
      prefix,
    );
  bounded(choices.flatMap((c) => c.plan));
});
test('enterprise and farm routes share one bounded quantity on every transfer leg and conserve output', () => {
  const { w, p, b, buyer } = setup();
  const choices = enterpriseChoices(w, p);
  assert.ok(choices.some((c) => c.description.startsWith('Supply my')));
  assert.ok(choices.some((c) => c.description.startsWith('Sell my output: haul')));
  bounded(choices.flatMap((c) => c.plan));
  const sale = choices.find((c) => c.description.startsWith('Sell my output: collect'))!;
  assert.ok(sale);
  const cash = p.cash + b.investment + buyer.investment,
    goods = b.stock.bread + (buyer.stock.bread ?? 0);
  run(w, p, sale.plan);
  assert.equal(p.cash + b.investment + buyer.investment, cash);
  assert.equal(b.stock.bread + (buyer.stock.bread ?? 0) + (p.inventory.bread ?? 0), goods);
  assert.equal(buyer.stock.bread, 1);
});
test('adaptive trade and supply choices remain available under a one item limit', () => {
  const { w, p, state } = setup();
  const choices = adaptiveChoices(w, p, state);
  for (const prefix of ['Trade route:', 'Buy 1 Flour']) {
    const choice = choices.find((c) => c.description.startsWith(prefix));
    assert.ok(choice, prefix);
    bounded(choice.plan);
  }
});
test('trading careers cap both purchased and already carried cargo', () => {
  const { w, p, state } = setup();
  p.vehicle = 5;
  for (const inventory of [{}, { flour: 20 }] as Record<string, number>[]) {
    p.inventory = inventory;
    const choice = careerChoices(w, p, state).find(
      (c) => c.careerGoal?.kind === 'trade' && c.careerGoal.item === 'flour',
    );
    assert.ok(choice);
    bounded(choice.plan);
  }
});
test('construction procurement buys a bounded quantity and delivers it normally', () => {
  const { w, p, b } = setup();
  b.construction = { wood: 5 };
  const choice = constructionChoices(w, p)[0];
  assert.ok(choice);
  bounded(choice.plan);
  run(w, p, choice.plan);
  assert.equal(b.construction.wood, 4);
  assert.equal(p.inventory.wood ?? 0, 0);
});
test('worker input errands bound both carried and purchased inputs', () => {
  const { w, p, b, state } = setup();
  b.owner = 'employer';
  b.buy.flour = 200;
  b.employees = [p.id];
  p.job = b.id;
  for (const inventory of [{ flour: 20 }, {}] as Record<string, number>[]) {
    p.inventory = inventory;
    const plan = employmentRoutine(w, p, state);
    bounded(plan);
  }
});
test('gathering preserves whole yields and sells only the permitted load before gathering more', () => {
  const w = createWorld('test', 'Test', 'owner'),
    p = addPlayer(w, 'owner', 'Gatherer');
  p.cash = 100000;
  p.inventory = { bread: 6, water: 10, chainsaw: 1 };
  p.vehicle = 5;
  p.fuel = 0;
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  shop.buy.logs = 1500;
  shop.investment = 100000;
  act(w, p.id, { type: 'settings', patch: { transactionItemLimit: 1 } });
  const state = memoryState(w, p);
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  );
  assert.ok(choice);
  bounded(choice.plan);
  assert.equal(choice.plan.filter((s) => s.kind === 'act' && s.action.type === 'gather').length, 1);
  assert.match(choice.description, /gather 3 logs.*deliver 1/);
  run(w, p, choice.plan);
  assert.equal(p.inventory.logs, 2);
  const next = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  );
  assert.ok(next);
  bounded(next.plan);
  assert.ok(!next.plan.some((s) => s.kind === 'act' && s.action.type === 'gather'));
});

test('adaptive storage offers a bounded leg and partial service parts remain purchasable', () => {
  const { w, p, b, seller, state } = setup();
  p.inventory.flour = 20;
  let choices = adaptiveChoices(w, p, state);
  for (const prefix of ['Store 1 flour', 'Withdraw 1 bread']) {
    const choice = choices.find((c) => c.description.startsWith(prefix));
    assert.ok(choice, prefix);
    bounded(choice.plan);
  }
  const garage = makeBuilding('garage', 'garage', 60, 0);
  w.buildings.push(garage);
  p.fleetState = { [p.vehicle]: { condition: 70, metres: 1, acquiredAt: 0 } };
  seller.stock.steel = 1;
  seller.sell.steel = 100;
  act(w, p.id, { type: 'settings', patch: { vehicleServiceSteel: 2 } });
  const part = adaptiveChoices(w, p, state).find((c) =>
    c.description.startsWith('Buy 1 Steel spare part'),
  );
  assert.ok(part);
  bounded(part.plan);
  assert.ok(!part.plan.some((s) => s.kind === 'operation' && s.operation === 'serviceVehicle'));
  run(w, p, part.plan);
  assert.equal(p.inventory.steel, 1);
  assert.equal(p.fleetState[p.vehicle].condition, 70);
});

test('a bounded gathering sale can use a buyer funded and sized for only that sale', () => {
  const w = createWorld('test', 'Test', 'owner'),
    p = addPlayer(w, 'owner', 'Gatherer');
  p.cash = 100000;
  p.inventory = { bread: 6, water: 10, chainsaw: 1 };
  p.vehicle = 5;
  p.fuel = 0;
  for (const b of w.buildings) b.buy.logs = 0;
  const shop = w.buildings.find((b) => b.kind === 'market')!;
  shop.buy.logs = 1500;
  shop.investment = 1500;
  shop.stock.logs = 0;
  shop.capacity = 1;
  act(w, p.id, { type: 'settings', patch: { transactionItemLimit: 1 } });
  const state = memoryState(w, p);
  const choice = careerChoices(w, p, state).find(
    (c) => c.careerGoal?.kind === 'gather' && c.careerGoal.item === 'logs',
  );
  assert.ok(choice);
  bounded(choice.plan);
  run(w, p, choice.plan);
  assert.equal(shop.stock.logs, 1);
  assert.equal(p.inventory.logs, 2);
});

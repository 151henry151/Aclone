// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { buildings, recipes, items, skills, defaults } from '../src/shared/catalog';
import { butcherRamp } from '../src/shared/butcher';
import { enterpriseChoices } from '../src/server/npc/enterprise';
import { operationAction } from '../src/server/npc/player-operations';
import { productionReport } from '../src/shared/reports';
import { businessEconomics } from '../src/shared/business-economics';
const species = [
  ['cows', 'beef', 12, 'dairy'],
  ['pigs', 'pork', 8, 'piggery'],
  ['sheep', 'mutton', 6, 'sheepfold'],
  ['chickens', 'poultry', 1, 'henhouse'],
] as const;
function shop() {
  const w = createWorld('butcher-service', 'Butcher', 'owner');
  w.buildings = [];
  w.zones = [];
  w.towns = [];
  Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, activeWork: false });
  const b = makeBuilding('butcher', 'butcher', 0, 0);
  b.owner = 'owner';
  b.stock = {};
  b.investment = 100000;
  const owner = addPlayer(w, 'owner', 'Owner'),
    farmer = addPlayer(w, 'farmer', 'Farmer'),
    worker = addPlayer(w, 'worker', 'Butcher');
  worker.skills = ['butcher'];
  worker.job = b.id;
  worker.activeUntil = 100000;
  b.employees = [worker.id];
  farmer.vehicle = 5;
  farmer.cash = 1000000;
  farmer.inventory = { chickens: 1 };
  // The loading ramp is at the front of the standard building plan.
  Object.assign(farmer, { x: 0, z: 9, speed: 0 });
  w.buildings = [b];
  return { w, b, owner, farmer, worker };
}
test('butcher bids and all four slaughter batches pay suppliers and qualified staff after tax', () => {
  assert.ok(buildings.butcher, 'the butcher is a buildable tier-zero business');
  assert.equal(buildings.butcher.tier, 0);
  assert.ok(skills.includes('butcher'));
  const b = buildings.butcher;
  for (const [animal, raw, yieldCount, farm] of species) {
    const recipe = recipes[`butcher_${animal}`];
    assert.deepEqual(recipe.inputs, { [animal]: 1 });
    assert.deepEqual(recipe.outputs, { [raw]: yieldCount });
    assert.equal(recipe.skill, 'butcher');
    assert.ok(b.buy[animal] > buildings[farm].sell[animal]);
    for (const port of ['market', 'starport']) {
      assert.ok(b.buy[animal] > buildings[port].buy[animal]);
      assert.ok(b.buy[animal] < buildings[port].sell[animal]);
    }
    const cost = b.buy[animal] + b.wage;
    assert.ok(
      b.sell[raw] * yieldCount * (1 - defaults.salesTax) >= cost * 1.2,
      `${animal} batch margin`,
    );
    assert.equal(items[raw].food ?? 0, 0);
  }
});
test('paid slaughter leaves the animal with its farmer until completion then pays the business exactly once', () => {
  const { w, b, farmer } = shop();
  const money = farmer.cash,
    investment = b.investment;
  const message = act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'chickens',
    quantity: 1,
  });
  assert.match(message, /slaughter/i);
  assert.equal(farmer.inventory.chickens, 1);
  assert.equal(farmer.cash, money);
  assert.equal(farmer.task?.kind, 'slaughter');
  const due = farmer.task!.end;
  advance(w, due - w.time - 1);
  assert.equal(farmer.inventory.poultry, undefined);
  advance(w, 1);
  assert.equal(farmer.inventory.chickens ?? 0, 0);
  assert.equal(farmer.inventory.poultry, 1);
  assert.equal(money - farmer.cash, 990);
  assert.equal(b.investment - investment, 990);
  advance(w, 1);
  assert.equal(farmer.inventory.poultry, 1);
});
test('slaughter refuses young with remaining growth time and refuses large animals carried on foot', () => {
  const { w, b, farmer } = shop();
  farmer.inventory = { chicks: 1, cows: 1 };
  farmer.inventoryLife = { young: [{ item: 'chicks', count: 1, born: 0, grownDays: 2 }] };
  assert.throws(
    () =>
      act(w, farmer.id, {
        type: 'butcher',
        building: b.id,
        operation: 'slaughter',
        item: 'chicks',
        quantity: 1,
      }),
    /4.*days.*matur/i,
  );
  assert.throws(
    () =>
      act(w, farmer.id, {
        type: 'butcher',
        building: b.id,
        operation: 'slaughter',
        item: 'cows',
        quantity: 1,
      }),
    /livestock wagon|small animal/i,
  );
  assert.equal(farmer.task, undefined);
});
test('a changed fee, missing staff or leaving the ramp cancels without consuming or charging', () => {
  for (const change of ['fee', 'staff', 'position', 'disabled', 'stock', 'money'] as const) {
    const { w, b, farmer } = shop();
    act(w, farmer.id, {
      type: 'butcher',
      building: b.id,
      operation: 'slaughter',
      item: 'chickens',
      quantity: 1,
    });
    const due = farmer.task!.end;
    if (change === 'fee') b.slaughterFees = { chickens: 1200 };
    if (change === 'staff') b.employees = [];
    if (change === 'position') farmer.x = 100;
    if (change === 'disabled') w.settings.butchersEnabled = false;
    if (change === 'stock') farmer.inventory.chickens = 0;
    if (change === 'money') farmer.cash = 0;
    const cash = farmer.cash,
      animal = farmer.inventory.chickens;
    advance(w, due - w.time);
    assert.equal(farmer.cash, cash, change);
    assert.equal(farmer.inventory.chickens, animal, change);
    assert.equal(farmer.inventory.poultry, undefined, change);
    assert.match(w.messages.at(-1)!.text, /cancelled/i);
  }
});
test('a livestock wagon returns meat and configurable by-products without needing room for both animal and carcass', () => {
  const { w, b, farmer } = shop();
  Object.assign(w.settings, { beefYield: 7, slaughterCompostYield: 2, slaughterSeconds: 5 });
  const ramp = butcherRamp(b);
  farmer.vehicle = 0;
  farmer.inventory = {};
  w.trailers = {
    wagon: {
      id: 'wagon',
      owner: farmer.id,
      kind: 'livestock',
      ...ramp,
      heading: 0,
      cargo: { cows: 1 },
      attached: farmer.id,
    },
  };
  const cash = farmer.cash;
  act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'cows',
    quantity: 1,
    storage: 'trailer',
  });
  advance(w, 5);
  assert.deepEqual(w.trailers.wagon.cargo, { beef: 7, compost: 2 });
  assert.equal(cash - farmer.cash, 6600);
  assert.deepEqual(farmer.inventory, {});
});
test('counter production uses world yields, pays its qualified crew, and stops when butchers are disabled', () => {
  const { w, b, worker, owner } = shop();
  Object.assign(owner, butcherRamp(b));
  act(w, owner.id, { type: 'butcher', building: b.id, operation: 'menu', item: 'pigs' });
  Object.assign(w.settings, { porkYield: 11, slaughterCompostYield: 1 });
  b.stock = { pigs: 2 };
  const cash = worker.cash;
  advance(w, 600);
  assert.deepEqual(b.stock, { pigs: 1, pork: 11, compost: 1 });
  assert.equal(worker.cash - cash, b.wage - Math.floor(b.wage * w.settings.wageTax));
  w.settings.butchersEnabled = false;
  const before = structuredClone(b.stock);
  advance(w, 600);
  assert.deepEqual(b.stock, before);
  assert.throws(() => act(w, owner.id, { type: 'construct', kind: 'butcher' }), /disabled/);
});
test('owner fees and explicit cancellation apply without paying twice or consuming stock', () => {
  const { w, b, owner, farmer } = shop();
  Object.assign(owner, butcherRamp(b));
  act(w, owner.id, {
    type: 'butcher',
    building: b.id,
    operation: 'fee',
    item: 'chickens',
    fee: 700,
  });
  const cash = farmer.cash;
  act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'chickens',
    quantity: 1,
  });
  act(w, farmer.id, { type: 'butcher', operation: 'cancel' });
  advance(w, 30);
  assert.equal(farmer.cash, cash);
  assert.equal(farmer.inventory.chickens, 1);
  assert.equal(farmer.inventory.poultry, undefined);
  act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'chickens',
    quantity: 1,
  });
  advance(w, 30);
  assert.equal(cash - farmer.cash, 700);
});
test('raw meat has bounded public quotes and profitable restaurant buyers', () => {
  const b = buildings.butcher;
  for (const [, raw] of species) {
    assert.ok(buildings.kitchen.buy[raw] > b.sell[raw]);
    assert.ok(buildings.market.buy[raw] < buildings.kitchen.buy[raw]);
    assert.ok(buildings.market.sell[raw] > b.sell[raw]);
    assert.ok(buildings.starport.sell[raw] > buildings.kitchen.buy[raw]);
  }
});
test('an NPC farmer enables continuous breeding and physically sells only surplus adults to the best butcher bid', () => {
  const { w, b: butcher, owner } = shop();
  owner.npc = true;
  owner.skills = ['livestock farmer'];
  owner.cash = 1000000;
  const farm = makeBuilding('farm', 'dairy', 0, 0);
  farm.owner = owner.id;
  farm.stock = { cows: 3, feed: 100, water: 100 };
  farm.investment = 1000000;
  farm.pasture = { x: 20, z: 0, parcels: 4 };
  butcher.owner = 'another-butcher';
  const market = makeBuilding('market', 'market', 20, 0);
  market.investment = 1000000;
  w.buildings.push(farm, market);
  Object.assign(owner, { x: 0, z: 0 });
  let choices = enterpriseChoices(w, owner);
  const breeding = choices.find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'operation' &&
        operationAction(s).type === 'livestock' &&
        operationAction(s).operation === 'continuous',
    ),
  );
  assert.ok(breeding, 'NPCs choose continuous breeding');
  for (const step of breeding.plan)
    if (step.kind === 'operation') act(w, owner.id, operationAction(step));
  assert.equal(farm.continuousBreeding, true);
  farm.stock.calves = 1;
  choices = enterpriseChoices(w, owner);
  const selling = choices.find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'act' &&
        s.action.type === 'trade' &&
        s.action.building === butcher.id &&
        s.action.item === 'cows',
    ),
  );
  assert.ok(selling, 'the butcher outbids the stores');
  for (const step of selling.plan) {
    if (step.kind === 'travel') {
      const b = w.buildings.find((b) => b.id === step.destination)!;
      Object.assign(owner, { x: b.x, z: b.z });
    } else if (step.kind === 'act') act(w, owner.id, step.action);
  }
  assert.equal(farm.stock.cows, 2);
  assert.equal(farm.stock.calves, 1);
  assert.equal(butcher.stock.cows, 1);
  assert.equal(owner.inventory.cows ?? 0, 0);
});
test('production explanations and economic estimates use the same world meat yields as the actual counter', () => {
  const { w, b } = shop();
  b.recipe = 'butcher_pigs';
  b.stock = { pigs: 1, pork: 490 };
  w.settings.porkYield = 11;
  assert.match(productionReport(w, b).join(' '), /No room for 11 pork/);
  assert.equal(businessEconomics(w, b)?.gross, 11 * b.sell.pork);
});
test('the school teaches butcher and unqualified workers cannot provide service', () => {
  const { w, b, worker, farmer } = shop();
  worker.skills = [];
  assert.throws(
    () =>
      act(w, farmer.id, {
        type: 'butcher',
        building: b.id,
        operation: 'slaughter',
        item: 'chickens',
        quantity: 1,
      }),
    /qualified butcher/,
  );
  const school = makeBuilding('school', 'school', 0, 0);
  w.buildings.push(school);
  Object.assign(worker, { x: 0, z: 0, cash: 100000 });
  act(w, worker.id, { type: 'learn', building: school.id, skill: 'butcher' });
  advance(w, worker.learning!.end - w.time);
  assert.ok(worker.skills.includes('butcher'));
  act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'chickens',
    quantity: 1,
  });
  assert.equal(farmer.task?.kind, 'slaughter');
});
test('meat output room is checked again on completion and an airborne driver cannot use a parked wagon', () => {
  const { w, b, farmer } = shop();
  act(w, farmer.id, {
    type: 'butcher',
    building: b.id,
    operation: 'slaughter',
    item: 'chickens',
    quantity: 1,
  });
  farmer.inventory.stone = 100;
  advance(w, 30);
  assert.equal(farmer.inventory.chickens, 1);
  assert.equal(farmer.inventory.poultry, undefined);
  farmer.inventory = {};
  farmer.y = 500;
  farmer.vehicle = 2;
  w.trailers = {
    wagon: {
      id: 'wagon',
      owner: farmer.id,
      kind: 'livestock',
      ...butcherRamp(b),
      heading: 0,
      cargo: { cows: 1 },
    },
  };
  assert.throws(
    () =>
      act(w, farmer.id, {
        type: 'butcher',
        building: b.id,
        operation: 'slaughter',
        item: 'cows',
        quantity: 1,
        storage: 'trailer',
        trailer: 'wagon',
      }),
    /Land the aircraft/i,
  );
});
test('NPC chain knowledge includes all meat menus and world yields drive pricing and diagnostics', async () => {
  const { recipeGraph, kindRecipe } = await import('../src/server/npc/chains');
  const { sustainableAsk } = await import('../src/server/npc/pricing');
  const { businessHealth } = await import('../src/shared/business-health');
  const { productionDiagnostics } = await import('../src/shared/world-catalogue');
  const { w, b } = shop();
  const graph = recipeGraph(w);
  for (const raw of ['beef', 'pork', 'mutton', 'poultry'])
    assert.ok(graph[raw].producerKinds.includes('butcher'), raw);
  for (const meal of ['beefStew', 'porkSupper', 'muttonPie', 'roastChicken', 'steak', 'pubMeatPie'])
    assert.ok(graph[meal].producerKinds.includes('kitchen'), meal);
  const baseline = sustainableAsk(w, b, 'beef')!;
  w.settings.beefYield = 24;
  assert.equal(kindRecipe(w, 'butcher')!.outputs.beef, 24);
  assert.ok(sustainableAsk(w, b, 'beef')! < baseline * 0.6);
  b.stock = { cows: 1, beef: 480 };
  assert.equal(businessHealth(w, b).outputRoom, 0);
  assert.equal(productionDiagnostics(w, b).outputValue, b.sell.beef * 24);
  w.settings.butchersEnabled = false;
  assert.ok(!recipeGraph(w).beef.producerKinds.includes('butcher'));
});
test('NPC sales of configured slaughter by-products remain business proceeds', async () => {
  const { recordBusinessFreight } = await import('../src/server/npc/business-freight');
  const { w, b, owner } = shop();
  Object.assign(owner, butcherRamp(b));
  owner.inventory = {};
  w.settings.slaughterCompostYield = 3;
  b.stock = { compost: 3 };
  const state = {} as import('../src/server/npc/memory').ResidentState;
  const before = structuredClone(w),
    a = { type: 'stock', building: b.id, direction: 'withdraw', item: 'compost', quantity: 3 };
  act(w, owner.id, a);
  recordBusinessFreight(before, w, owner, state, a);
  assert.deepEqual(state.businessCargo, [{ building: b.id, item: 'compost', quantity: 3 }]);
});

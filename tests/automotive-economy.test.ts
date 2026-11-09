// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { automotiveExportQuote } from '../src/shared/automotive-exports';
import { automotiveConfig } from '../src/shared/automotive-config';

function setup() {
  const w = createWorld('automotive-economy', 'Factory economy', 'owner');
  w.towns = [];
  const p = addPlayer(w, 'owner', 'Factory owner');
  p.x = p.z = 0;
  const b = makeBuilding('factory', 'automotiveFactory', 0, 0);
  b.owner = p.id;
  b.investment = 0;
  b.manufacturing = {
    orders: [],
    ready: [{ id: 'completed:1', product: 'tractor', completedAt: 0 }],
  };
  w.buildings = [b];
  return { w, p, b };
}
const sell = (
  w: ReturnType<typeof createWorld>,
  building = 'factory',
  unit = 'completed:1',
  price = 4_800_000,
  player = 'owner',
) => act(w, player, { type: 'manufacturing', building, op: 'export', unit, expectedPrice: price });

test('external buyers pay for one real manufactured unit with tax, without granting a vehicle or treasury subsidy', () => {
  const { w, p, b } = setup(),
    cash = p.cash,
    fleet = structuredClone(p.fleet);
  sell(w);
  assert.equal(b.manufacturing!.ready.length, 0);
  assert.equal(b.investment, 4_800_000 * (1 - w.settings.salesTax));
  assert.equal(p.cash, cash);
  assert.deepEqual(p.fleet, fleet);
  assert.equal(b.accounts?.sold['automotive:tractor'], 1);
  assert.ok(
    w.ledger.some(
      (e) => e.kind === 'faucet' && e.reason === 'vehicle export' && e.amount === 4_800_000,
    ),
  );
  assert.throws(() => sell(w), /stock/i);
});

test('export demand is shared, rolling, persisted, and cannot be banked or inflated through local prices', async () => {
  const { w, b } = setup();
  b.manufacturing!.prices = { tractor: 100_000_000 };
  sell(w);
  const second = makeBuilding('second', 'automotiveFactory', 0, 0);
  second.owner = 'owner';
  second.manufacturing = {
    orders: [],
    ready: [{ id: 'completed:2', product: 'box', completedAt: 0 }],
  };
  w.buildings.push(second);
  const before = structuredClone(w);
  assert.throws(() => sell(w, 'second', 'completed:2', 2_240_000), /demand/i);
  assert.deepEqual(w, before);
  const { Store } = await import('../src/server/store');
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    assert.throws(() => sell(restored, 'second', 'completed:2', 2_240_000), /demand/i);
    restored.time += 21600;
    sell(restored, 'second', 'completed:2', 2_240_000);
    restored.time += 21600 * 100;
    restored.buildings[0].manufacturing!.ready.push(
      { id: 'late', product: 'tractor', completedAt: restored.time },
      { id: 'late2', product: 'tractor', completedAt: restored.time },
    );
    sell(restored, 'factory', 'late');
    assert.throws(() => sell(restored, 'factory', 'late2'), /demand/i);
  } finally {
    store.close();
  }
});

test('export refusals and invalid rules are atomic; custom rules are portable without private demand history', async () => {
  const { w, b } = setup();
  addPlayer(w, 'other', 'Other');
  w.players.other.x = w.players.other.z = 0;
  for (const [price, player, pattern] of [
    [1, 'owner', /quote|price/i],
    [4_800_000, 'other', /owner/i],
  ] as const) {
    const before = structuredClone(w);
    assert.throws(() => sell(w, 'factory', 'completed:1', price, player), pattern);
    assert.deepEqual(w, before);
  }
  act(w, 'owner', { type: 'automotiveConfig', patch: { exports: { enabled: false } } });
  const before = structuredClone(w);
  assert.throws(() => sell(w), /disabled/i);
  assert.deepEqual(w, before);
  assert.throws(() =>
    act(w, 'owner', { type: 'automotiveConfig', patch: { exports: { priceFraction: 1.1 } } }),
  );
  assert.deepEqual(w, before);
  act(w, 'owner', {
    type: 'automotiveConfig',
    patch: { exports: { enabled: true, interval: 43200, units: 2, priceFraction: 0.7 } },
  });
  sell(w, 'factory', 'completed:1', 4_200_000);
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const target = createWorld('export-import', 'Imported', 'new-owner');
  applyDesign(target, exportDesign(w));
  assert.deepEqual(automotiveConfig(target), automotiveConfig(w));
  assert.equal((target as any).automotiveExports, undefined);
  assert.equal(b.manufacturing!.ready.length, 0);
});

test('resident owners reserve finite automotive inputs and payroll, then queue and export through ordinary actions', async () => {
  const { procurementTarget, productionBudget, ownerRoutine } =
    await import('../src/server/npc/business-policy');
  const { operationAction } = await import('../src/server/npc/player-operations');
  const { advance } = await import('../src/shared/simulation');
  const { w, p, b } = setup();
  b.manufacturing = { orders: [], ready: [] };
  p.cash = 20_000_000;
  Object.assign(w.settings, { activeWork: false, hungerRate: 0, thirstRate: 0 });
  assert.ok(procurementTarget(w, b, 'steel') > 0, 'The factory is a real input consumer');
  const budget = productionBudget(w, b);
  assert.ok(
    budget && budget.idealMargin > 0 && budget.reserve > 0,
    'Protect actual materials and payroll',
  );
  b.stock = { steel: 120, electronics: 8, tools: 8, wood: 60, fuel: 20 };
  b.investment = 10_000_000;
  const execute = (plan: import('../src/server/npc/decision').Step[]) => {
    for (const step of plan) {
      if (step.kind === 'travel') {
        const target = w.buildings.find((v) => v.id === step.destination)!;
        p.x = target.x;
        p.z = target.z;
      }
      if (step.kind === 'act') act(w, p.id, step.action);
      if (step.kind === 'operation') act(w, p.id, operationAction(step));
    }
  };
  execute(ownerRoutine(w, p));
  assert.equal(
    b.manufacturing.orders.length,
    1,
    'Owner queues actual assembly, not an automatic recipe',
  );
  assert.equal(
    procurementTarget(w, b, 'steel'),
    0,
    'Do not buy another rig while stock is backed up',
  );
  for (let i = 0; i < 6; i++) {
    const q = addPlayer(w, 'crew-' + i, 'Engineer');
    q.skills = ['engineer'];
    q.x = q.z = 0;
    act(w, q.id, { type: 'job', building: b.id });
  }
  advance(w, b.manufacturing.orders[0].seconds);
  assert.equal(b.manufacturing.ready.length, 1);
  execute(ownerRoutine(w, p));
  assert.equal(b.manufacturing.ready.length, 0, 'Owner sells only a real completed unit');
  assert.ok(w.ledger.some((e) => e.reason === 'vehicle export'));
  assert.equal(
    procurementTarget(w, b, 'steel'),
    0,
    'Exhausted external demand pauses speculative input buying',
  );
});

test('resident purchase choices spend real cash for finite units and disappear when unaffordable or already owned', async () => {
  const { economyChoices } = await import('../src/server/npc/economy-choices');
  const { operationAction } = await import('../src/server/npc/player-operations');
  const { w, b } = setup();
  w.zones = [];
  w.towns = [];
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  w.settings.seaLevel = -100;
  const buyer = addPlayer(w, 'buyer', 'Haulier');
  Object.assign(buyer, {
    x: 0,
    z: 17,
    y: 20,
    vehicle: 5,
    cash: 20_000_000,
    skills: ['driver'],
    inventory: {},
  });
  const mill = makeBuilding('mill', 'sawmill', 100, 0);
  mill.owner = buyer.id;
  w.buildings.push(mill);
  const choices = () => {
    const result: { description: string; plan: import('../src/server/npc/decision').Step[] }[] = [];
    economyChoices(
      w,
      buyer,
      w.buildings,
      (description, plan) => result.push({ description, plan }),
      (_b, steps) => steps,
    );
    return result;
  };
  const purchase = choices().find((c) =>
    c.plan.some(
      (s) =>
        s.kind === 'operation' &&
        s.operation === 'manufacturing' &&
        s.parameters.some((v) => v.name === 'op' && v.value === 'buy'),
    ),
  );
  assert.ok(purchase, 'An affordable existing haulier can choose a manufactured truck');
  const cash = buyer.cash;
  for (const step of purchase.plan)
    if (step.kind === 'operation') act(w, buyer.id, operationAction(step));
  assert.equal(buyer.cash, cash - automotiveConfig(w).products.tractor.price);
  assert.ok(buyer.fleet?.includes(37));
  assert.equal(b.manufacturing!.ready.length, 0);
  b.manufacturing!.ready.push({ id: 'second-truck', product: 'tractor', completedAt: w.time });
  assert.ok(!choices().some((c) => c.description.includes('Buy manufactured')));
  buyer.fleet = [0, 5];
  buyer.cash = 0;
  assert.ok(!choices().some((c) => c.description.includes('Buy manufactured')));
});

test('resident supplier plans use finite paid stock and worker choices activate reserved assembly', async () => {
  const { economyChoices } = await import('../src/server/npc/economy-choices');
  const { operationAction } = await import('../src/server/npc/player-operations');
  const { procurementTarget } = await import('../src/server/npc/business-policy');
  const { w, p, b } = setup();
  b.manufacturing = { orders: [], ready: [] };
  p.cash = 20_000_000;
  b.investment = 1_000_000;
  p.inventory = {};
  p.vehicle = 0;
  const supplier = makeBuilding('steel', 'forge', 0, 0);
  supplier.owner = 'supplier';
  supplier.stock = { steel: 10 };
  supplier.sell = { steel: 22000 };
  w.buildings.push(supplier);
  const choices = (who = p) => {
    const list: { description: string; plan: import('../src/server/npc/decision').Step[] }[] = [];
    economyChoices(
      w,
      who,
      w.buildings,
      (description, plan) => list.push({ description, plan }),
      (_b, s) => s,
    );
    return list;
  };
  const choice = choices().find(
    (c) => c.description.startsWith('Supply my') && c.description.includes('steel'),
  );
  assert.ok(choice, 'Observed upstream stock is offered as a real supply trip');
  const cash = p.cash;
  for (const s of choice.plan) {
    if (s.kind === 'act') act(w, p.id, s.action);
    if (s.kind === 'operation') act(w, p.id, operationAction(s));
  }
  assert.equal(supplier.stock.steel, 0);
  assert.equal(b.stock.steel, 10);
  assert.equal(p.cash, cash - 220000);
  assert.ok(
    !choices().some(
      (c) => c.description.startsWith('Supply my') && c.description.includes('steel'),
    ),
    'No invented replacement supplier stock',
  );
  b.stock = { ...automotiveConfig(w).products.tractor.inputs };
  act(w, p.id, { type: 'manufacturing', building: b.id, op: 'queue', product: 'tractor' });
  const worker = addPlayer(w, 'engineer', 'Resident engineer');
  worker.x = worker.z = 0;
  worker.skills = ['engineer'];
  const job = choices(worker).find((c) => c.description.startsWith('Accept employment'));
  assert.ok(job, 'Assembly vacancies are ordinary resident employment choices');
  for (const s of job.plan) if (s.kind === 'act') act(w, worker.id, s.action);
  assert.equal(worker.job, b.id);
  assert.ok(worker.activeUntil > w.time);
  assert.equal(procurementTarget(w, b, 'steel'), 0);
  act(w, p.id, { type: 'automotiveConfig', patch: { enabled: false } });
  assert.equal(procurementTarget(w, b, 'steel'), 0);
});

test('resident observations describe actual finished units and quotes without advertising assembly as automatic cargo production', async () => {
  const { observe } = await import('../src/server/npc/observation');
  const { w, p, b } = setup();
  const observation = observe(
    w,
    p,
    { plan: [], index: 0, intent: 'factory', notebook: '' } as any,
    { recent: () => [], conversation: () => [] } as any,
    'resident',
  );
  const known = observation.nearbyBuildings.find((v: any) => v.id === b.id) as any;
  assert.equal(known.manufacturing.ready[0].id, 'completed:1');
  assert.equal(known.manufacturing.ready[0].price, 6_000_000);
  assert.equal(known.manufacturing.ready[0].export.price, 4_800_000);
  assert.equal(known.recipe, undefined);
});

test('the NPC supply graph includes automotive inputs without inventing pocket-cargo vehicle outputs', async () => {
  const { recipeGraph } = await import('../src/server/npc/chains');
  const { w } = setup(),
    graph = recipeGraph(w);
  assert.ok(graph.steel.consumerKinds.includes('automotiveFactory'));
  assert.ok(graph.electronics.consumerKinds.includes('automotiveFactory'));
  assert.equal(graph['automotive:tractor'], undefined);
});

test('resident trailer operations and freight trades preserve ordinary ownership and cargo checks', async () => {
  const { operation, operationAction } = await import('../src/server/npc/player-operations');
  const { w, p, b } = setup();
  w.trailers = {
    private: {
      id: 'private',
      owner: 'someone-else',
      kind: 'semiBox',
      x: 0,
      z: 0,
      heading: 0,
      cargo: { steel: 10 },
    },
  };
  const step = operation('trailer' as any, {
    operation: 'unload',
    id: 'private',
    item: 'steel',
    quantity: 1,
  });
  const before = structuredClone(w);
  assert.throws(() => act(w, p.id, operationAction(step as any)), /own|trailer/i);
  assert.deepEqual(w, before);
  const trade = operation('trade' as any, {
    building: b.id,
    direction: 'sell',
    item: 'steel',
    quantity: 1,
    storage: 'trailer',
    trailer: 'private',
  });
  assert.throws(() => act(w, p.id, operationAction(trade as any)), /own|trailer|stockroom/i);
  assert.deepEqual(w, before);
});

test('the next collection time respects a reduced world limit without resetting consumed places', () => {
  const { w, b } = setup();
  act(w, 'owner', { type: 'automotiveConfig', patch: { exports: { units: 3 } } });
  for (let i = 0; i < 3; i++) {
    w.time = i * 100;
    b.manufacturing!.ready = [{ id: 'completed:1', product: 'tractor', completedAt: w.time }];
    sell(w);
  }
  act(w, 'owner', { type: 'automotiveConfig', patch: { exports: { units: 1 } } });
  const quote = automotiveExportQuote(w, 'tractor');
  assert.equal(quote.available, 0);
  assert.equal(quote.nextIn, 21600, 'A place returns only after enough old collections expire');
  b.manufacturing!.ready = [{ id: 'completed:1', product: 'tractor', completedAt: w.time }];
  w.time = 21600;
  assert.throws(() => sell(w), /demand/i);
  w.time = 200 + quote.nextIn;
  sell(w);
});

test('resident input bids cannot borrow profitability from a different product that does not use the input', async () => {
  const { inputBidQuote } = await import('../src/server/npc/business-policy');
  const { automotiveProduction } = await import('../src/server/npc/automotive-policy');
  const { w, p, b } = setup();
  b.manufacturing = { orders: [], ready: [] };
  p.vehicle = 0;
  p.fuel = 100;
  const supplier = makeBuilding('electronics-supplier', 'warehouse', 0, 0);
  supplier.stock = { electronics: 20 };
  supplier.sell = { electronics: 30_000 };
  w.buildings.push(supplier);
  assert.ok(automotiveProduction(w, b)?.recipe.inputs.electronics);
  assert.ok(
    inputBidQuote(w, p, b, 'electronics'),
    'Affordable observed electronics can be bid for',
  );
  supplier.sell.electronics = 1_000_000;
  assert.equal(
    inputBidQuote(w, p, b, 'electronics'),
    undefined,
    'An unrelated profitable box/stake recipe cannot justify buying unusable electronics',
  );
});

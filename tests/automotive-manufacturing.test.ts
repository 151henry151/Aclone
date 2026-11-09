// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../src/shared/simulation';
import { worldBuildings } from '../src/shared/world-catalogue';

function setup() {
  const w = createWorld('automotive-test', 'Manufacturing', 'owner');
  Object.assign(w.settings, { activeWork: false, hungerRate: 0, thirstRate: 0 });
  w.towns = [];
  const owner = addPlayer(w, 'owner', 'Founder');
  const b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
  b.owner = owner.id;
  b.stock = {};
  b.investment = 1_000_000;
  w.buildings = [b];
  owner.x = owner.z = 0;
  return { w, owner, b };
}
const queue = (w: ReturnType<typeof createWorld>, product = 'tractor') =>
  act(w, 'owner', { type: 'manufacturing', building: 'assembly', op: 'queue', product });
function supply(b: ReturnType<typeof makeBuilding>) {
  b.stock = { steel: 120, electronics: 8, tools: 8, wood: 20, fuel: 20 };
}
function hire(w: ReturnType<typeof createWorld>, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const p = addPlayer(w, 'worker-' + i, 'Engineer');
    Object.assign(p, { x: 0, z: 0, skills: ['engineer'] });
    act(w, p.id, { type: 'job', building: 'assembly' });
    return p;
  });
}

test('automotive premises have the calculated bill, no free products, and world-local construction overrides', () => {
  const w = createWorld('auto-rules', 'Rules', 'owner');
  addPlayer(w, 'owner', 'Founder');
  const def = worldBuildings(w).automotiveFactory;
  assert.ok(def, 'Automotive factory is a distinct constructible industry');
  assert.equal(def.price, 16_000_000);
  assert.deepEqual(def.materials, { steel: 400, wood: 600, gravel: 1600, electronics: 20 });
  assert.deepEqual(def.stock, {});
  act(w, 'owner', { type: 'automotiveConfig', patch: { factory: { price: 20_000_000 } } });
  assert.equal(worldBuildings(w).automotiveFactory.price, 20_000_000);
  const before = structuredClone(w);
  assert.throws(() =>
    act(w, 'owner', { type: 'automotiveConfig', patch: { factory: { price: -1 } } }),
  );
  assert.deepEqual(w, before, 'Invalid override must not partly mutate the world');
});

test('a queued unit reserves its inputs and payroll exactly once and rejects absent inputs or capital atomically', () => {
  const { w, b } = setup();
  const before = structuredClone(b);
  assert.throws(() => queue(w), /Steel|steel|inputs/i);
  assert.deepEqual(b, before);
  supply(b);
  b.investment = 0;
  const unfunded = structuredClone(b);
  assert.throws(() => queue(w), /capital|payroll|investment/i);
  assert.deepEqual(b, unfunded);
  b.investment = 1_000_000;
  queue(w);
  assert.equal(b.investment, 1_000_000 - 6 * 26_400);
  for (const n of Object.values(b.stock)) assert.equal(n, 0);
  assert.equal((b as any).manufacturing.orders.length, 1);
  assert.equal((b as any).manufacturing.ready.length, 0);
  const queued = structuredClone(b);
  assert.throws(() => queue(w), /Steel|steel|inputs/i);
  assert.deepEqual(b, queued);
});

test('manufacture requires actual staffed elapsed work, ignores offline efficiency and does not complete at an unrelated global boundary', () => {
  const { w, b } = setup();
  supply(b);
  w.time = 7199;
  queue(w);
  advance(w, 1);
  advance(w, 7200);
  assert.equal((b as any).manufacturing.orders[0].worked, 0);
  assert.equal((b as any).manufacturing.ready.length, 0);
  const workers = hire(w),
    balances = workers.map((p) => p.cash);
  advance(w, 7199);
  assert.equal((b as any).manufacturing.ready.length, 0);
  advance(w, 1);
  assert.equal((b as any).manufacturing.orders.length, 0);
  assert.equal((b as any).manufacturing.ready.length, 1);
  assert.equal((b as any).manufacturing.ready[0].product, 'tractor');
  workers.forEach((p, i) => assert.equal(p.cash - balances[i], 26_400 * (1 - w.settings.wageTax)));
  assert.equal(b.accounts?.batches, 1);
  assert.deepEqual(b.accounts?.consumed, {
    steel: 120,
    electronics: 8,
    tools: 8,
    wood: 20,
    fuel: 20,
  });
});

test('half a crew takes twice as long, and restart plus later rule changes cannot reprice an already reserved order', () => {
  const { w, b } = setup();
  supply(b);
  queue(w);
  const workers = hire(w, 3),
    initialCash = workers[0].cash;
  advance(w, 7200);
  assert.equal((b as any).manufacturing.orders[0].worked, 3600);
  const saved = JSON.parse(JSON.stringify(w));
  act(saved, 'owner', {
    type: 'automotiveConfig',
    patch: { products: { tractor: { seconds: 10, inputs: { steel: 1 } } } },
  });
  advance(saved, 7199);
  const restored = saved.buildings[0];
  assert.equal(restored.manufacturing.ready.length, 0);
  advance(saved, 1);
  assert.equal(restored.manufacturing.ready.length, 1);
  assert.equal(restored.manufacturing.orders.length, 0);
  assert.equal(
    saved.players[workers[0].id].cash - initialCash,
    26_400 * (1 - w.settings.wageTax),
    'Wages remain per completed batch, like existing industries',
  );
});

test('cancelling untouched work restores exactly its reservation, while started work and other owners are refused', () => {
  const { w, b } = setup();
  supply(b);
  const inputs = { ...b.stock },
    investment = b.investment;
  queue(w);
  const order = (b as any).manufacturing.orders[0].id;
  const outsider = addPlayer(w, 'outsider', 'Neighbour');
  outsider.x = outsider.z = 0;
  const cancel = (id = 'owner') =>
    act(w, id, { type: 'manufacturing', op: 'cancel', building: b.id, order });
  assert.throws(() => cancel('outsider'), /owner|own/i);
  cancel();
  assert.equal(b.investment, investment);
  assert.deepEqual(b.stock, inputs);
  assert.throws(() => cancel(), /order/i);
  queue(w);
  hire(w);
  advance(w, 1);
  const state = structuredClone(b);
  assert.throws(
    () =>
      act(w, 'owner', {
        type: 'manufacturing',
        op: 'cancel',
        building: b.id,
        order: (b as any).manufacturing.orders[0].id,
      }),
    /started/i,
  );
  assert.deepEqual(b, state);
});

test('manufacturing configuration is portable without copying private paid work orders', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, b } = setup();
  supply(b);
  queue(w);
  act(w, 'owner', {
    type: 'automotiveConfig',
    patch: { products: { tractor: { seconds: 9000 } }, factory: { readyCapacity: 2 } },
  });
  const design = exportDesign(w);
  const target = createWorld('auto-import', 'Imported', 'new-owner');
  applyDesign(target, design);
  assert.deepEqual((target as any).automotive, (w as any).automotive);
  assert.equal((target.buildings[0] as any).manufacturing, undefined);
});

test('factory staffing management works and occupied assembly cannot be silently demolished', () => {
  const { w, b } = setup();
  act(w, 'owner', { type: 'staffing', building: b.id, limit: 3 });
  assert.equal(b.hiringLimit, 3);
  supply(b);
  queue(w);
  const before = structuredClone(w);
  assert.throws(
    () => act(w, 'owner', { type: 'demolish', building: b.id }),
    /assembly|manufactur|orders/i,
  );
  assert.deepEqual(w, before);
});

test('portable automotive rules reject unknown inputs and professions and retain referenced custom goods', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, owner } = setup();
  act(w, owner.id, { type: 'automotiveConfig', patch: { factory: { readyCapacity: 2 } } });
  const d = exportDesign(w);
  d.automotive.products.tractor.inputs = { missingSteel: 1 };
  const target = createWorld('bad-design', 'Bad', 'new-owner'),
    before = structuredClone(target);
  assert.throws(() => applyDesign(target, d), /Unknown.*item/i);
  assert.deepEqual(target, before);
  const { setCatalogue } = await import('../src/shared/world-catalogue');
  setCatalogue(w, owner, { items: { 'custom:rivet': { name: 'Rivet', weight: 1, price: 100 } } });
  act(w, owner.id, {
    type: 'automotiveConfig',
    patch: { products: { tractor: { inputs: { 'custom:rivet': 2 } } } },
  });
  assert.throws(() => setCatalogue(w, owner, { items: {} }), /used|referenced/i);
});

test('ready slots, disabled production, unfinished sites and expired shifts conserve reservations', () => {
  const { w, b } = setup();
  supply(b);
  queue(w);
  act(w, 'owner', { type: 'automotiveConfig', patch: { factory: { readyCapacity: 1 } } });
  supply(b);
  assert.throws(() => queue(w), /full/i);
  const crew = hire(w);
  w.settings.activeWork = true;
  for (const p of crew) p.activeUntil = w.time + 100;
  advance(w, 200);
  assert.equal(b.manufacturing!.orders[0].worked, 100);
  act(w, 'owner', { type: 'automotiveConfig', patch: { enabled: false } });
  advance(w, 100);
  assert.equal(b.manufacturing!.orders[0].worked, 100);
  act(w, 'owner', { type: 'automotiveConfig', patch: { enabled: true } });
  w.settings.activeWork = false;
  b.construction = { steel: 1 };
  advance(w, 100);
  assert.equal(b.manufacturing!.orders[0].worked, 100);
  assert.throws(() => queue(w), /construction/i);
});

test('factory work prompts describe reserved elapsed assembly rather than global production checks', async () => {
  const { workShift } = await import('../src/client/work-shift');
  const { w, b } = setup();
  supply(b);
  queue(w);
  const [worker] = hire(w, 1);
  const shift = workShift(w, worker, b);
  assert.ok(shift);
  assert.match(shift.detail, /assembly/i);
  assert.doesNotMatch(shift.detail, /Next check|production checks/i);
});

test('public factory status reports idle and actual qualified crew efficiency', async () => {
  const { publicBuildings } = await import('../src/server/snapshots');
  const { w, b } = setup();
  assert.equal(publicBuildings(w)[0].efficiency, 0);
  supply(b);
  queue(w);
  hire(w, 3);
  assert.equal(publicBuildings(w)[0].efficiency, 0.5);
  assert.equal(publicBuildings(w)[0].staffing?.active, 3);
  assert.doesNotMatch(
    publicBuildings(w)[0].productionStatus.join(' '),
    /No automatic production recipe/,
  );
});

test('template crew overrides apply to new orders and reserved crew requirements survive later world edits', async () => {
  const { setCatalogue } = await import('../src/shared/world-catalogue');
  const { idealEmployees, recommendedHiringLimit } = await import('../src/shared/staffing');
  const { w, b, owner } = setup();
  setCatalogue(w, owner, {
    templates: {
      'custom:assembly': {
        name: 'Local assembly',
        base: 'automotiveFactory',
        price: 16_000_000,
        wage: 26_400,
        idealEmployees: 4,
        materials: {},
        buy: {},
        sell: {},
      },
    },
  });
  b.templateId = 'custom:assembly';
  supply(b);
  queue(w);
  assert.equal(b.manufacturing!.orders[0].idealEmployees, 4);
  assert.equal(b.manufacturing!.orders[0].payroll, 4 * b.wage);
  setCatalogue(w, owner, {
    templates: {
      'custom:assembly': {
        ...w.catalogue!.templates['custom:assembly'],
        idealEmployees: 2,
      },
    },
  });
  assert.equal(idealEmployees(w, b), 4);
  assert.equal(recommendedHiringLimit(w, b), 4);
});

test('automotive templates and portable premises cannot bypass reserved manufacturing with automatic recipes', async () => {
  const { setCatalogue } = await import('../src/shared/world-catalogue');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, owner } = setup();
  const production = {
    inputs: { steel: 1 },
    outputs: { tools: 1 },
    seconds: 10,
    skill: 'engineer',
    tier: 0,
  };
  const before = structuredClone(w);
  assert.throws(
    () =>
      setCatalogue(w, owner, {
        templates: {
          'custom:assembly': {
            name: 'Assembly',
            base: 'automotiveFactory',
            price: 100,
            wage: 0,
            materials: {},
            production,
          },
        },
      }),
    /assembly|manufactur/i,
  );
  assert.deepEqual(w, before);
  const design = exportDesign(w);
  design.buildings[0].production = production;
  const target = createWorld('unsafe-assembly', 'Target', 'owner'),
    initial = structuredClone(target);
  assert.throws(() => applyDesign(target, design), /assembly|manufactur/i);
  assert.deepEqual(target, initial);
});

test('all four products survive SQLite restart and fragmented work without duplicate output or wages', async () => {
  const { Store } = await import('../src/server/store');
  const { automotiveConfig, automotiveProducts } = await import('../src/shared/automotive-config');
  const { w, b } = setup();
  for (const product of automotiveProducts) {
    for (const [id, n] of Object.entries(automotiveConfig(w).products[product].inputs))
      b.stock[id] = (b.stock[id] ?? 0) + n;
    queue(w, product);
  }
  hire(w);
  advance(w, 3571);
  const state = structuredClone(b.manufacturing),
    store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    assert.deepEqual(restored.buildings[0].manufacturing, state);
    const baseline = structuredClone(restored);
    advance(baseline, 20000);
    for (let i = 0; i < 200; i++) advance(restored, 100);
    const result = restored.buildings[0].manufacturing!;
    assert.equal(result.orders.length, 0);
    assert.deepEqual(
      result.ready.map((u) => u.product),
      automotiveProducts,
    );
    assert.equal(new Set(result.ready.map((u) => u.id)).size, 4);
    assert.deepEqual(result, baseline.buildings[0].manufacturing);
    for (const p of Object.values(restored.players))
      assert.equal(p.cash, baseline.players[p.id].cash);
    const cash = restored.players['worker-0'].cash;
    advance(restored, 20000);
    assert.equal(result.ready.length, 4);
    assert.equal(restored.players['worker-0'].cash, cash);
  } finally {
    store.close();
  }
});

test('factory estates value reserved inputs and payroll and obey retained versus cleared contents', async () => {
  const { propertyQuote } = await import('../src/shared/property');
  const { items } = await import('../src/shared/catalog');
  const { automotiveConfig } = await import('../src/shared/automotive-config');
  for (const retain of [true, false]) {
    const { w, b, owner } = setup();
    Object.assign(w.settings, {
      retainEstateContents: retain,
      losePropertyOnDeath: true,
      estateEquityShare: 0.9,
    });
    supply(b);
    queue(w);
    const order = b.manufacturing!.orders[0];
    const expectedInputs = Object.entries(order.inputs).reduce(
      (sum, [id, n]) => sum + items[id].price * n,
      0,
    );
    assert.equal(propertyQuote(w, b).equity, b.investment + order.payroll + expectedInputs);
    const workers = hire(w),
      cash = workers[0].cash;
    advance(w, 3600);
    w.settings.jobsEnabled = false;
    owner.health = 1;
    owner.hunger = owner.thirst = 50000;
    advance(w, 1);
    assert.equal(b.owner, undefined);
    if (retain) {
      assert.equal(b.manufacturing!.orders.length, 1);
      const buyer = addPlayer(w, 'buyer', 'New owner');
      Object.assign(buyer, { x: 0, z: 0, cash: 100_000_000 });
      act(w, buyer.id, { type: 'buyBuilding', building: b.id });
      w.settings.jobsEnabled = true;
      advance(w, 3600);
      assert.equal(b.manufacturing!.ready.length, 1);
      assert.equal(
        propertyQuote(w, b).equity,
        b.investment + automotiveConfig(w).products.tractor.price,
      );
      assert.equal(workers[0].cash - cash, 26400 * (1 - w.settings.wageTax));
    } else {
      assert.equal(b.manufacturing, undefined);
      assert.equal(b.investment, 0);
      assert.equal(workers[0].cash - cash, 13200 * (1 - w.settings.wageTax));
    }
  }
});

test('factory unlock tier is configurable and imported fresh premises use world wages, storage and bids', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, b } = setup();
  act(w, 'owner', {
    type: 'automotiveConfig',
    patch: { factory: { tier: 4, wage: 12500, capacity: 5000, buy: { steel: 27000 } } },
  });
  assert.equal(worldBuildings(w).automotiveFactory.tier, 4);
  const d = exportDesign(w);
  // A reusable premises description may omit local economy overrides.
  const { wage: _wage, buy: _buy, ...premises } = d.buildings[0];
  const target = createWorld('new-assembly', 'New', 'new-owner');
  applyDesign(target, { ...d, buildings: [premises] });
  assert.equal(target.buildings[0].wage, 12500);
  assert.equal(target.buildings[0].capacity, 5000);
  assert.deepEqual(target.buildings[0].buy, { steel: 27000 });
  assert.equal(b.wage, 26400, 'Existing owned wages are not rewritten');
});

test('resident job advice recognizes reserved assembly payroll and elapsed work rather than asking for supplies twice', async () => {
  const { workplace, shiftBlocker } = await import('../src/server/npc/workplace');
  const { w, b } = setup();
  supply(b);
  b.investment = 6 * b.wage;
  queue(w);
  hire(w, 5);
  const p = addPlayer(w, 'applicant', 'Engineer');
  Object.assign(p, { x: 0, z: 0, skills: ['engineer'] });
  const report = workplace(w, p, b);
  assert.ok(report, 'An assembly job must be visible to resident job planning');
  assert.equal(report.mode, 'reserved assembly');
  assert.equal(report.canTakeJob, true);
  assert.equal(report.ifYouWork.capitalShortfall, 0, 'The payroll is already reserved');
  assert.deepEqual(report.blockers, []);
  assert.equal(shiftBlocker(w, p, b), undefined);
  assert.match(report.summary, /reserved/i);
  act(w, p.id, { type: 'job', building: b.id });
  advance(w, 3600);
  assert.equal(workplace(w, p, b)!.nextCycleInSeconds, 3600);
  advance(w, 3600);
  assert.match(shiftBlocker(w, p, b)!, /No assembly order/i);
});

test('factory statements label manufactured outputs as vehicles rather than internal cargo identifiers', async () => {
  const { statementHtml } = await import('../src/client/reports');
  const { w, b, owner } = setup();
  supply(b);
  queue(w);
  hire(w);
  advance(w, 7200);
  owner.statements = { [b.id]: b.accounts! };
  const { businessHealth } = await import('../src/shared/business-health');
  assert.equal(
    businessHealth(w, b).fundedReplacementBatches,
    null,
    'A vehicle recipe must be chosen before estimating replacement funding',
  );
  assert.equal(businessHealth(w, b).stockReferenceValue, 6_000_000);
  const html = statementHtml(w, owner, b);
  assert.match(html, /1 Highway tractor unit/);
  assert.match(html, /1 assembly orders completed/);
  assert.doesNotMatch(html, /automotive:tractor|automatic batches completed/);
});

test('assembly orders and economic rule edits preserve terrain caches while order IDs remain unique after cancellation and reload', () => {
  const { w, b } = setup(),
    revision = w.revision;
  supply(b);
  queue(w);
  const first = b.manufacturing!.orders[0].id;
  assert.equal(w.revision, revision, 'Reserving a vehicle must not invalidate scenery geometry');
  act(w, 'owner', { type: 'manufacturing', building: b.id, op: 'cancel', order: first });
  const loaded = structuredClone(w);
  queue(loaded);
  assert.notEqual(loaded.buildings[0].manufacturing!.orders[0].id, first);
  act(loaded, 'owner', { type: 'automotiveConfig', patch: { factory: { wage: 30000 } } });
  assert.equal(loaded.revision, revision, 'Factory prices and wages are not terrain edits');
});

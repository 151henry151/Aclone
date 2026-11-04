import { operationAction } from '../src/server/npc/player-operations';
import type { Trailer } from '../src/shared/trailers';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { fuelCapacity } from '../src/shared/tractors';
import { Store } from '../src/server/store';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { drivePlan } from '../src/server/npc/travel';
import { householdBudget } from '../src/server/npc/household';
import { worldItems } from '../src/shared/world-catalogue';

function setup() {
  const w = createWorld('fuel-sales', 'Fuel sales', 'owner');
  w.buildings = [];
  w.towns = [];
  w.roads = [];
  w.settings.mapSize = 500;
  w.settings.salesTax = 0;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(3),
  };
  const owner = addPlayer(w, 'owner', 'Owner'),
    buyer = addPlayer(w, 'buyer', 'Buyer');
  for (const p of [owner, buyer])
    Object.assign(p, {
      x: 0,
      z: -100,
      y: 3,
      online: true,
      vehicle: 0,
      speed: 0,
      engine: false,
      inventory: {},
      cash: 100000,
      bank: 1000,
      fuel: 0,
    });
  const t: Trailer = {
    id: 'trailer-1',
    kind: 'fuel' as const,
    owner: owner.id,
    x: 0,
    z: -105,
    heading: 0,
    cargo: { fuel: 20 },
    sellPrice: 5000,
  };
  w.trailers = { [t.id]: t };
  w.trailerSeq = 1;
  return { w, owner, buyer, t };
}
const pump = (id: string, quantity = 1) => ({
  type: 'fuelTrailer',
  operation: 'pump',
  id,
  quantity,
});
const buy = (id: string, quantity = 1) => ({ type: 'fuelTrailer', operation: 'buy', id, quantity });

test('tanker pumping consumes whole Fuel, caps the tank and pays only for consumed items', () => {
  const { w, buyer, owner, t } = setup();
  buyer.fuel = fuelCapacity(buyer, w) - 3;
  act(w, buyer.id, pump(t.id, 2));
  assert.equal(buyer.fuel, fuelCapacity(buyer, w));
  assert.equal(t.cargo.fuel, 19);
  assert.equal(buyer.cash, 95000);
  assert.equal(owner.cash, 105000);
  assert.equal(buyer.inventory.fuel, undefined);
  assert.ok(
    w.ledger.some(
      (e) =>
        e.from === buyer.id && e.to === owner.id && e.amount === 5000 && e.details?.quantity === 1,
    ),
  );
  const before = JSON.stringify(w);
  assert.throws(() => act(w, buyer.id, pump(t.id)), /full/i);
  assert.equal(JSON.stringify(w), before);
});
test('inventory sales withhold ordinary world and town tax at the tanker, and offline owners receive bank payments', () => {
  const { w, buyer, owner, t } = setup();
  const town = createWorld('source', 'Source', 'x').towns[0];
  Object.assign(town, {
    id: 'fuel-town',
    x: t.x,
    z: t.z,
    radius: 2, // The buyer is outside; only the tanker's location is taxed.
    salesTax: 0.05,
    treasury: 100,
  });
  w.towns = [town];
  w.settings.salesTax = 0.1;
  act(w, buyer.id, buy(t.id, 2));
  assert.equal(buyer.inventory.fuel, 2);
  assert.equal(buyer.cash, 90000);
  assert.equal(owner.cash, 108500);
  assert.equal(town.treasury, 600);
  assert.equal(t.cargo.fuel, 18);
  assert.ok(
    w.ledger.some((e) => e.reason === 'sales tax' && e.to === 'treasury' && e.amount === 1000),
  );
  owner.online = false;
  act(w, buyer.id, buy(t.id));
  assert.equal(owner.cash, 108500);
  assert.equal(owner.bank, 5250);
  assert.equal(town.treasury, 850);
});
test('owner controls the persistent price and uses its tanker free even when public sales are disabled', () => {
  const { w, owner, buyer, t } = setup();
  act(w, owner.id, { type: 'fuelTrailer', operation: 'price', id: t.id, price: 6250 });
  assert.equal(t.sellPrice, 6250);
  assert.throws(() =>
    act(w, buyer.id, { type: 'fuelTrailer', operation: 'price', id: t.id, price: 1 }),
  );
  act(w, owner.id, { type: 'fuelTrailer', operation: 'price', id: t.id, price: 0 });
  assert.throws(() => act(w, buyer.id, buy(t.id)), /sale|closed/i);
  w.settings.fuelTankerSales = false;
  const cash = owner.cash,
    ledgerCount = w.ledger.length;
  act(w, owner.id, pump(t.id, 2));
  assert.equal(owner.fuel, 16);
  assert.equal(owner.cash, cash);
  act(w, owner.id, buy(t.id, 3));
  assert.equal(owner.inventory.fuel, 3);
  assert.equal(t.cargo.fuel, 15);
  assert.equal(w.ledger.length, ledgerCount);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world.trailers![t.id];
    assert.equal(saved.sellPrice, 0);
    assert.deepEqual(saved.cargo, { fuel: 15 });
    assert.equal(saved.attached, undefined);
  } finally {
    store.close();
  }
});
test('refused sales, invalid prices and invalid pumping states never mutate money, cargo, fuel or ledger', () => {
  const failures: ((f: ReturnType<typeof setup>) => void)[] = [
    ({ w }) => {
      w.settings.fuelTankerSales = false;
    },
    ({ w, owner }) => {
      owner.online = false;
      w.settings.fuelTankerOfflineSales = false;
    },
    ({ buyer }) => {
      buyer.cash = 1;
    },
    ({ t }) => {
      t.cargo.fuel = 0;
    },
    ({ t }) => {
      t.sellPrice = 0;
    },
    ({ t }) => {
      t.owner = 'missing';
    },
    ({ buyer }) => {
      buyer.online = false;
    },
    ({ buyer }) => {
      buyer.speed = 1;
    },
    ({ buyer }) => {
      buyer.x = 15;
    },
    ({ buyer }) => {
      buyer.y = 30;
    },
    ({ buyer }) => {
      buyer.atHome = true;
    },
    ({ buyer }) => {
      buyer.hitch = 'someone';
    },
    ({ buyer }) => {
      buyer.task = { kind: 'gather', end: 100, node: 'x' } as any;
    },
    ({ buyer }) => {
      buyer.vehicle = 5;
    },
    ({ owner, t }) => {
      t.attached = owner.id;
      owner.speed = 1;
    },
    ({ w, buyer }) => {
      buyer.fuel = fuelCapacity(buyer, w);
    },
  ];
  for (const change of failures) {
    const f = setup();
    change(f);
    const before = JSON.stringify(f.w);
    for (let i = 0; i < 2; i++) assert.throws(() => act(f.w, f.buyer.id, pump(f.t.id)));
    assert.equal(JSON.stringify(f.w), before);
  }
  for (const n of [0, -1, 1.5, 10001, NaN]) {
    const f = setup(),
      before = JSON.stringify(f.w);
    assert.throws(() => act(f.w, f.buyer.id, buy(f.t.id, n)));
    assert.equal(JSON.stringify(f.w), before);
  }
  for (const price of [-1, 1.5, 100000001, NaN]) {
    const f = setup(),
      before = JSON.stringify(f.w);
    assert.throws(() =>
      act(f.w, f.owner.id, { type: 'fuelTrailer', operation: 'price', id: f.t.id, price }),
    );
    assert.equal(JSON.stringify(f.w), before);
  }
  const f = setup();
  assert.throws(() => act(f.w, f.buyer.id, { ...buy(f.t.id), expectedPrice: 4999 }), /price/i);
  f.buyer.inventory.steel = 500;
  assert.throws(() => act(f.w, f.buyer.id, buy(f.t.id)), /full|capacity/i);
});
test('world rules govern tanker transaction caps, shop-relative prices and the shared refuelling distance', () => {
  const { w, buyer, t } = setup();
  const shop = makeBuilding('refinery', 'refinery', 100, 100);
  shop.sell = { fuel: 4000 };
  shop.stock = { fuel: 0 };
  w.buildings.push(shop);
  act(w, 'owner', {
    type: 'settings',
    patch: { fuelTankerTransactionLimit: 2, fuelTankerPriceCeiling: 1.2, refuelRange: 8 },
  });
  assert.throws(() => act(w, buyer.id, buy(t.id)), /ceiling|price/i);
  t.sellPrice = 4800;
  act(w, buyer.id, buy(t.id, 2));
  assert.throws(() => act(w, buyer.id, buy(t.id, 3)), /quantity|limit/i);
  buyer.z = -96;
  assert.throws(() => act(w, buyer.id, buy(t.id)), /8 metres/);
  for (const patch of [
    { fuelTankerTransactionLimit: 0 },
    { fuelTankerTransactionLimit: 1.5 },
    { fuelTankerPriceCeiling: -1 },
    { refuelRange: 0 },
  ])
    assert.throws(() => act(w, 'owner', { type: 'settings', patch }));
});
test('parked tanker design placements retain exact load and price without copying private owners or attached rigs', () => {
  const { w, t } = setup();
  w.trailers!['attached'] = { ...t, id: 'attached', attached: 'owner' };
  w.trailers!['liquid'] = { ...t, id: 'liquid', kind: 'tanker', cargo: { water: 5 } };
  t.cargo.fuel = 7;
  t.sellPrice = 4321;
  const design = exportDesign(w);
  assert.equal(design.parkedFuelTankers.length, 1);
  assert.equal(JSON.stringify(design.parkedFuelTankers).includes('owner'), false);
  const fresh = createWorld('import', 'Import', 'builder');
  applyDesign(fresh, design);
  assert.equal(fresh.trailers![t.id].owner, 'builder');
  assert.deepEqual(fresh.trailers![t.id].cargo, { fuel: 7 });
  assert.equal(fresh.trailers![t.id].sellPrice, 4321);
  assert.equal(Object.keys(fresh.trailers!).length, 1);
  for (const patch of [
    { cargo: { fuel: 701 } },
    { cargo: { water: 1 } },
    { sellPrice: -1 },
    { x: 1000000 },
  ]) {
    const d = structuredClone(design);
    Object.assign(d.parkedFuelTankers[0], patch);
    assert.throws(() => applyDesign(createWorld('bad', 'Bad', 'b'), d));
  }
  const d = structuredClone(design);
  d.parkedFuelTankers.push({ ...d.parkedFuelTankers[0] });
  assert.throws(() => applyDesign(createWorld('dup', 'Dup', 'b'), d));
});
test('normal NPC drive preparation chooses a fair nearby tanker only without a usable nearby shop and protects meals', () => {
  const { w, buyer, t } = setup();
  t.sellPrice = worldItems(w).fuel.price;
  const chosen = () =>
    drivePlan(w, buyer).filter((s) => s.kind === 'operation' && s.operation === 'fuelTrailer');
  assert.equal(chosen().length, 1);
  for (const step of drivePlan(w, buyer)) {
    if (step.kind === 'act') act(w, buyer.id, step.action);
    else if (step.kind === 'operation') act(w, buyer.id, operationAction(step));
  }
  assert.equal(buyer.inventory.fuel ?? 0, 0);
  assert.equal(buyer.fuel, 8);
  buyer.fuel = 0;
  t.sellPrice = worldItems(w).fuel.price * 2;
  assert.equal(chosen().length, 0);
  t.sellPrice = worldItems(w).fuel.price;
  const shop = makeBuilding('shop', 'refinery', 5, -100);
  shop.stock = { fuel: 1 };
  shop.sell = { fuel: t.sellPrice };
  w.buildings.push(shop);
  assert.equal(chosen().length, 0);
  shop.stock.fuel = 0;
  assert.equal(chosen().length, 1);
  w.settings.fuelTankerNpcPurchasing = false;
  assert.equal(chosen().length, 0);
  w.settings.fuelTankerNpcPurchasing = true;
  const budget = householdBudget(w, buyer);
  buyer.cash = budget.reserve - budget.fuel + t.sellPrice - 1;
  assert.equal(chosen().length, 0);
});

test('tanker and carried assistance share edited range and the world Fuel conversion', async () => {
  const { w, owner, buyer, t } = setup();
  act(w, owner.id, { type: 'settings', patch: { fuelUnitsPerItem: 12 } });
  act(w, buyer.id, pump(t.id));
  assert.equal(buyer.fuel, 12);
  owner.inventory.fuel = 1;
  act(w, owner.id, { type: 'refuelPlayer', player: buyer.id });
  assert.equal(buyer.fuel, 24);
  owner.inventory.fuel = 1;
  act(w, owner.id, { type: 'use', item: 'fuel' });
  assert.equal(owner.fuel, 12);
  assert.equal(worldItems(createWorld('other', 'Other', 'builder')).fuel.fuel, 8);
  act(w, owner.id, { type: 'settings', patch: { refuelRange: 3 } });
  buyer.x = 4;
  owner.inventory.fuel = 1;
  assert.throws(() => act(w, owner.id, { type: 'refuelPlayer', player: buyer.id }), /3 metres/);
  assert.throws(() => act(w, buyer.id, pump(t.id)), /3 metres/);
});
test('resident execution rechecks price, shop availability and household reserve after planning', async () => {
  const { w, buyer, t } = setup();
  const { checkResidentFuelPurchase } = await import('../src/server/npc/fuel');
  t.sellPrice = worldItems(w).fuel.price;
  const action = buy(t.id);
  checkResidentFuelPurchase(w, buyer, action);
  const quoted = { ...action, price: t.sellPrice };
  t.sellPrice!++;
  assert.throws(() => act(w, buyer.id, quoted), /price changed/);
  t.sellPrice!--;
  buyer.cash = 0;
  assert.throws(() => checkResidentFuelPurchase(w, buyer, action));
  buyer.cash = 100000;
  t.sellPrice *= 2;
  assert.throws(() => checkResidentFuelPurchase(w, buyer, action), /expensive/);
  t.sellPrice /= 2;
  w.settings.fuelTankerNpcPurchasing = false;
  assert.throws(() => checkResidentFuelPurchase(w, buyer, action), /disabled/);
});

test('attached tanker service works while stopped, including a boat alongside land, and refuses a moving rig', () => {
  const { w, owner, buyer, t } = setup();
  t.attached = owner.id;
  buyer.vehicle = 32;
  buyer.y = 0;
  buyer.fuel = 0;
  act(w, buyer.id, pump(t.id, 3));
  assert.equal(buyer.fuel, 24);
  assert.equal(t.cargo.fuel, 17);
  buyer.fuel = 0;
  owner.speed = 1;
  const before = JSON.stringify(w);
  assert.throws(() => act(w, buyer.id, pump(t.id)), /stop/);
  assert.equal(JSON.stringify(w), before);
});
test('fuel rules survive legacy defaults, portable designs and saves and appear in world-owner controls and summaries', async () => {
  const { w, owner } = setup();
  const { fuelRules, fuelRuleFields } = await import('../src/shared/fuel-rules');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const defaults = fuelRules();
  assert.equal(defaults.fuelUnitsPerItem, 8);
  assert.equal(defaults.fuelTankerTransactionLimit, 10000);
  assert.equal(defaults.fuelTankerPriceCeiling, 0);
  assert.equal(defaults.fuelTankerOfflineSales, true);
  assert.equal(defaults.refuelRange, 15);
  for (const key of Object.keys(fuelRuleFields)) delete (w.settings as any)[key];
  assert.deepEqual(fuelRules(w.settings), defaults);
  act(w, owner.id, {
    type: 'settings',
    patch: {
      fuelTankerSales: false,
      fuelTankerOfflineSales: false,
      fuelTankerTransactionLimit: 123,
      fuelTankerPriceCeiling: 1.5,
      fuelTankerNpcPurchasing: false,
      fuelTankerNpcPriceFactor: 1.1,
      refuelRange: 20,
      refuelHeight: 2,
      refuelSpeed: 0.2,
      fuelUnitsPerItem: 12,
    },
  });
  for (const key of Object.keys(fuelRuleFields))
    assert.ok(settingsFields(w.settings).includes(`name="${key}"`), key);
  assert.match(rulesSummary(w), /limit 123 Fuel/);
  assert.match(rulesSummary(w), /12 tank units per Fuel/);
  const target = createWorld('rules', 'Rules', 'builder');
  applyDesign(target, exportDesign(w));
  assert.deepEqual(fuelRules(target.settings), fuelRules(w.settings));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(fuelRules(store.loadWorlds()[0].world.settings), fuelRules(w.settings));
  } finally {
    store.close();
  }
});

test('public tanker quotes remain usable when the offline owner is omitted, without exposing private balances', async () => {
  const { w, owner, buyer, t } = setup();
  owner.online = false;
  t.cargo.fuel = 3;
  const { DeltaStream, prepareFrame } = await import('../src/server/snapshots');
  const { fuelTrailerQuote } = await import('../src/shared/fuel-sales');
  const data = JSON.parse(new DeltaStream().encode(w, { id: buyer.id } as any, prepareFrame(w)));
  const publicTanker = data.world.trailers[t.id];
  assert.deepEqual(publicTanker.fuelService, {
    ownerName: owner.name,
    ownerOnline: false,
    stopped: true,
  });
  assert.equal(publicTanker.cargo.fuel, 3);
  assert.equal(
    fuelTrailerQuote(
      data.world,
      { ...data.world.players[buyer.id], ...data.self },
      publicTanker,
      'buy',
      1,
      undefined,
      true,
    ).gross,
    5000,
  );
  assert.equal(JSON.stringify(publicTanker.fuelService).includes('bank'), false);
  delete w.players[owner.id];
  t.fuelService = { ownerName: 'Forged', ownerOnline: true, stopped: true };
  assert.throws(() => act(w, buyer.id, buy(t.id)), /owner/);
});

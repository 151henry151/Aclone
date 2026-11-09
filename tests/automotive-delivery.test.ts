// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { vehicles } from '../src/shared/catalog';
import { automotiveConfig, type AutomotiveProduct } from '../src/shared/automotive-config';
import { salesReceipt } from '../src/shared/taxes';
import { Store } from '../src/server/store';

const TRUCK = 37;
function setup(product: AutomotiveProduct = 'tractor') {
  const w = createWorld('delivery', 'Assembly delivery', 'owner');
  w.towns = [];
  w.zones = [];
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off', seaLevel: -100 });
  const owner = addPlayer(w, 'owner', 'Founder'),
    p = addPlayer(w, 'buyer', 'Haulier');
  Object.assign(p, {
    x: 0,
    z: 17,
    y: 20,
    vehicle: 5,
    cash: 20_000_000,
    online: true,
    speed: 0,
    skills: ['driver'],
    inventory: {},
  });
  Object.assign(owner, { x: -70, z: 0, online: false });
  const b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
  b.owner = owner.id;
  b.manufacturing = { orders: [], ready: [{ id: 'built-1', product, completedAt: 100 }] };
  b.investment = 0;
  w.buildings = [b];
  const buy = () =>
    act(w, p.id, {
      type: 'manufacturing',
      op: 'buy',
      building: b.id,
      unit: 'built-1',
      expectedPrice: automotiveConfig(w).products[product].price,
    });
  return { w, p, b, owner, buy };
}

test('append the highway tractor without reassigning any existing fleet slot', () => {
  assert.equal(vehicles.length, 40);
  assert.equal(vehicles[35].name, 'Coastal cargo boat');
  assert.match(vehicles[36].name, /rowboat/i);
  assert.equal(vehicles[TRUCK].name, 'Highway tractor unit');
  assert.equal(vehicles[TRUCK].length, 6.4);
  assert.equal(vehicles[TRUCK].width, 2.55);
});

test('paid delivery consumes one completed unit, credits the factory and withholds actual taxes exactly once', () => {
  const { w, p, b, buy } = setup();
  const cash = p.cash,
    price = automotiveConfig(w).products.tractor.price;
  const receipt = salesReceipt(w, b, price);
  buy();
  assert.equal(p.cash, cash - price);
  assert.equal(b.investment, receipt.net);
  assert.equal(b.accounts?.receipts, receipt.net);
  assert.equal(b.accounts?.sold['automotive:tractor'], 1);
  assert.equal(b.manufacturing!.ready.length, 0);
  assert.ok(p.fleet!.includes(TRUCK));
  const parked = w.parkedVehicles![`${p.id}:${TRUCK}`];
  assert.equal(parked.fuel, 0);
  assert.equal(parked.condition, 100);
  assert.ok(Math.hypot(parked.x - b.x, parked.z - b.z) > 16);
  const before = structuredClone(w);
  assert.throws(buy, /unit|sold|stock/i);
  assert.deepEqual(w, before);
  Object.assign(p, { x: parked.x, z: parked.z });
  act(w, p.id, { type: 'vehicle', slot: TRUCK });
  assert.equal(p.vehicle, TRUCK);
  assert.equal(p.fuel, 0);
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(w.parkedVehicles![`${p.id}:${TRUCK}`].fuel, 0);
});

test('refuse unaffordable, distant, unfinished, disabled, duplicate fleet and blocked-yard deliveries without mutation', () => {
  for (const problem of ['cash', 'distance', 'construction', 'disabled', 'owned', 'blocked']) {
    const { w, p, b, buy } = setup();
    if (problem === 'cash') p.cash = 0;
    if (problem === 'distance') p.z = 100;
    if (problem === 'construction') b.construction = { steel: 1 };
    if (problem === 'disabled') w.automotive = { ...automotiveConfig(w), enabled: false };
    if (problem === 'owned') p.fleet = [...(p.fleet ?? [0, 5]), TRUCK];
    if (problem === 'blocked') {
      for (let x = -40; x <= 40; x += 8)
        for (let z = 16; z <= 70; z += 8)
          w.buildings.push(makeBuilding(`blocked-${x}-${z}`, 'garage', x, z));
    }
    const before = structuredClone(w);
    assert.throws(buy, /cash|visit|close|construction|disabled|already|clear/i, problem);
    assert.deepEqual(w, before, problem);
  }
});

test('manufactured semitrailers have unique persisted ownership and no free cargo or generic garage source', () => {
  const { w, p, b } = setup('box');
  b.manufacturing!.ready = ['box', 'refrigerated', 'stake'].map((product, i) => ({
    id: 'built-' + i,
    product: product as AutomotiveProduct,
    completedAt: 100,
  }));
  for (const unit of [...b.manufacturing!.ready]) {
    act(w, p.id, {
      type: 'manufacturing',
      op: 'buy',
      building: b.id,
      unit: unit.id,
      expectedPrice: automotiveConfig(w).products[unit.product].price,
    });
    const trailer = Object.values(w.trailers!).find((t) => t.id === unit.id)!;
    assert.equal(trailer.owner, p.id);
    assert.equal(trailer.kind, 'semi' + unit.product[0].toUpperCase() + unit.product.slice(1));
    assert.deepEqual(trailer.cargo, {});
    assert.equal(trailer.attached, undefined);
  }
  assert.equal(b.manufacturing!.ready.length, 0);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.trailers, w.trailers);
  } finally {
    store.close();
  }
  const garage = makeBuilding('garage', 'garage', 70, 0);
  w.buildings.push(garage);
  Object.assign(p, { x: 70, z: 0, vehicle: 0 });
  assert.throws(
    () => act(w, p.id, { type: 'trailer', operation: 'buy', kind: 'semiBox', building: 'garage' }),
    /manufactur|factory/i,
  );
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: TRUCK, building: 'garage' }),
    /manufactur|factory/i,
  );
});

test('stale quotes and closed sales are refused; owners pay into their business and world defaults do not overwrite local prices', () => {
  const { w, p, b, owner } = setup();
  act(w, owner.id, {
    type: 'automotiveConfig',
    patch: { products: { tractor: { price: 6_500_000 } } },
  });
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'manufacturing',
        op: 'buy',
        building: b.id,
        unit: 'built-1',
        expectedPrice: 6_000_000,
      }),
    /price|quote/i,
  );
  Object.assign(owner, { x: 0, z: 17, vehicle: 5, speed: 0, cash: 8_000_000 });
  act(w, owner.id, {
    type: 'manufacturing',
    op: 'price',
    building: b.id,
    product: 'tractor',
    price: 6_100_000,
  });
  act(w, owner.id, {
    type: 'automotiveConfig',
    patch: { products: { tractor: { price: 6_800_000 } } },
  });
  act(w, owner.id, {
    type: 'manufacturing',
    op: 'buy',
    building: b.id,
    unit: 'built-1',
    expectedPrice: 6_100_000,
  });
  assert.equal(owner.cash, 1_900_000);
  assert.equal(b.investment, salesReceipt(w, b, 6_100_000).net);
});

test('delivery still requires physical collection with ordinary parking disabled', () => {
  const { w, p, buy } = setup();
  w.settings.vehiclesPersist = false;
  buy();
  const parked = w.parkedVehicles![`${p.id}:${TRUCK}`];
  p.x = -90;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: TRUCK }), /Walk.*vehicle/i);
  Object.assign(p, { x: parked.x, z: parked.z });
  act(w, p.id, { type: 'vehicle', slot: TRUCK });
  assert.equal(p.vehicle, TRUCK);
  assert.equal(p.x, parked.x);
  assert.equal(p.fuel, 0);
  assert.equal(w.parkedVehicles![`${p.id}:${TRUCK}`], undefined);
});

test('closed products and non-owner price edits preserve stock and money', () => {
  const { w, p, b, owner, buy } = setup();
  const quote = {
    type: 'manufacturing',
    op: 'price',
    building: b.id,
    product: 'tractor',
    price: null,
  };
  assert.throws(() => act(w, p.id, quote), /owner/i);
  Object.assign(owner, { x: 0, z: 17 });
  act(w, owner.id, quote);
  const before = structuredClone(w);
  assert.throws(buy, /closed/i);
  assert.deepEqual(w, before);
});

test('world delivery and semitrailer rules are validated, portable and used by physical footprints', async () => {
  const { w, p, b, buy, owner } = setup('box');
  const { exportDesign } = await import('../src/server/world-design');
  const { trailerDef } = await import('../src/shared/trailers');
  const { trailerFootprint } = await import('../src/shared/vehicle-footprint');
  act(w, owner.id, {
    type: 'automotiveConfig',
    patch: {
      delivery: { range: 12, maxOwnedSemitrailers: 1 },
      semitrailers: { box: { length: 15, width: 3, capacity: 3500 } },
    },
  });
  assert.throws(buy, /Visit/i);
  p.z = 11;
  buy();
  const trailer = w.trailers!['built-1'];
  assert.equal(trailerDef(w, trailer.kind).capacity, 3500);
  assert.equal(trailerFootprint(trailer, w).hz, 7.5);
  assert.equal(trailerFootprint(trailer, w).hx, 1.5);
  b.manufacturing!.ready.push({ id: 'built-2', product: 'box', completedAt: 101 });
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'manufacturing',
        op: 'buy',
        building: b.id,
        unit: 'built-2',
        expectedPrice: automotiveConfig(w).products.box.price,
      }),
    /limit/i,
  );
  const before = structuredClone(w);
  assert.throws(() =>
    act(w, owner.id, {
      type: 'automotiveConfig',
      patch: { semitrailers: { box: { length: -1 } } },
    }),
  );
  assert.deepEqual(w, before);
  const design = exportDesign(w);
  assert.deepEqual(design.automotive, w.automotive);
  assert.ok(!JSON.stringify(design).includes('built-1'));
});

test('reducing semitrailer capacity refuses existing cargo rather than silently overloading it', () => {
  const { w, p, owner, buy } = setup('box');
  buy();
  w.trailers!['built-1'].cargo = { steel: 100 };
  const before = structuredClone(w);
  assert.throws(
    () =>
      act(w, owner.id, {
        type: 'automotiveConfig',
        patch: { semitrailers: { box: { capacity: 1 } } },
      }),
    /Unload|cargo/i,
  );
  assert.deepEqual(w, before);
});

test('specialized semitrailers enforce their actual cargo roles', async () => {
  const { w, buy } = setup('stake');
  const { trailerAccepts } = await import('../src/shared/trailers');
  buy();
  const t = w.trailers!['built-1'];
  assert.equal(trailerAccepts(w, t, 'wood', 100), true);
  assert.equal(trailerAccepts(w, t, 'steel', 1), false);
  t.kind = 'semiRefrigerated';
  assert.equal(trailerAccepts(w, t, 'fish', 100), true);
  assert.equal(trailerAccepts(w, t, 'logs', 1), false);
  t.kind = 'semiBox';
  assert.equal(trailerAccepts(w, t, 'tools', 10), true);
  assert.equal(trailerAccepts(w, t, 'fish', 1), false);
});

test('collection guidance exposes a pending truck even when ordinary parking is disabled', async () => {
  const { parkingStatus } = await import('../src/client/parking-status');
  const { w, p, buy } = setup();
  w.settings.vehiclesPersist = false;
  buy();
  const status = parkingStatus(w, p);
  assert.equal(status?.slot, TRUCK);
  assert.match(status!.text, /Highway tractor unit/);
});

test('the truck editor leaves manufactured prices in the automotive rules rather than submitting a conflicting override', async () => {
  const { vehicleEditor } = await import('../src/client/vehicle-editor');
  const { w } = setup();
  assert.ok(
    !vehicleEditor(w, TRUCK).includes('name="price"'),
    'Truck performance edits must not submit a second price',
  );
});

test('truck names have one world source and the editor exposes height and only supported modes', async () => {
  const { vehicleEditor } = await import('../src/client/vehicle-editor');
  const { vehicleDef } = await import('../src/shared/vehicle-config');
  const { w, owner } = setup();
  act(w, owner.id, {
    type: 'automotiveConfig',
    patch: { products: { tractor: { name: 'Long-distance tractor' } } },
  });
  const html = vehicleEditor(w, TRUCK);
  assert.match(html, /name="height"/);
  assert.ok(!html.includes('name="name"'));
  assert.ok(!html.includes('Fixed-wing aircraft'));
  assert.throws(
    () =>
      act(w, owner.id, {
        type: 'vehicleTuning',
        slot: TRUCK,
        tuning: { name: 'Conflicting name' },
      }),
    /name|Automotive/i,
  );
  assert.equal(vehicleDef(w, TRUCK).name, 'Long-distance tractor');
  assert.throws(
    () => act(w, owner.id, { type: 'vehicleTuning', slot: TRUCK, tuning: { height: 1 } }),
    /cab|height/i,
  );
});

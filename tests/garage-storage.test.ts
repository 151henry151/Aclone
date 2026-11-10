import { exportDesign, applyDesign } from '../src/server/world-design';
import { butcherRamp } from '../src/shared/butcher';
import { fuelTrailerQuote } from '../src/shared/fuel-sales';
import type { World, Player, Building, Action } from '../src/shared/types';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
import { trailerBlocks } from '../src/shared/trailers';
import { storeSpareTractors } from '../src/shared/parked-vehicles';
import { buildingPlan, buildingBounds } from '../src/shared/building-shapes';
import { buildingBays } from '../src/shared/building-bays';
function setup(kind = 'garage') {
  const w = createWorld('storage', 'Storage', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  w.roads = [];
  w.towns = [];
  w.zones = [];
  delete w.airfield;
  delete w.spaceportSite;
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    vehiclesPersist: true,
    arrivalAnimation: 'off',
    garageStoresSpareTractors: false,
  });
  const p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, { vehicle: 5, x: 16, z: 10, y: 0, online: true, inventory: {}, speed: 0 });
  const b = makeBuilding('garage', kind, 0, 0);
  b.owner = p.id;
  w.buildings = [b];
  p.fleet = [0, 5, 37, 38, 39];
  w.parkedVehicles = {
    'owner:38': {
      owner: p.id,
      slot: 38,
      x: 18,
      z: 10,
      y: 0,
      heading: 0,
      fuel: 17,
      condition: 63,
      paint: 'plum',
      parkedAt: w.time,
    },
  };
  w.trailers = {
    tip: { id: 'tip', owner: p.id, kind: 'dump', x: 19, z: 18, heading: 0, cargo: { dirt: 9 } },
  };
  return { w, p, b };
}
function action(w: World, p: Player, b: Building, operation: string, extra: Partial<Action> = {}) {
  return act(w, p.id, { type: 'garageStorage', building: b.id, operation, ...extra });
}
test('store and retrieve earthmovers and independent trailers without loss or outdoor collision', () => {
  const { w, p, b } = setup();
  const old = structuredClone(w.parkedVehicles!['owner:38']);
  action(w, p, b, 'storeVehicle', { slot: 38 });
  assert.equal(w.parkedVehicles!['owner:38'].inside, b.id);
  action(w, p, b, 'storeTrailer', { id: 'tip' });
  assert.equal((w.trailers!.tip as any).storedAt, b.id);
  assert.equal(trailerBlocks(w, { x: 19, z: 18 }, { x: 19, z: 18 }, 1), false);
  const db = new Store(':memory:');
  try {
    db.saveWorld(w);
    const loaded = db.loadWorlds()[0].world;
    assert.deepEqual(loaded.trailers, w.trailers);
    assert.deepEqual(loaded.parkedVehicles, w.parkedVehicles);
  } finally {
    db.close();
  }
  action(w, p, b, 'retrieveVehicle', { slot: 38 });
  action(w, p, b, 'retrieveTrailer', { id: 'tip' });
  assert.equal(w.parkedVehicles!['owner:38'].inside, undefined);
  assert.equal((w.trailers!.tip as any).storedAt, undefined);
  for (const k of ['fuel', 'condition', 'paint', 'owner', 'slot'] as const)
    assert.equal(w.parkedVehicles!['owner:38'][k], old[k]);
  assert.deepEqual(w.trailers!.tip.cargo, { dirt: 9 });
  assert.equal(p.vehicle, 5);
});
test('storage refusals do not mutate ownership, location or cargo', () => {
  for (const scenario of [
    'distantPlayer',
    'distantVehicle',
    'foreign',
    'moving',
    'boat',
    'aircraft',
    'unfinished',
  ]) {
    const { w, p, b } = setup();
    if (scenario === 'distantPlayer') p.x = 200;
    if (scenario === 'distantVehicle') w.parkedVehicles!['owner:38'].x = 200;
    if (scenario === 'foreign') w.parkedVehicles!['owner:38'].owner = 'other';
    if (scenario === 'moving') p.speed = 3;
    if (scenario === 'boat' || scenario === 'aircraft')
      w.parkedVehicles!['owner:38'].slot = scenario === 'boat' ? 3 : 2;
    if (scenario === 'unfinished') b.construction = { wood: 1 };
    const before = JSON.stringify(w);
    assert.throws(
      () => action(w, p, b, 'storeVehicle', { slot: 38 }),
      /within|Choose your own|Stop|land vehicle|completed/i,
      scenario,
    );
    assert.equal(JSON.stringify(w), before);
  }
});
test('buildable storage garage is large, private, unlimited and has vehicle bays', () => {
  const { w, p, b } = setup('vehicleStorage');
  const bounds = buildingBounds(buildingPlan(b));
  assert.ok(bounds.width >= 24 && bounds.depth >= 18);
  assert.ok(buildingBays(b, buildingPlan(b)).length >= 2);
  for (let i = 0; i < 30; i++)
    w.trailers!['t' + i] = {
      id: 't' + i,
      owner: p.id,
      kind: 'box',
      x: 18,
      z: 10,
      heading: 0,
      cargo: {},
    };
  for (let i = 0; i < 30; i++) action(w, p, b, 'storeTrailer', { id: 't' + i });
  action(w, p, b, 'storeVehicle', { slot: 38 });
  w.settings.garageStoresSpareTractors = true;
  storeSpareTractors(w, p);
  assert.equal(w.parkedVehicles!['owner:38'].inside, b.id);
  b.owner = 'buyer';
  assert.throws(() => action(w, p, b, 'storeTrailer', { id: 'tip' }), /owner|private/i);
  action(w, p, b, 'retrieveVehicle', { slot: 38 });
});

test('custom storage rules persist/export and reductions never strand stored property', () => {
  const { w, p, b } = setup();
  w.trailers!.tip.x = 18;
  w.trailers!.tip.z = 14;
  assert.equal(w.settings.garageStorageEnabled, true);
  assert.equal(w.settings.garageStorageLimit, 0);
  assert.equal(w.settings.garageStorageRange, 30);
  act(w, p.id, { type: 'settings', patch: { garageStorageLimit: 1, garageStorageRange: 25 } });
  action(w, p, b, 'storeVehicle', { slot: 38 });
  assert.throws(() => action(w, p, b, 'storeTrailer', { id: 'tip' }), /limit/);
  act(w, p.id, { type: 'settings', patch: { garageStorageEnabled: false } });
  assert.throws(() => action(w, p, b, 'storeTrailer', { id: 'tip' }), /disabled/);
  action(w, p, b, 'retrieveVehicle', { slot: 38 });
  act(w, p.id, { type: 'settings', patch: { garageStorageEnabled: true, garageStorageRange: 5 } });
  assert.throws(() => action(w, p, b, 'storeVehicle', { slot: 38 }), /within/);
  const exported = exportDesign(w);
  const next = createWorld('import', 'Import', 'owner');
  applyDesign(next, exported);
  assert.equal(next.settings.garageStorageLimit, 1);
  assert.equal(next.settings.garageStorageRange, 5);
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { garageStorageLimit: -1 } }));
});
test('a stored rig keeps its hitch, cargo, refrigeration, condition and paint', () => {
  const { w, p, b } = setup();
  const v = w.parkedVehicles!['owner:38'];
  v.slot = 37;
  delete w.parkedVehicles!['owner:38'];
  w.parkedVehicles!['owner:37'] = v;
  w.trailers!.tip = {
    id: 'tip',
    owner: p.id,
    kind: 'semiRefrigerated',
    x: v.x,
    z: v.z - 10,
    heading: 0,
    cargo: { beef: 3 },
    cooling: { fuel: 9, checkedAt: w.time, running: false },
    attached: p.id,
    parkedWith: 'owner:37',
  };
  const cargo = structuredClone(w.trailers!.tip);
  action(w, p, b, 'storeVehicle', { slot: 37 });
  assert.equal(trailerBlocks(w, { x: 18, z: 0 }, { x: 18, z: 0 }, 1), false);
  action(w, p, b, 'retrieveVehicle', { slot: 37 });
  assert.equal(w.trailers!.tip.parkedWith, 'owner:37');
  assert.equal(w.trailers!.tip.attached, p.id);
  assert.deepEqual(w.trailers!.tip.cargo, cargo.cargo);
  assert.deepEqual(w.trailers!.tip.cooling, cargo.cooling);
  assert.equal(Math.round(w.trailers!.tip.z - w.parkedVehicles!['owner:37'].z), -10);
});
test('blocked retrieval and occupied-garage demolition are atomic refusals', () => {
  const { w, p, b } = setup();
  action(w, p, b, 'storeTrailer', { id: 'tip' });
  p.x = 0;
  p.z = 10;
  assert.throws(() => act(w, p.id, { type: 'demolish', building: b.id }), /Retrieve stored/);
  w.settings.seaLevel = 100;
  const before = JSON.stringify(w);
  assert.throws(() => action(w, p, b, 'retrieveTrailer', { id: 'tip' }), /No safe clear space/);
  assert.equal(JSON.stringify(w), before);
});
test('stored trailers cannot be unloaded or pumped remotely', () => {
  const { w, p, b } = setup();
  action(w, p, b, 'storeTrailer', { id: 'tip' });
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, { type: 'trailer', id: 'tip', operation: 'unload', item: 'dirt', quantity: 1 }),
    /Retrieve/,
  );
  assert.equal(JSON.stringify(w), before);
  w.trailers!.tip.kind = 'fuel';
  w.trailers!.tip.cargo = { fuel: 5 };
  assert.throws(() => fuelTrailerQuote(w, p, w.trailers!.tip, 'buy', 1), /Retrieve/);
});
test('explicit private tractor storage survives spare normalization and garage sale', () => {
  const { w, p, b } = setup('vehicleStorage');
  const v = w.parkedVehicles!['owner:38'];
  delete w.parkedVehicles!['owner:38'];
  v.slot = 24;
  w.parkedVehicles!['owner:24'] = v;
  p.fleet!.push(24);
  p.lastTractor = 0;
  action(w, p, b, 'storeVehicle', { slot: 24 });
  w.settings.garageStoresSpareTractors = true;
  storeSpareTractors(w, p);
  assert.equal(v.inside, b.id);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 24 }), /garage/);
  b.owner = 'buyer';
  action(w, p, b, 'retrieveVehicle', { slot: 24 });
  assert.equal(v.inside, undefined);
  assert.equal(p.lastTractor, 24);
});

test('every land vehicle family supports explicit storage without losing its parked state', () => {
  for (const slot of [0, 1, 4, 24, 25, 26, 27, 28, 37, 38, 39]) {
    const { w, p, b } = setup();
    const v = w.parkedVehicles!['owner:38'];
    w.parkedVehicles = { ['owner:' + slot]: { ...v, slot } };
    p.fleet = [slot, 5];
    action(w, p, b, 'storeVehicle', { slot });
    assert.equal(w.parkedVehicles['owner:' + slot].inside, b.id);
    action(w, p, b, 'retrieveVehicle', { slot });
    assert.equal(w.parkedVehicles['owner:' + slot].inside, undefined);
    assert.equal(w.parkedVehicles['owner:' + slot].fuel, 17);
  }
});
test('a garage cannot decay away with property still stored inside', () => {
  const { w, p, b } = setup('vehicleStorage');
  action(w, p, b, 'storeTrailer', { id: 'tip' });
  b.condition = 1e-12;
  advance(w, 1);
  assert.ok(w.buildings.some((site) => site.id === b.id));
  assert.equal(b.condition, 1);
  action(w, p, b, 'retrieveTrailer', { id: 'tip' });
  b.condition = 1e-12;
  advance(w, 1);
  assert.ok(!w.buildings.some((site) => site.id === b.id));
});
test('stored livestock cannot be slaughtered at its stale outdoor coordinates', () => {
  const { w, p, b } = setup();
  action(w, p, b, 'storeTrailer', { id: 'tip' });
  const butcher = makeBuilding('butcher', 'butcher', 0, 0);
  w.buildings.push(butcher);
  Object.assign(p, butcherRamp(butcher), { cash: 100000 });
  Object.assign(w.trailers!.tip, {
    ...butcherRamp(butcher),
    kind: 'livestock',
    cargo: { chickens: 1 },
  });
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'butcher',
        building: butcher.id,
        operation: 'slaughter',
        item: 'chickens',
        quantity: 1,
        storage: 'trailer',
        trailer: 'tip',
      }),
    /Stop your livestock wagon/,
  );
  assert.equal(JSON.stringify(w), before);
});

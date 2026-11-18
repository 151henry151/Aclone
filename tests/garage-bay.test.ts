// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';

function setup() {
  const w = createWorld('bay', 'Bay', 'owner');
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
  Object.assign(p, {
    vehicle: 0,
    x: -12,
    z: 12,
    y: 0,
    heading: 0.65,
    speed: 0,
    online: true,
    fleet: [0, 5, 37],
    fuel: 17,
    inventory: {},
  });
  const b = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [b];
  w.parkedVehicles = {};
  w.trailers = {};
  return { w, p, b };
}

test('entering a tractor garage leaves an angled vehicle exactly where its driver stopped', () => {
  const { w, p, b } = setup();
  const before = { x: p.x, z: p.z, heading: p.heading };
  act(w, p.id, { type: 'approach', building: b.id });
  const v = w.parkedVehicles!['owner:0'];
  assert.deepEqual({ x: v.x, z: v.z, heading: v.heading }, before);
  assert.equal(v.inside, undefined);
  assert.equal(p.vehicle, 5);
});

test('marked bays default on and validate the per-world margin and opt-out', () => {
  const { w, p } = setup();
  assert.equal(w.settings.garageBayRequired, true);
  assert.equal(w.settings.garageBayMargin, 3);
  act(w, p.id, { type: 'settings', patch: { garageBayMargin: 7, garageBayRequired: false } });
  assert.equal(w.settings.garageBayMargin, 7);
  assert.equal(w.settings.garageBayRequired, false);
  for (const garageBayMargin of [-1, 11, NaN])
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { garageBayMargin } }));
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { garageBayRequired: 1 } }));
});

// Public geometry is shared by the simulation, HUD and painted rectangle.
async function bayApi() {
  return await import('../src/shared/garage-bay');
}

test('whole rotated and articulated footprints must fit; margin accepts an offset longest rig', async () => {
  const { garageBay, garageBayContains } = await bayApi();
  const { w, p, b } = setup();
  const { vehicleFootprint, trailerFootprint } = await import('../src/shared/vehicle-footprint');
  const { automotiveConfig } = await import('../src/shared/automotive-config');
  const { trailerDef } = await import('../src/shared/trailers');
  b.rotation = 0.7;
  w.settings.garageBayMargin = 0;
  const bay = garageBay(w, b)!;
  const d = trailerDef(w, 'semiStake');
  const coupling = automotiveConfig(w).coupling;
  const offset = coupling.fifthWheelZ - d.length / 2 + coupling.kingpinInset;
  const front = 3.2,
    rear = offset - d.length / 2;
  const longitudinal = -(front + rear) / 2;
  Object.assign(p, {
    vehicle: 37,
    heading: b.rotation,
    x: bay.x + Math.sin(b.rotation) * longitudinal + Math.cos(b.rotation) * 0.2,
    z: bay.z + Math.cos(b.rotation) * longitudinal - Math.sin(b.rotation) * 0.2,
  });
  const t = {
    id: 'semi',
    owner: p.id,
    kind: 'semiStake' as const,
    cargo: { wood: 3 },
    heading: p.heading,
    x: p.x + Math.sin(p.heading) * offset,
    z: p.z + Math.cos(p.heading) * offset,
    attached: p.id,
  };
  w.trailers = { semi: t };
  // Place the whole rig slightly across the rear edge, independently of which catalogue rig is longest.
  const shift = bay.depth / 2 + rear + longitudinal + 0.2;
  p.x -= Math.sin(b.rotation) * shift;
  p.z -= Math.cos(b.rotation) * shift;
  t.x -= Math.sin(b.rotation) * shift;
  t.z -= Math.cos(b.rotation) * shift;
  assert.equal(garageBayContains(bay, [vehicleFootprint(w, 37, p), trailerFootprint(t, w)]), false);
  w.settings.garageBayMargin = 3;
  assert.equal(
    garageBayContains(garageBay(w, b)!, [vehicleFootprint(w, 37, p), trailerFootprint(t, w)]),
    true,
  );
  t.heading += Math.PI / 2;
  assert.equal(
    garageBayContains(garageBay(w, b)!, [vehicleFootprint(w, 37, p), trailerFootprint(t, w)]),
    false,
  );
});

test('HUD eligibility and storage validate the complete rig atomically and leave on foot', async () => {
  const { garageBay, garageBayStoreReason } = await bayApi();
  const { w, p, b } = setup();
  const bay = garageBay(w, b)!;
  Object.assign(p, { x: bay.x, z: bay.z, heading: b.rotation });
  assert.equal(garageBayStoreReason(w, p, b), undefined);
  for (const patch of [
    { speed: 0.06 },
    { x: bay.x + bay.width },
    { vehicle: 5 },
    { fleet: [5] },
    { game: 'race' },
    { task: { kind: 'logging', end: 100 } },
  ]) {
    const player = { ...p, ...patch } as typeof p;
    assert.ok(garageBayStoreReason(w, player, b), JSON.stringify(patch));
  }
  w.settings.garageStorageEnabled = false;
  assert.ok(garageBayStoreReason(w, p, b));
  w.settings.garageStorageEnabled = true;
  w.settings.garageStorageLimit = 1;
  w.trailers!.tip = {
    id: 'tip',
    kind: 'dump',
    owner: p.id,
    attached: p.id,
    x: p.x,
    z: p.z - 6.4,
    heading: 0,
    cargo: { dirt: 9 },
  };
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'storeGarageBay', building: b.id }), /limit/);
  assert.equal(JSON.stringify(w), before);
  w.settings.garageStorageLimit = 0;
  const fuel = p.fuel;
  act(w, p.id, { type: 'storeGarageBay', building: b.id });
  assert.equal(w.parkedVehicles!['owner:0'].fuel, fuel);
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
  assert.equal(w.trailers!.tip.parkedWith, 'owner:0');
  assert.deepEqual(w.trailers!.tip.cargo, { dirt: 9 });
  assert.equal(p.inside, b.id);
  assert.equal(p.vehicle, 5);
  act(w, p.id, { type: 'exitBuilding' });
  assert.equal(p.vehicle, 5);
});

test('blocked pedestrian route cannot partially store a rig', async () => {
  const { garageBay } = await bayApi();
  const { buildingEntry } = await import('../src/shared/parking-site');
  const { w, p, b } = setup();
  Object.assign(p, garageBay(w, b));
  const door = buildingEntry(b);
  // A second solid building encloses the garage doorway, so no valid entry route exists.
  w.buildings.push(makeBuilding('blocker', 'vehicleStorage', door.x, door.z));
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'storeGarageBay', building: b.id }),
    /route|path|blocked|clear/i,
  );
  assert.equal(JSON.stringify(w), before);
});

test('parked deposits require whole bodies in the bay; legacy opt-out and private garages keep their policies', async () => {
  const { garageBay } = await bayApi();
  const { w, p, b } = setup();
  const bay = garageBay(w, b)!;
  Object.assign(p, { vehicle: 5, x: b.x, z: b.z + 5 });
  const v = {
    owner: p.id,
    slot: 0,
    x: bay.x + bay.width / 2,
    z: bay.z,
    y: 0,
    heading: 0,
    fuel: 17,
    condition: 63,
    paint: 'plum',
    parkedAt: w.time,
  };
  w.parkedVehicles!['owner:0'] = v;
  const before = JSON.stringify(w);
  assert.throws(
    () =>
      act(w, p.id, { type: 'garageStorage', operation: 'storeVehicle', building: b.id, slot: 0 }),
    /yellow bay/,
  );
  assert.equal(JSON.stringify(w), before);
  Object.assign(v, { x: bay.x, z: bay.z });
  act(w, p.id, { type: 'garageStorage', operation: 'storeVehicle', building: b.id, slot: 0 });
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
  w.trailers!.loose = {
    id: 'loose',
    owner: p.id,
    kind: 'dump',
    x: 18,
    z: 10,
    heading: 0,
    cargo: { dirt: 2 },
  };
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'garageStorage',
        operation: 'storeTrailer',
        building: b.id,
        id: 'loose',
      }),
    /yellow bay/,
  );
  w.settings.garageBayRequired = false;
  act(w, p.id, { type: 'garageStorage', operation: 'storeTrailer', building: b.id, id: 'loose' });
  assert.equal(w.trailers!.loose.storedAt, b.id);
  w.settings.garageBayRequired = true;
  b.kind = 'vehicleStorage';
  assert.equal(garageBay(w, b), undefined);
  b.kind = 'garage';
  b.aircraftHangar = true;
  assert.equal(garageBay(w, b), undefined);
});

test('custom catalogue dimensions, bay rules and stored rigs survive SQLite and portable designs', async () => {
  const { garageBay } = await bayApi();
  const { Store } = await import('../src/server/store');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p, b } = setup();
  const original = garageBay(w, b)!;
  w.vehicleTuning = { 37: { length: 30, width: 9 } };
  const enlarged = garageBay(w, b)!;
  assert.ok(enlarged.depth > original.depth);
  assert.ok(enlarged.width > original.width);
  delete w.settings.garageBayMargin;
  delete w.settings.garageBayRequired;
  assert.deepEqual(garageBay(w, b), enlarged, 'old worlds use canonical defaults');
  act(w, p.id, { type: 'settings', patch: { garageBayMargin: 8, garageBayRequired: false } });
  const db = new Store(':memory:');
  try {
    db.saveWorld(w);
    const loaded = db.loadWorlds()[0].world;
    assert.equal(loaded.settings.garageBayMargin, 8);
    assert.equal(loaded.settings.garageBayRequired, false);
    const imported = createWorld('imported', 'Imported', 'owner');
    applyDesign(imported, exportDesign(loaded));
    assert.equal(imported.settings.garageBayMargin, 8);
    assert.equal(imported.settings.garageBayRequired, false);
  } finally {
    db.close();
  }
});

test('custom semitrailer and coupling dimensions size the bay; painted geometry uses only two draws', async () => {
  const { garageBay } = await bayApi();
  const { garageBayModel } = await import('../src/client/garage-bay-model');
  const { automotiveConfig } = await import('../src/shared/automotive-config');
  const { Box3 } = await import('three');
  const { w, b } = setup();
  const old = garageBay(w, b)!;
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.semitrailers.stake.length = 25;
  w.automotive.semitrailers.stake.width = 5;
  w.automotive.coupling.fifthWheelZ = -3;
  const bay = garageBay(w, b)!;
  assert.ok(bay.depth > old.depth);
  assert.ok(bay.width > old.width);
  const model = garageBayModel(w, bay);
  assert.equal(model.children.length, 2);
  const bounds = new Box3().setFromObject(model.children[1]);
  assert.ok(Math.abs(bounds.min.x - (bay.x - bay.width / 2 - 0.08)) < 1e-5);
  assert.ok(Math.abs(bounds.max.z - (bay.z + bay.depth / 2 + 0.08)) < 1e-5);
  model.traverse((node) => {
    const mesh = node as import('three').Mesh;
    mesh.geometry?.dispose();
    if (mesh.material)
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  });
});

test('retrieval chooses space clear of another driver occupying the bay', async () => {
  const { garageBay } = await bayApi();
  const { vehicleFootprint, rectanglesOverlap, trailerFootprint } =
    await import('../src/shared/vehicle-footprint');
  const { w, p, b } = setup();
  Object.assign(p, garageBay(w, b));
  act(w, p.id, { type: 'storeGarageBay', building: b.id });
  const visitor = addPlayer(w, 'visitor', 'Visitor');
  Object.assign(visitor, garageBay(w, b), { vehicle: 37, online: true });
  act(w, p.id, { type: 'garageStorage', operation: 'retrieveVehicle', building: b.id, slot: 0 });
  const v = w.parkedVehicles!['owner:0'];
  assert.equal(v.inside, undefined);
  assert.equal(
    rectanglesOverlap(
      vehicleFootprint(w, v.slot, v),
      vehicleFootprint(w, visitor.vehicle, visitor),
    ),
    false,
  );
});

test('automatic garage swaps and spare normalization never store physical vehicles outside the bay', async () => {
  const { storeSpareTractors } = await import('../src/shared/parked-vehicles');
  for (const enterFirst of [false, true]) {
    const { w, p, b } = setup();
    w.settings.garageStoresSpareTractors = true;
    p.fleet = [0, 5, 24];
    p.parkedFuel = { 24: 12 };
    const stopped = { x: p.x, z: p.z, heading: p.heading };
    if (enterFirst) {
      act(w, p.id, { type: 'approach', building: b.id });
      act(w, p.id, { type: 'exitBuilding' });
    }
    act(w, p.id, { type: 'vehicle', slot: 24, building: b.id });
    storeSpareTractors(w, p);
    const parked = w.parkedVehicles!['owner:0'];
    assert.equal(parked.inside, undefined);
    assert.deepEqual({ x: parked.x, z: parked.z, heading: parked.heading }, stopped);
  }
});

test('a driver must let passengers leave before storing the vehicle', async () => {
  const { garageBay, garageBayStoreReason } = await bayApi();
  const { w, p, b } = setup();
  Object.assign(p, garageBay(w, b));
  const guest = addPlayer(w, 'guest', 'Guest');
  guest.hitch = p.id;
  assert.match(garageBayStoreReason(w, p, b) ?? '', /passenger/i);
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'storeGarageBay', building: b.id }), /passenger/i);
  assert.equal(JSON.stringify(w), before);
  delete guest.hitch;
  assert.equal(garageBayStoreReason(w, p, b), undefined);
  act(w, p.id, { type: 'storeGarageBay', building: b.id });
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
});

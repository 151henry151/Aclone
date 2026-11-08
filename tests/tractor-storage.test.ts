import { creatorSchema } from '../src/shared/creator';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, terrainHeight } from '../src/shared/simulation';
import {
  migrateParkedVehicles,
  parkedVehicle,
  parkCurrentVehicle,
} from '../src/shared/parked-vehicles';
import { vehicleRecord } from '../src/shared/vehicle-services';
import { tractorWaypoint } from '../src/client/parking-status';
import { Store } from '../src/server/store';

function setup() {
  const w = createWorld('storage', 'Storage', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  const garage = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [garage];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off' });
  Object.assign(p, {
    x: 0,
    z: 0,
    y: terrainHeight(w, 0, 0),
    heading: 0,
    speed: 0,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 5, 24, 25],
    fuelVehicle: 24,
    fuel: 17,
    inventory: {},
    online: true,
  });
  return { w, p, garage };
}

test('crowded fleets keep only the last-used tractor outdoors without losing assets', () => {
  const { w, p } = setup();
  p.vehiclePaints = { 24: 'plum', 25: 'blue' };
  vehicleRecord(w, p).condition = 63;
  const current = parkCurrentVehicle(w, p);
  p.vehicle = 5;
  w.parkedVehicles!['owner:25'] = { ...current, slot: 25, x: 100, fuel: 9, paint: 'blue' };
  w.parkedVehicles!['owner:2'] = { ...current, slot: 2, x: 200 };
  p.parkedFuel = { 0: 31 };
  const before = structuredClone(current);
  assert.equal(migrateParkedVehicles(w), true);
  assert.deepEqual(parkedVehicle(w, p, 24), before);
  assert.ok(parkedVehicle(w, p, 25)?.inside, 'spare tractor must be stored invisibly');
  assert.ok(parkedVehicle(w, p, 0)?.inside);
  assert.equal(parkedVehicle(w, p, 0)?.fuel, 31);
  assert.equal(parkedVehicle(w, p, 2)?.inside, undefined);
  assert.equal(p.parkedFuel[0], undefined);
  assert.equal(tractorWaypoint(w, p)?.x, current.x);
  assert.equal(migrateParkedVehicles(w), false);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(
      store.loadWorlds()[0].world.parkedVehicles,
      JSON.parse(JSON.stringify(w.parkedVehicles)),
    );
  } finally {
    store.close();
  }
});

test('spare tractors cannot be recalled away from a garage, even without parked records', () => {
  const { w, p } = setup();
  p.x = 100;
  for (const slot of [0, 25]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'vehicle', slot }), /garage/i);
    assert.equal(JSON.stringify(w), before);
  }
});

test('switching at a garage stores the old tractor left elsewhere and restores the spare tank', () => {
  const { w, p, garage } = setup();
  p.x = 100;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.parkedFuel = { 25: 9 };
  p.vehiclePaints = { 25: 'blue' };
  vehicleRecord(w, p, 25).condition = 71;
  migrateParkedVehicles(w);
  Object.assign(p, { x: 0, z: 0 });
  act(w, p.id, { type: 'vehicle', slot: 25, building: garage.id });
  assert.equal(p.vehicle, 25);
  assert.equal(p.fuel, 9);
  assert.equal(vehicleRecord(w, p).condition, 71);
  assert.equal(p.vehiclePaints[25], 'blue');
  assert.ok(parkedVehicle(w, p, 24)?.inside, 'previous current tractor is stored, even from afar');
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(Object.values(w.parkedVehicles!).filter((v) => !v.inside).length, 1);
});

test('storage policy can be disabled, validated, exported, saved and activated immediately', async () => {
  const { parkingRules } = await import('../src/shared/parking-rules');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p } = setup();
  assert.equal(parkingRules({}).garageStoresSpareTractors, true);
  assert.match(settingsFields(w.settings), /name="garageStoresSpareTractors"/);
  act(w, p.id, { type: 'settings', patch: { garageStoresSpareTractors: false } });
  p.x = 100;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(parkedVehicle(w, p, 24)?.inside, undefined);
  const copy = createWorld('copy', 'Copy', p.id);
  applyDesign(copy, exportDesign(w));
  assert.equal(copy.settings.garageStoresSpareTractors, false);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.equal(store.loadWorlds()[0].world.settings.garageStoresSpareTractors, false);
  } finally {
    store.close();
  }
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { garageStoresSpareTractors: 1 } }));
  assert.equal(JSON.stringify(w), before);
  act(w, p.id, { type: 'settings', patch: { garageStoresSpareTractors: true } });
  assert.ok(parkedVehicle(w, p, 24)?.inside);
});

test('migration needs no garage or outdoor space and hides the spare rig without losing cargo', async () => {
  const { trailerBlocks, attachedTrailer } = await import('../src/shared/trailers');
  const { w, p } = setup();
  w.buildings = [];
  w.settings.seaLevel = 50;
  p.parkedFuel = { 0: 31 };
  const spare = { ...parkCurrentVehicle(w, p), slot: 25, fuel: 9, x: 100 };
  delete w.parkedVehicles!['owner:24'];
  p.fuel = 17;
  w.parkedVehicles!['owner:25'] = spare;
  w.trailers = {
    box: {
      id: 'box',
      kind: 'box',
      owner: p.id,
      x: 100,
      z: -7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
      parkedWith: 'owner:25',
    },
  };
  const trailer = structuredClone(w.trailers.box);
  migrateParkedVehicles(w);
  assert.ok(parkedVehicle(w, p, 0)?.inside);
  assert.deepEqual(w.trailers.box, trailer);
  assert.equal(trailerBlocks(w, trailer, trailer, 1), false);
  assert.equal(attachedTrailer(w, p), undefined);
  assert.equal(p.fuel, 17);
});

test('storage retrieval rejects distant, unfinished and aircraft garages without mutation', () => {
  for (const kind of ['distant', 'construction', 'hangar']) {
    const { w, p, garage } = setup();
    p.parkedFuel = { 25: 9 };
    migrateParkedVehicles(w);
    if (kind === 'distant') p.x = 100;
    if (kind === 'construction') garage.construction = { progress: 0 } as any;
    if (kind === 'hangar') garage.aircraftHangar = true;
    const before = JSON.stringify(w);
    assert.throws(
      () => act(w, p.id, { type: 'vehicle', slot: 25, building: garage.id }),
      /garage|near|metres|closer|construction/i,
    );
    assert.equal(JSON.stringify(w), before);
  }
});

test('garage swaps return the stored rig and its cargo at a clear departure point', () => {
  const { w, p, garage } = setup();
  w.creator = creatorSchema.parse({ ...w.creator, scenery: false });
  w.settings.seaLevel = -10;
  w.landscape = {
    heightmap: Array(1089).fill(0),
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
  };
  w.trailers = {
    box: {
      id: 'box',
      kind: 'box',
      owner: p.id,
      x: 0,
      z: -7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
    },
  };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  act(w, p.id, { type: 'vehicle', slot: 25, building: garage.id });
  assert.equal(w.trailers.box.parkedWith, 'owner:24');
  act(w, p.id, { type: 'vehicle', slot: 24, building: garage.id });
  assert.equal(p.fuel, 17);
  assert.equal(w.trailers.box.parkedWith, undefined);
  assert.equal(Math.hypot(w.trailers.box.x - p.x, w.trailers.box.z - p.z), 7);
  assert.deepEqual(w.trailers.box.cargo, { wood: 2 });
});

test('residents resolve shared garage storage to a real garage before boarding', async () => {
  const { parkingActionPrep } = await import('../src/server/npc/travel');
  const { operation, operationAction } = await import('../src/server/npc/player-operations');
  const { w, p, garage } = setup();
  p.npc = true;
  p.parkedFuel = { 25: 9 };
  migrateParkedVehicles(w);
  const step = operation('vehicle', { slot: 25 });
  const prep = parkingActionPrep(w, p, step);
  assert.equal(prep.length, 0);
  assert.equal(step.kind, 'operation');
  if (step.kind !== 'operation') throw Error('Expected a vehicle operation');
  assert.equal(operationAction(step).building, garage.id);
  act(w, p.id, operationAction(step));
  assert.equal(p.vehicle, 25);
});

test('resident travel keeps its current tractor and routes an unused spare through a garage', async () => {
  const { travelPrep, parkingActionPrep } = await import('../src/server/npc/travel');
  const { operation, operationAction } = await import('../src/server/npc/player-operations');
  const { w, p, garage } = setup();
  p.npc = true;
  assert.ok(
    !travelPrep(p, w).some((s) => s.kind === 'act' && s.action.type === 'vehicle'),
    'travel must not silently change an already driven tractor to the starter',
  );
  p.x = 100;
  const step = operation('vehicle', { slot: 25 });
  const prep = parkingActionPrep(w, p, step);
  assert.deepEqual(prep, [{ kind: 'travel', destination: garage.id }]);
  if (step.kind !== 'operation') throw Error('Expected a vehicle operation');
  assert.equal(operationAction(step).building, garage.id);
});

test('blocked garage departures and overloaded tractors cannot disturb stored fleets', () => {
  for (const blocked of [true, false]) {
    const { w, p, garage } = setup();
    p.parkedFuel = { 25: 9 };
    migrateParkedVehicles(w);
    if (blocked) w.settings.seaLevel = 50;
    else p.inventory = { wood: 10000 };
    const before = JSON.stringify(w);
    assert.throws(
      () => act(w, p.id, { type: 'vehicle', slot: 25, building: garage.id }),
      blocked ? /No safe clear parking/ : /Unload/,
    );
    assert.equal(JSON.stringify(w), before);
  }
});

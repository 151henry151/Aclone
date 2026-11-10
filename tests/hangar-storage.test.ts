// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { trailerStorage } from '../src/shared/stored-trailers';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('hangar', 'Hangar', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  Object.assign(w, {
    roads: [],
    towns: [],
    zones: [],
    buildings: [],
    terrain: [],
    airfield: undefined,
    spaceportSite: undefined,
    landscape: {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    },
  });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    vehiclesPersist: true,
    arrivalAnimation: 'off',
    garageStoresSpareTractors: false,
    vehicleLicences: false,
    requireCaptainSkill: false,
  });
  const b = makeBuilding('hangar', 'garage', 0, 0);
  b.aircraftHangar = true;
  w.buildings = [b];
  const p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, {
    vehicle: 0,
    fleet: [0, 2, 5],
    x: 0,
    z: 17,
    y: 0,
    heading: Math.PI,
    fuel: 31,
    fuelVehicle: 0,
    speed: 0,
    inventory: { bread: 2 },
    online: true,
  });
  w.parkedVehicles = {};
  w.trailers = {
    tip: {
      id: 'tip',
      owner: p.id,
      kind: 'dump',
      x: 0,
      z: 23,
      heading: Math.PI,
      cargo: { dirt: 9 },
      attached: p.id,
    },
  };
  return { w, p, b };
}
test('entering the hangar stores a tractor and its loaded rig before boarding a plane', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'approach', building: b.id });
  assert.equal(p.inside, b.id);
  assert.equal(p.vehicle, 5);
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
  assert.equal(w.parkedVehicles!['owner:0'].garageStored, true);
  assert.equal(w.parkedVehicles!['owner:0'].fuel, 31);
  assert.equal(trailerStorage(w, w.trailers!.tip), b.id);
  assert.deepEqual(w.trailers!.tip.cargo, { dirt: 9 });
  act(w, p.id, { type: 'exitBuilding' });
  act(w, p.id, { type: 'vehicle', slot: 2, building: b.id });
  assert.equal(p.vehicle, 2);
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
  act(w, p.id, { type: 'approach', building: b.id });
  act(w, p.id, { type: 'garageStorage', operation: 'retrieveVehicle', building: b.id, slot: 0 });
  assert.equal(w.parkedVehicles!['owner:0'].inside, undefined);
  assert.equal(w.parkedVehicles!['owner:0'].fuel, 31);
  assert.equal(trailerStorage(w, w.trailers!.tip), undefined);
  assert.deepEqual(w.trailers!.tip.cargo, { dirt: 9 });
});
test('hangar storage survives save/load and animation completion without releasing the rig', () => {
  const { w, p, b } = setup();
  w.settings.arrivalAnimation = 'quick';
  act(w, p.id, { type: 'approach', building: b.id });
  assert.equal(w.parkedVehicles!['owner:0'].inside, b.id);
  advance(w, p.task!.end - w.time);
  assert.equal(p.inside, b.id);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds().find((x) => x.world.id === w.id)!.world;
    assert.equal(loaded.parkedVehicles!['owner:0'].inside, b.id);
    assert.equal(trailerStorage(loaded, loaded.trailers!.tip), b.id);
  } finally {
    store.close();
  }
});
test('disabled storage retains ordinary parking and storage limits refuse entry atomically', () => {
  const { w, p, b } = setup();
  w.settings.garageStorageEnabled = false;
  act(w, p.id, { type: 'approach', building: b.id });
  assert.equal(w.parkedVehicles!['owner:0'].inside, undefined);
  for (const scenario of ['limit', 'foreign', 'range']) {
    const { w, p, b } = setup();
    if (scenario === 'limit') w.settings.garageStorageLimit = 1;
    if (scenario === 'foreign') w.trailers!.tip.owner = 'other';
    if (scenario === 'range') w.settings.garageStorageRange = 2;
    const before = structuredClone(w);
    assert.throws(() => act(w, p.id, { type: 'approach', building: b.id }), /limit|own|range/);
    assert.deepEqual(w, before);
  }
});
test('hangar retrieval respects ownership and blocked exits while preserving storage', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'approach', building: b.id });
  const foreign = addPlayer(w, 'foreign', 'Other');
  Object.assign(foreign, { vehicle: 5, x: 0, z: 12, y: 0 });
  assert.throws(
    () =>
      act(w, foreign.id, {
        type: 'garageStorage',
        operation: 'retrieveVehicle',
        building: b.id,
        slot: 0,
      }),
    /own/,
  );
  w.settings.parkingSearchRange = 5;
  const before = structuredClone(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'garageStorage',
        operation: 'retrieveVehicle',
        building: b.id,
        slot: 0,
      }),
    /No safe/,
  );
  assert.deepEqual(w, before);
});

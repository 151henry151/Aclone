import { parkedVehicle, GARAGE_STORAGE } from '../src/shared/parked-vehicles';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, terrainHeight } from '../src/shared/simulation';
import { actionBlocker } from '../src/client/action-visibility';
import { vehicleRecord } from '../src/shared/vehicle-services';
import { worldItems } from '../src/shared/world-catalogue';
import { Store } from '../src/server/store';

function setup() {
  const w = createWorld('parking', 'Parking', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off' });
  Object.assign(p, {
    x: 0,
    z: 0,
    heading: 0,
    y: terrainHeight(w, 0, 0),
    online: true,
    fuel: 31,
    fuelVehicle: 0,
    speed: 0,
    inventory: { fuel: 2 },
  });
  p.vehiclePaints = { 0: 'plum' };
  vehicleRecord(w, p).condition = 63;
  return { w, p };
}

test('walking parks the actual vehicle and tank; returning restores them once', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const parked = (w as any).parkedVehicles?.['owner:0'];
  assert.ok(parked, 'walking must leave a persistent vehicle at the departure point');
  assert.deepEqual(
    [parked.x, parked.z, parked.heading, parked.fuel, parked.condition, parked.paint],
    [0, 0, 0, 31, 63, 'plum'],
  );
  assert.equal(p.vehicle, 5);
  assert.equal(p.x, -1.4);
  assert.equal(p.z, 0);
  assert.equal(p.parkedFuel?.[0], undefined);
  assert.equal(p.fuel, 0, 'fuel belongs to the parked machine, not the walker');
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.vehicle, 0);
  assert.equal(p.fuel, 31);
  assert.equal(vehicleRecord(w, p).condition, 63);
  assert.equal((w as any).parkedVehicles['owner:0'], undefined);
});

test('distant return is refused without mutation and the button explains the distance', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 40;
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 0 }),
    /Walk to your tractor first.*40 m/,
  );
  assert.equal(JSON.stringify(w), before);
  assert.match(actionBlocker(w, p, 'tractor') ?? '', /Walk to your tractor first.*40 m/);
});

test('carried fuel fills only the nearby parked tank and persists through a save', () => {
  const { w, p } = setup();
  p.fuel = 0;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 40;
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'refuelParked', slot: 0 }), /Walk.*vehicle|within/);
  assert.equal(JSON.stringify(w), before);
  assert.throws(() => act(w, p.id, { type: 'use', item: 'fuel' }), /Walk.*vehicle|within/);
  assert.equal(p.inventory.fuel, 2);
  p.x = -1.4;
  act(w, p.id, { type: 'refuelParked', slot: 0 });
  assert.equal((w as any).parkedVehicles['owner:0'].fuel, worldItems(w).fuel.fuel);
  assert.equal(p.inventory.fuel, 1);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.deepEqual((loaded as any).parkedVehicles, (w as any).parkedVehicles);
  } finally {
    store.close();
  }
});

test('disabled persistence retains instant switching, while custom return reach is enforced', () => {
  const { w, p } = setup();
  Object.assign(w.settings, { vehiclesPersist: false });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 40;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.x, 40);
  assert.equal(p.fuel, 31);
  assert.equal(Object.keys((w as any).parkedVehicles ?? {}).length, 0);
  Object.assign(w.settings, { vehiclesPersist: true, parkingReturnRange: 6 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 45;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.x, 40, 'boarding returns to the physical machine');
});

test('garage switching stores the old tractor and refuses remote recall of an outside one', () => {
  const { w, p } = setup();
  const b = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [b];
  p.fleet = [0, 5, 24];
  p.parkedFuel = { 24: 12 };
  act(w, p.id, { type: 'vehicle', slot: 24, building: b.id });
  assert.equal((w as any).parkedVehicles?.['owner:0']?.inside, GARAGE_STORAGE);
  assert.equal(p.fuel, 12);
  p.x = 70;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 0;
  p.z = 0;
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 24, building: b.id }),
    /Walk to your tractor first/,
  );
  assert.equal(JSON.stringify(w), before);
});

test('parking controls validate atomically and survive editor, save and design round trips', async () => {
  const { parkingFields } = await import('../src/shared/parking-rules');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p } = setup();
  const patch = {
    vehiclesPersist: true,
    parkingNpcs: false,
    parkingSignOff: false,
    parkingGraceDays: 12,
    parkingTowFee: 3456,
    parkingReturnRange: 6,
    parkingDoorOffset: 2,
    parkingSearchRange: 45,
    parkingMountSeconds: 2,
    arrivalAnimation: 'quick',
    arrivalWalkIn: false,
    arrivalQuickSeconds: 1.5,
    arrivalMinSeconds: 3,
    arrivalMaxSeconds: 5,
    arrivalRange: 20,
    arrivalDoorDegrees: 100,
  };
  act(w, p.id, { type: 'settings', patch });
  for (const invalid of [
    { parkingGraceDays: -1 },
    { parkingReturnRange: 0 },
    { parkingTowFee: Infinity },
    { parkingNpcs: 1 },
    { arrivalAnimation: 'invalid' },
    { arrivalWalkIn: 'yes' },
    { arrivalMinSeconds: 6, arrivalMaxSeconds: 4 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch: invalid }));
    assert.equal(JSON.stringify(w), before);
  }
  const html = settingsFields(w.settings);
  for (const key of Object.keys(parkingFields)) assert.ok(html.includes(`name="${key}"`), key);
  assert.match(rulesSummary(w), /Parking.*12.*3456/);
  assert.match(rulesSummary(w), /walking entry false/);
  const dest = createWorld('copy', 'Copy', p.id);
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const [key, value] of Object.entries(patch)) {
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((dest.settings as any)[key], value);
    }
  } finally {
    store.close();
  }
});

test('garage storage cannot be requested remotely or while occupied with another activity', () => {
  const { w, p } = setup();
  const b = makeBuilding('garage', 'garage', 100, 100);
  w.buildings = [b];
  p.fleet = [0, 5, 24];
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 24, building: b.id }),
    /within|near|Visit|Move/,
  );
  assert.equal(JSON.stringify(w), before);
  b.x = 0;
  b.z = -12;
  p.task = { kind: 'labour', end: w.time + 10 };
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 24, building: b.id }),
    /activity|Finish|Stop/,
  );
});

test('NPC parking opt-out and customized driver offset use the same switching rules', () => {
  const { w, p } = setup();
  p.npc = true;
  Object.assign(w.settings, { parkingNpcs: false, parkingDoorOffset: 2 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(w.parkedVehicles?.['owner:0'], undefined);
  p.x = 20;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.x, 20);
  w.settings.parkingNpcs = true;
  p.heading = Math.PI / 2;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.z, 2);
  assert.ok(w.parkedVehicles?.['owner:0']);
});

test('parked refuelling honors help policy, custom item rate and full or missing targets without loss', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const helper = addPlayer(w, 'helper', 'Helper');
  Object.assign(helper, { x: p.x, z: p.z, y: p.y, speed: 0, online: true, inventory: { fuel: 2 } });
  w.settings.allowPlayerRefuelling = false;
  assert.throws(
    () => act(w, helper.id, { type: 'refuelParked', owner: p.id, slot: 0 }),
    /disabled/,
  );
  w.settings.allowPlayerRefuelling = true;
  w.settings.fuelUnitsPerItem = 4;
  act(w, helper.id, { type: 'refuelParked', owner: p.id, slot: 0 });
  assert.equal(w.parkedVehicles!['owner:0'].fuel, 35);
  assert.equal(helper.inventory.fuel, 1);
  for (const owner of [p.id, 'missing']) {
    w.parkedVehicles!['owner:0'].fuel = 64;
    const before = JSON.stringify(w);
    assert.throws(
      () => act(w, helper.id, { type: 'refuelParked', owner, slot: 0 }),
      /full|available/,
    );
    assert.equal(JSON.stringify(w), before);
  }
});

test('legacy spare tanks migrate once to safe home parking, preserving the current driver', async () => {
  const parking = await import('../src/shared/parked-vehicles');
  const { w, p } = setup();
  w.settings.garageStoresSpareTractors = false;
  const home = makeBuilding('home', 'home', 0, -12);
  home.owner = p.id;
  w.buildings = [home];
  p.home = home.id;
  p.fleet = [0, 5, 24];
  p.parkedFuel = { 24: 17 };
  const driver = { x: p.x, z: p.z, fuel: p.fuel, vehicle: p.vehicle };
  (parking as any).migrateParkedVehicles(w);
  assert.deepEqual({ x: p.x, z: p.z, fuel: p.fuel, vehicle: p.vehicle }, driver);
  const v = w.parkedVehicles?.['owner:24'];
  assert.ok(v);
  assert.equal(v.fuel, 17);
  assert.equal(p.parkedFuel[24], undefined);
  assert.ok(terrainHeight(w, v.x, v.z) > w.settings.seaLevel);
  assert.notDeepEqual([v.x, v.z], [home.x, home.z]);
  const after = JSON.stringify(w);
  (parking as any).migrateParkedVehicles(w);
  assert.equal(JSON.stringify(w), after);
});

test('migration leaves blocked legacy fuel pending and public activation respects later overrides', async () => {
  const parking = await import('../src/shared/parked-vehicles');
  const { w, p } = setup();
  w.settings.garageStoresSpareTractors = false;
  p.parkedFuel = { 24: 17 };
  p.fleet = [0, 5, 24];
  w.settings.seaLevel = 50;
  w.buildings = [makeBuilding('garage', 'garage', 0, -12)];
  (parking as any).migrateParkedVehicles(w);
  assert.equal(w.parkedVehicles?.['owner:24'], undefined);
  assert.equal(p.parkedFuel[24], 17);
  w.id = 'puddlewick';
  w.owner = 'server';
  w.settings.vehiclesPersist = false;
  (parking as any).prepareParkingRules(w);
  assert.equal(w.settings.vehiclesPersist, true);
  w.settings.vehiclesPersist = false;
  (parking as any).prepareParkingRules(w);
  assert.equal(w.settings.vehiclesPersist, false);
});

test('home and lodging leave the tractor at a clear kerb, with foot or tractor departures', () => {
  for (const kind of ['home', 'hotel']) {
    const { w, p } = setup();
    const b = makeBuilding('home', kind, 0, -12);
    b.owner = kind === 'home' ? p.id : undefined;
    if (kind === 'hotel')
      (b as any).lodging = { guests: { [p.id]: { until: w.time + 100, stock: {} } } };
    w.buildings = [b];
    act(w, p.id, { type: 'home', building: b.id });
    const v = w.parkedVehicles?.['owner:0'];
    assert.ok(v, kind);
    assert.equal(v.fuel, 31);
    assert.equal(p.vehicle, 5);
    assert.equal(p.atHome, true);
    assert.equal(v.inside, undefined);
    act(w, p.id, { type: 'outside' });
    assert.equal(p.atHome, false);
    assert.equal(p.vehicle, 5);
    assert.ok(Math.hypot(p.x - v.x, p.z - v.z) < 18);
    act(w, p.id, { type: 'home', building: b.id });
    act(w, p.id, { type: 'outside', depart: 'tractor' });
    assert.equal(p.vehicle, 0);
    assert.equal(p.fuel, 31);
    assert.equal(w.parkedVehicles?.['owner:0'], undefined);
  }
});

test('home refuses a flooded parking site before changing a driver or tank', () => {
  const { w, p } = setup();
  const b = makeBuilding('home', 'home', 0, -12);
  b.owner = p.id;
  w.buildings = [b];
  w.settings.seaLevel = 50;
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'home', building: b.id }), /safe.*park|clear.*park/i);
  assert.equal(JSON.stringify(w), before);
});

test('sign-off leaves a named empty vehicle in public snapshots and reconnect restores only a saved seat', async () => {
  const parking = await import('../src/shared/parked-vehicles');
  const { prepareFrame } = await import('../src/server/snapshots');
  const { w, p } = setup();
  p.lights = true;
  p.engine = true;
  (parking as any).parkOnSignOff(w, p);
  p.online = false;
  const frame = prepareFrame(w),
    record = JSON.parse(frame.fields.parkedVehicles)['owner:0'];
  assert.equal(record.ownerName, p.name);
  assert.equal(record.fuel, 31);
  assert.equal(frame.players[p.id], undefined, 'offline person must not remain a second obstacle');
  assert.equal(p.engine, false);
  assert.equal(p.lights, false);
  p.x = 100;
  (parking as any).restoreParkedSeat(w, p);
  assert.equal(p.vehicle, 0);
  assert.equal(p.x, 0);
  assert.equal(p.fuel, 31);
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 30;
  (parking as any).parkOnSignOff(w, p);
  (parking as any).restoreParkedSeat(w, p);
  assert.equal(p.vehicle, 5);
  assert.equal(p.x, 30);
  assert.ok(w.parkedVehicles?.['owner:0']);
});

test('sign-off hide policy leaves the driven vehicle intact; absence clears parked records', async () => {
  const parking = await import('../src/shared/parked-vehicles');
  const { advance } = await import('../src/shared/simulation');
  const { w, p } = setup();
  w.settings.parkingSignOff = false;
  (parking as any).parkOnSignOff(w, p);
  assert.equal(p.vehicle, 0);
  assert.equal(w.parkedVehicles?.['owner:0'], undefined);
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.online = false;
  p.lastSeen = w.time;
  w.settings.maxOfflineDays = 0.00001;
  advance(w, 2);
  assert.equal(w.parkedVehicles?.['owner:0'], undefined);
});

test('hitched trailers remain with the parked tractor instead of following its walker', async () => {
  const { moveTrailer, attachedTrailer } = await import('../src/shared/trailers');
  const { w, p } = setup();
  w.trailers = {
    box: {
      id: 'box',
      owner: p.id,
      kind: 'box',
      x: 0,
      z: -7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
    },
  };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const trailer = structuredClone(w.trailers.box),
    before = { x: p.x, z: p.z, heading: p.heading };
  p.x = 10;
  moveTrailer(w, p, before, 1);
  assert.deepEqual(w.trailers.box, trailer);
  assert.equal(trailer.attached, p.id);
  assert.equal(attachedTrailer(w, p), undefined, 'walking has no trailer load or drawbar');
  p.x = -1.4;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(attachedTrailer(w, p)?.id, 'box');
  assert.deepEqual(w.trailers.box.cargo, { wood: 2 });
});

test('turning persistence off recovers physical tanks once without duplicating the parked machine', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'vehicle', slot: 5 });
  w.settings.vehiclesPersist = false;
  p.x = 40;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.fuel, 31);
  assert.equal(p.x, 40);
  assert.equal(w.parkedVehicles?.['owner:0'], undefined);
  w.settings.vehiclesPersist = true;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(parkedVehicle(w, p, 0)?.fuel, 31);
});

test('resident travel returns to the parked tractor and never prepends another return to its own walk', async () => {
  const { travelPrep } = await import('../src/server/npc/travel');
  const { w, p } = setup();
  p.npc = true;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 40;
  const plan = (travelPrep as any)(p, w);
  assert.equal(plan[0]?.kind, 'move');
  assert.deepEqual([plan[0].x, plan[0].z], [0, 0]);
  assert.deepEqual((travelPrep as any)(p, w, plan[0]), []);
  p.x = -1.4;
  for (const step of (travelPrep as any)(p, w)) if (step.kind === 'act') act(w, p.id, step.action);
  assert.equal(p.vehicle, 0);
  assert.equal(p.fuel, 31);
  assert.equal(p.engine, true);
});

test('a stranded resident buys fuel on foot, walks back, and only then refuels and boards', async () => {
  const { drivePlan, travelPrep } = await import('../src/server/npc/travel');
  const { w, p } = setup();
  p.npc = true;
  p.fuel = 0;
  p.inventory = {};
  const shop = makeBuilding('shop', 'market', 50, 0);
  shop.stock.fuel = 10;
  shop.sell.fuel = 100;
  w.buildings = [shop];
  const plan = drivePlan(w, p);
  let bought = false,
    returned = false;
  for (const step of plan) {
    if (step.kind === 'travel') {
      p.x = shop.x;
      p.z = shop.z;
    }
    if (step.kind === 'move') {
      assert.equal(bought, true);
      p.x = step.x - 1.4;
      p.z = step.z;
      returned = true;
      assert.deepEqual((travelPrep as any)(p, w, step), []);
    }
    if (step.kind === 'act') {
      if (step.action.type === 'use') assert.equal(returned, true);
      act(w, p.id, step.action);
      if (step.action.type === 'trade') bought = true;
    }
  }
  assert.equal(bought, true);
  assert.equal(returned, true);
  assert.equal(p.vehicle, 0);
  assert.ok(p.fuel > 0);
});

test('a stalled engine is restarted after a resident walks to buy fuel and returns', async () => {
  const { drivePlan } = await import('../src/server/npc/travel');
  const { w, p } = setup();
  p.npc = true;
  p.fuel = 0;
  p.engine = true;
  p.inventory = {};
  const shop = makeBuilding('shop', 'market', 50, 0);
  shop.stock.fuel = 10;
  shop.sell.fuel = 100;
  w.buildings = [shop];
  for (const step of drivePlan(w, p)) {
    if (step.kind === 'travel') {
      p.x = shop.x;
      p.z = shop.z;
    } else if (step.kind === 'move') {
      p.x = step.x - 1.4;
      p.z = step.z;
    } else if (step.kind === 'act') act(w, p.id, step.action);
  }
  assert.equal(p.vehicle, 0);
  assert.ok(p.fuel > 0);
  assert.equal(p.engine, true);
});

test('disabling persistence while another tractor is driven preserves both tanks', () => {
  const { w, p } = setup();
  const garage = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [garage];
  p.fleet = [0, 5, 24];
  p.parkedFuel = { 24: 12 };
  act(w, p.id, { type: 'vehicle', slot: 24, building: garage.id });
  w.settings.vehiclesPersist = false;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.fuel, 31);
  assert.equal(p.parkedFuel?.[24], 12);
  act(w, p.id, { type: 'vehicle', slot: 24 });
  assert.equal(p.fuel, 12);
});

test('a driver whose signed-off vehicle was towed into a garage reconnects in that vehicle', async () => {
  const { parkOnSignOff, restoreParkedSeat } = await import('../src/shared/parked-vehicles');
  const { w, p } = setup();
  parkOnSignOff(w, p);
  const record = w.parkedVehicles!['owner:0'];
  Object.assign(record, { inside: 'garage', x: 50, z: 50 });
  restoreParkedSeat(w, p);
  assert.equal(p.vehicle, 0);
  assert.equal(p.x, 50);
  assert.equal(p.fuel, 31);
  assert.equal(w.parkedVehicles!['owner:0'], undefined);
});

test('home kerb parking relocates the whole hitched rig and preserves cargo and relative hitch position', () => {
  const { w, p } = setup();
  const b = makeBuilding('home', 'home', 0, -12);
  b.owner = p.id;
  w.buildings = [b];
  w.trailers = {
    box: {
      id: 'box',
      owner: p.id,
      kind: 'box',
      x: 0,
      z: -7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
    },
  };
  act(w, p.id, { type: 'home', building: b.id });
  const v = parkedVehicle(w, p, 0)!,
    t = w.trailers.box;
  assert.equal(t.parkedWith, 'owner:0');
  assert.equal(t.x, v.x);
  assert.equal(t.z, v.z - 7);
  assert.deepEqual(t.cargo, { wood: 2 });
});

test('persistent land parking leaves the existing walking boat-tank refuelling behavior intact', async () => {
  const { MOTORBOAT } = await import('../src/shared/boats');
  const { w, p } = setup();
  Object.assign(p, { vehicle: 5, fuelVehicle: MOTORBOAT, fuel: 0 });
  act(w, p.id, { type: 'use', item: 'fuel' });
  assert.equal(p.fuel, worldItems(w).fuel.fuel);
  assert.equal(p.inventory.fuel, 1);
});

test('a garage visit drives a stored tractor out to a clear kerb and stores the arrival tractor', () => {
  const { w, p } = setup();
  const b = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [b];
  p.fleet = [0, 5, 24];
  act(w, p.id, { type: 'approach', building: b.id });
  assert.equal(p.inside, b.id);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 24, building: b.id }), /outside/i);
  act(w, p.id, { type: 'exitBuilding' });
  act(w, p.id, { type: 'vehicle', slot: 24, building: b.id });
  assert.equal(p.inside, undefined);
  assert.equal(p.vehicle, 24);
  assert.equal(parkedVehicle(w, p, 0)?.inside, GARAGE_STORAGE);
  assert.equal(
    p.parkedFuel?.[0],
    undefined,
    'stored tank must not acquire a duplicate legacy placeholder',
  );
  assert.ok(Math.hypot(p.x - b.x, p.z - b.z) > 5);
  p.inside = b.id;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }), /outside|garage/i);
});

test('stored tractor drive-out brings its hitched trailer to the same clear departure point', async () => {
  const { trailerBlocks } = await import('../src/shared/trailers');
  const { w, p } = setup();
  const b = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [b];
  p.fleet = [0, 5, 24];
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const v = parkedVehicle(w, p, 0)!;
  v.inside = b.id;
  w.trailers = {
    box: {
      id: 'box',
      kind: 'box',
      owner: p.id,
      x: v.x,
      z: v.z - 7,
      heading: 0,
      cargo: { wood: 2 },
      attached: p.id,
      parkedWith: 'owner:0',
    },
  };
  const old = { x: w.trailers.box.x, z: w.trailers.box.z };
  assert.equal(trailerBlocks(w, old, old, 1), false, 'stored trailer has no phantom road obstacle');
  act(w, p.id, { type: 'vehicle', slot: 0, building: b.id });
  const t = w.trailers.box;
  assert.equal(t.x, p.x);
  assert.equal(t.z, p.z - 7);
  assert.equal(t.parkedWith, undefined);
  assert.deepEqual(t.cargo, { wood: 2 });
});

test('resident boarding uses exact return reach, including operations for other tractor models', async () => {
  const { Navigator } = await import('../src/server/npc/navigation');
  const { parkingActionPrep, parkingDestination } = await import('../src/server/npc/travel');
  const { operation } = await import('../src/server/npc/player-operations');
  const { w, p } = setup();
  p.fleet = [0, 5, 24];
  p.vehicle = 24;
  p.fuelVehicle = 24;
  p.npc = true;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x = 40;
  const prep = parkingActionPrep(w, p, operation('vehicle', { slot: 24 }));
  assert.equal(prep[0]?.kind, 'move');
  p.x = 3.4;
  const v = parkedVehicle(w, p, 24)!;
  const target = parkingDestination(w, p, v);
  assert.equal(target?.radius, 3);
  const nav = new Navigator(w, p, v, target!.radius, true);
  assert.notEqual(
    nav.step(w, p, 0.1).arrived,
    true,
    'ordinary navigation tolerance must not stop beyond boarding reach',
  );
  w.settings.parkingReturnRange = 4.5;
  assert.equal(parkingDestination(w, p, v)?.radius, 4.5);
});

test('accepted NPC vehicle and fuel actions recover stored tractors through their actual garage', async () => {
  const { parkingActionPrep } = await import('../src/server/npc/travel');
  const { operation, operationAction } = await import('../src/server/npc/player-operations');
  for (const useFuel of [false, true]) {
    const { w, p } = setup();
    w.creator = { ...w.creator, scenery: false } as any;
    w.landscape = {
      heightmap: Array(1089).fill(0),
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
    };
    w.settings.seaLevel = -10;
    p.npc = true;
    act(w, p.id, { type: 'vehicle', slot: 5 });
    const b = makeBuilding('garage', 'garage', 50, 0);
    w.buildings = [b];
    w.parkedVehicles!['owner:0'].inside = b.id;
    p.x = 50;
    p.z = 12;
    p.y = 0;
    const step = useFuel
      ? { kind: 'act' as const, action: { type: 'use' as const, item: 'fuel' } }
      : operation('vehicle', { slot: 0 });
    const prep = parkingActionPrep(w, p, step);
    for (const s of prep) {
      if (s.kind === 'act') act(w, p.id, s.action);
      else if (s.kind === 'operation') act(w, p.id, operationAction(s));
      else assert.fail('Already at the garage, no extra travel is necessary');
    }
    if (step.kind === 'operation') assert.doesNotThrow(() => act(w, p.id, operationAction(step)));
    else if (step.kind === 'act') assert.doesNotThrow(() => act(w, p.id, step.action));
    assert.equal(p.vehicle, 0);
    assert.equal(p.fuel, useFuel ? 39 : 31);
    assert.equal(w.parkedVehicles!['owner:0'], undefined);
  }
});

test('NPC garage recovery plans survive validation and persistence', async () => {
  const { travelPrep } = await import('../src/server/npc/travel');
  const { stepSchema } = await import('../src/server/npc/decision');
  const { w, p } = setup();
  p.npc = true;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  const b = makeBuilding('garage', 'garage', 50, 0);
  w.buildings = [b];
  w.parkedVehicles!['owner:0'].inside = b.id;
  const plan = travelPrep(p, w, { kind: 'travel', destination: 'elsewhere' });
  for (const step of plan) assert.doesNotThrow(() => stepSchema.parse(step));
});

test('world builders can tune and reset distant parked vehicles without boarding them', () => {
  const { w, p } = setup();
  p.authority = 20;
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.x += 100;
  assert.doesNotThrow(() => act(w, p.id, { type: 'vehicleTuning', slot: 0, tuning: { width: 3 } }));
  assert.equal(w.vehicleTuning?.[0]?.width, 3);
  assert.doesNotThrow(() => act(w, p.id, { type: 'vehicleReset', slot: 0 }));
  assert.equal(w.vehicleTuning?.[0], undefined);
  assert.equal(p.vehicle, 5);
  assert.equal(w.parkedVehicles!['owner:0'].fuel, 31);
});

test('enabling persistence migrates spare tanks immediately without changing the driver', () => {
  const { w, p } = setup();
  w.settings.vehiclesPersist = false;
  w.settings.seaLevel = -100;
  w.buildings = [makeBuilding('garage', 'garage', 100, 100)];
  p.fleet = [0, 5, 24];
  p.parkedFuel = { 24: 19 };
  act(w, p.id, { type: 'settings', patch: { vehiclesPersist: true } });
  assert.equal(parkedVehicle(w, p, 24)?.fuel, 19);
  assert.equal(parkedVehicle(w, p, 24)?.inside, GARAGE_STORAGE);
  assert.equal(p.parkedFuel[24], undefined);
  assert.equal(p.vehicle, 0);
  assert.equal(p.fuel, 31);
});

test('garage repaint updates a parked vehicle and survives boarding', () => {
  const { w, p } = setup();
  const garage = makeBuilding('garage', 'garage', 0, -12);
  w.buildings = [garage];
  act(w, p.id, { type: 'vehicle', slot: 5 });
  act(w, p.id, { type: 'paint', building: garage.id, slot: 0, color: 'rust' });
  assert.equal(parkedVehicle(w, p, 0)?.paint, 'rust');
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal(p.vehiclePaints?.[0], 'rust');
});

test('building arrival retains usable nearby trailer trade without moving its parked rig', () => {
  const { w, p } = setup();
  w.settings.seaLevel = -100;
  const shop = makeBuilding('shop', 'market', 12, 0);
  shop.stock = { fuel: 10 };
  shop.sell = { fuel: 100 };
  w.buildings = [shop];
  w.trailers = {
    box: {
      id: 'box',
      owner: p.id,
      kind: 'box',
      x: 0,
      z: -7,
      heading: 0,
      attached: p.id,
      cargo: {},
    },
  };
  act(w, p.id, { type: 'approach', building: shop.id });
  const rig = { x: w.trailers.box.x, z: w.trailers.box.z };
  assert.equal(p.inside, shop.id);
  act(w, p.id, {
    type: 'trade',
    building: shop.id,
    storage: 'trailer',
    item: 'fuel',
    quantity: 1,
    direction: 'buy',
  });
  assert.equal(w.trailers.box.cargo.fuel, 1);
  assert.deepEqual({ x: w.trailers.box.x, z: w.trailers.box.z }, rig);
  p.x += 500;
  delete p.inside;
  assert.throws(() =>
    act(w, p.id, {
      type: 'trade',
      building: shop.id,
      storage: 'trailer',
      item: 'fuel',
      quantity: 1,
      direction: 'buy',
    }),
  );
  assert.equal(w.trailers.box.cargo.fuel, 1, 'remote trade leaves cargo unchanged');
});

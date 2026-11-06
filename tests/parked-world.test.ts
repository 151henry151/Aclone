// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { playerContact } from '../src/shared/ground-contacts';
import { constructionSiteReason } from '../src/shared/construction-site';
import { DAY_SECONDS } from '../src/shared/environment';
function setup() {
  const w = createWorld('parking', 'Parking', 'owner');
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.script = '';
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(w.settings, {
    vehiclesPersist: true,
    arrivalAnimation: 'off',
    seaLevel: -10,
    mapSize: 2000,
    vehicleCollision: 'stop-only',
  });
  const p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, {
    x: 300,
    z: 300,
    y: 0,
    heading: 0,
    speed: 0,
    online: true,
    fuel: 31,
    fuelVehicle: 0,
  });
  w.vehicleTuning = { 0: { length: 12, width: 4 } as any };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  return { w, p, v: w.parkedVehicles!['owner:0'] };
}
test('full parked footprints block authoritative and predicted movement without damage', () => {
  const { w, p, v } = setup();
  const q = addPlayer(w, 'other', 'Other');
  Object.assign(q, { x: 300, z: 290, y: 0, heading: 0, speed: 5, online: true });
  p.x = 250;
  p.z = 250; // The collision must be with the parked machine, not its nearby walker.
  const before = structuredClone(v),
    health = q.health;
  for (const prediction of [false, true]) {
    const result = playerContact(w, q, { x: 300, z: 297 }, prediction);
    assert.equal(result.stopped, true);
    assert.equal(result.point.z, 290);
    assert.equal(q.health, health);
    assert.deepEqual(v, before);
  }
  w.settings.vehicleCollision = 'off';
  assert.deepEqual(playerContact(w, q, { x: 300, z: 297 }, false).point, { x: 300, z: 297 });
  w.settings.vehicleCollision = 'glancing';
  p.x = 297;
  p.z = 296;
  const slide = playerContact(w, p, { x: 299, z: 303 }, false);
  assert.ok(slide.point.x < 298 && slide.point.z > 296, 'walker slides alongside the parked hull');
});
test('construction covers the full parked hull even when its centre is outside the new foundation', () => {
  const { w, v } = setup();
  const b = makeBuilding('new', 'home', 300, 310);
  assert.equal(
    constructionSiteReason(w, b),
    undefined,
    'fixture is a valid building site before moving hull',
  );
  v.z = 305;
  assert.match(constructionSiteReason(w, b) ?? '', /parked vehicle/i);
  v.inside = 'garage';
  assert.equal(
    constructionSiteReason(w, b),
    undefined,
    'garage interior is not a second outdoor obstacle',
  );
});
test('a parked aircraft reserves the hangar apron for another pilot', () => {
  const { w, p, v } = setup();
  const b = makeBuilding('hangar', 'garage', 300, 300);
  b.aircraftHangar = true;
  w.buildings = [b];
  Object.assign(v, { slot: 2, x: 300, z: 317 });
  delete w.parkedVehicles!['owner:0'];
  w.parkedVehicles!['owner:2'] = v;
  const q = addPlayer(w, 'other', 'Other');
  Object.assign(q, { x: 300, z: 313, y: 0, speed: 0, fleet: [0, 5, 2], online: true });
  p.x = 500;
  p.z = 500;
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, q.id, { type: 'vehicle', slot: 2, building: b.id }),
    /apron.*occupied/,
  );
  assert.equal(JSON.stringify(w), before);
});
test('road parking tows once after game-clock grace, preserves the machine, and records the fee', () => {
  const { w, p, v } = setup();
  w.roads = [{ a: { x: 280, z: 300 }, b: { x: 330, z: 300 }, width: 6 }];
  const b = makeBuilding('garage', 'garage', 340, 300);
  w.buildings = [b];
  p.x = 200;
  p.z = 200;
  const fuel = v.fuel,
    cash = p.cash;
  advance(w, 7 * DAY_SECONDS - 1);
  assert.equal(v.inside, undefined);
  assert.equal(p.cash, cash);
  advance(w, 1);
  assert.equal(v.inside, b.id);
  assert.equal(v.fuel, fuel);
  assert.equal(p.cash, cash - 2000);
  assert.ok(w.ledger.some((e) => e.reason.includes('parking') && e.amount === 2000));
  assert.ok(w.messages.some((m) => m.text.includes('towed') && m.to === p.id));
  const after = p.cash;
  advance(w, DAY_SECONDS);
  assert.equal(p.cash, after);
});
test('off-road, owned property, hangars and blocked destinations are protected from towing', () => {
  for (const scenario of ['field', 'own', 'hangar', 'blocked']) {
    const { w, p, v } = setup();
    p.x = 200;
    p.z = 200;
    w.settings.parkingGraceDays = 0;
    if (scenario !== 'field')
      w.roads = [{ a: { x: 280, z: 300 }, b: { x: 330, z: 300 }, width: 6 }];
    const b = makeBuilding('garage', 'garage', 340, 300);
    w.buildings = [b];
    if (scenario === 'own') {
      const home = makeBuilding('home', 'home', 300, 300);
      home.owner = p.id;
      w.buildings.push(home);
    }
    if (scenario === 'hangar') {
      const hangar = makeBuilding('hangar', 'garage', 300, 283);
      hangar.aircraftHangar = true;
      w.buildings.push(hangar);
      v.slot = 2;
    }
    if (scenario === 'blocked') w.settings.seaLevel = 50;
    const before = structuredClone(v),
      cash = p.cash;
    advance(w, 1);
    assert.deepEqual(v, before, scenario);
    assert.equal(p.cash, cash, scenario);
  }
});

test('safe kerb searches reject loose trailers and a stored rig cannot overlap another parked vehicle', async () => {
  const { safeParkingPoint } = await import('../src/shared/parking-site');
  const { clearParkedRig } = await import('../src/shared/parked-vehicles');
  const { w, p, v } = setup();
  p.x = 100;
  p.z = 100;
  const point = { x: 400, z: 400, heading: 0 };
  assert.equal(safeParkingPoint(w, 0, point), true);
  w.trailers = {
    loose: { id: 'loose', kind: 'box', owner: 'other', x: 400, z: 400, heading: 0, cargo: {} },
  };
  assert.equal(
    safeParkingPoint(w, 0, point),
    false,
    'do not place a tractor through a loose trailer',
  );
  delete w.trailers.loose;
  w.trailers.rig = {
    id: 'rig',
    kind: 'box',
    owner: p.id,
    x: v.x,
    z: v.z - 12,
    heading: 0,
    cargo: {},
    attached: p.id,
    parkedWith: 'owner:0',
  };
  assert.equal(clearParkedRig(w, 'owner:0', point), true);
  w.parkedVehicles!['other:0'] = { ...v, owner: 'other', x: 400, z: 388 };
  assert.equal(
    clearParkedRig(w, 'owner:0', point),
    false,
    'the trailer footprint must clear every parked vehicle too',
  );
});

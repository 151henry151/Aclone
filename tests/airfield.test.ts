// SPDX-License-Identifier: GPL-3.0-or-later
import { flightState } from '../src/shared/flight';
import { vehicleDef } from '../src/shared/vehicle-config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, makeBuilding } from '../src/shared/simulation';
import { buildings } from '../src/shared/catalog';
import {
  ensurePuddlewickAirfield,
  prepareAirfieldFuelDesk,
} from '../src/server/puddlewick-airfield';
import { airfieldAreas, aircraftCount, onAirfield } from '../src/shared/airfield';
import { terrainHeight } from '../src/shared/terrain';
import { constructionSiteReason } from '../src/shared/construction-site';
import { worldResources } from '../src/shared/resources';
import { Store } from '../src/server/store';
import { landscapeSchema } from '../src/shared/landscape';

function airfield() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 310;
  assert.equal(ensurePuddlewickAirfield(w), true);
  return w;
}
test('public runway targets world dimensions and upgrades a legacy strip without moving its hangar', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 310;
  Object.assign(w.settings, { runwayLength: 400, runwayWidth: 30, runwayShoulder: 18 });
  assert.ok(ensurePuddlewickAirfield(w));
  assert.equal(w.airfield!.width, 30);
  assert.ok(w.airfield!.length >= 240 && w.airfield!.length <= 400);
  const hangar = structuredClone(w.buildings.find((b) => b.aircraftHangar)!);
  w.airfield!.width = 18;
  w.airfield!.length = 240;
  delete (w as any).airfieldLandingVersion;
  assert.ok(ensurePuddlewickAirfield(w));
  assert.equal(w.airfield!.width, 30);
  assert.deepEqual(
    w.buildings.find((b) => b.aircraftHangar),
    hangar,
  );
  assert.equal(ensurePuddlewickAirfield(w), false);
});
test('a clear level site accepts the full target and an actual legacy western strip keeps its hangar and property', () => {
  const clear = createWorld('puddlewick', 'Puddlewick', 'server');
  clear.towns[0].radius = 1000;
  clear.buildings = [];
  clear.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  clear.settings.runwayWidth = 34;
  assert.ok(ensurePuddlewickAirfield(clear));
  assert.equal(clear.airfield!.length, clear.settings.runwayLength);
  assert.equal(clear.airfield!.width, 34);
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 310;
  const hangar = makeBuilding('parish-airfield-hangar', 'garage', -155, -85);
  Object.assign(hangar, {
    aircraftHangar: true,
    foundationY: 0.19,
    owner: 'treasury',
    investment: 1234,
  });
  w.buildings.push(hangar);
  w.airfieldFuelDeskVersion = 1;
  w.airfield = {
    x: -195,
    z: -85,
    length: 240,
    width: 18,
    height: 0.15,
    hangar: hangar.id,
    apronX: -168,
    apronZ: -85,
  };
  const before = structuredClone(w.buildings);
  const elevations = w.buildings.map((b) => terrainHeight(w, b.x, b.z));
  assert.ok(ensurePuddlewickAirfield(w));
  assert.equal(w.airfield.width, 30);
  assert.ok(w.airfield.length >= 240);
  assert.deepEqual(w.buildings, before);
  assert.deepEqual(
    w.buildings.map((b) => terrainHeight(w, b.x, b.z)),
    elevations,
  );
});
test('runway clearance and maximum grading relief use validated world rules', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 1000;
  w.buildings = [];
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  const owner = addPlayer(w, 'server', 'Builder');
  act(w, owner.id, { type: 'settings', patch: { runwayClearance: 16, runwayMaxGrade: 1 } });
  assert.ok(ensurePuddlewickAirfield(w));
  assert.equal(airfieldAreas(w.airfield!)[0].hx, w.airfield!.width / 2 + 16);
  assert.throws(() => act(w, owner.id, { type: 'settings', patch: { runwayMaxGrade: -1 } }));
});
test('public airstrip fits town, preserves private property and gathering IDs, and survives restart once', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 310;
  const before = structuredClone(w.buildings),
    sites = worldResources(w);
  assert.ok(ensurePuddlewickAirfield(w));
  const a = w.airfield!;
  assert.ok(a.length >= 240 && a.length <= w.settings.runwayLength!);
  assert.equal(a.width, w.settings.runwayWidth);
  assert.deepEqual(w.buildings.slice(0, -1), before);
  for (const r of airfieldAreas(a))
    for (const dx of [-r.hx, r.hx])
      for (const dz of [-r.hz, r.hz]) {
        assert.ok(Math.hypot(r.x + dx, r.z + dz) < w.towns[0].radius);
        assert.equal(terrainHeight(w, r.x + dx, r.z + dz), a.height);
      }
  assert.deepEqual(
    worldResources(w).map((n) => n.id),
    sites.map((n) => n.id),
  );
  assert.ok(worldResources(w).every((n) => !onAirfield(w, n.x, n.z, 12)));
  const store = new Store(':memory:');
  store.saveWorld(w);
  const saved = store.loadWorlds()[0].world;
  assert.deepEqual(saved.airfield, a);
  assert.equal(ensurePuddlewickAirfield(saved), false);
  store.db.close();
  assert.match(constructionSiteReason(w, makeBuilding('test', 'home', a.x, a.z))!, /airfield/);
});
test('the public hangar buys fuel above the pumps that sell it, and a delivery is paid from a 500s till', () => {
  const w = airfield();
  const hangar = w.buildings.find((b) => b.aircraftHangar)!;
  assert.equal(hangar.sell.fuel, 5350);
  assert.ok(hangar.buy.fuel > buildings.market.buy.fuel);
  assert.ok(hangar.buy.fuel > buildings.refinery.sell.fuel);
  assert.ok(hangar.buy.fuel > buildings.boathouse.sell.fuel);
  assert.ok(hangar.buy.fuel > buildings.garage.buy.fuel);
  assert.ok(hangar.buy.fuel < hangar.sell.fuel);
  assert.equal(hangar.buy.fuel, 5000);
  assert.equal(hangar.investment, 5_000_000);
  const p = addPlayer(w, 'hauler', 'Hauler');
  p.x = hangar.x;
  p.z = hangar.z;
  p.inventory = { fuel: 4 };
  const cash = p.cash;
  act(w, p.id, {
    type: 'trade',
    building: hangar.id,
    item: 'fuel',
    quantity: 2,
    direction: 'sell',
  });
  assert.equal(p.cash, cash + 10_000);
  assert.equal(p.inventory.fuel, 2);
  assert.equal(hangar.stock.fuel, 102);
  assert.equal(hangar.investment, 5_000_000 - 10_000);
  hangar.buy = {};
  hangar.investment = 12_000;
  delete w.airfieldFuelDeskVersion;
  assert.equal(prepareAirfieldFuelDesk(w), true);
  assert.equal(hangar.buy.fuel, 5000);
  assert.equal(hangar.sell.fuel, 5350);
  assert.equal(hangar.investment, 12_000 + 5_000_000);
  assert.equal(prepareAirfieldFuelDesk(w), false);
  assert.equal(hangar.investment, 12_000 + 5_000_000);
});
test('blocked or foreign worlds do not lose property to airfield placement', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.towns[0].radius = 100;
  const before = JSON.stringify(w);
  assert.equal(ensurePuddlewickAirfield(w), false);
  assert.equal(JSON.stringify(w), before);
  w.id = 'custom';
  w.towns[0].radius = 310;
  assert.equal(ensurePuddlewickAirfield(w), false);
});
test('buying a biplane at the hangar pays that hangar till', () => {
  const w = airfield(),
    hangar = w.buildings.find((b) => b.aircraftHangar)!,
    p = addPlayer(w, 'buyer', 'Buyer');
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  p.inventory = {};
  p.x = hangar.x;
  p.z = hangar.z;
  const price = vehicleDef(w, 2).price;
  const till = hangar.investment;
  p.cash = price - 1;
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 2, building: hangar.id }),
    /Not enough cash/,
  );
  assert.equal(hangar.investment, till);
  assert.equal(!!p.fleet?.includes(2), false);
  p.cash = price + 50;
  act(w, p.id, { type: 'vehicle', slot: 2, building: hangar.id });
  assert.equal(p.vehicle, 2);
  assert.equal(p.cash, 50);
  assert.equal(hangar.investment, till + price);
  const paid = w.ledger.filter((l) => l.reason === 'vehicle purchase');
  assert.deepEqual(
    paid.map((l) => [l.kind, l.amount, l.from, l.to]),
    [['transfer', price, p.id, hangar.id]],
  );
  p.vehicle = 5;
  p.x = hangar.x;
  p.z = hangar.z;
  act(w, p.id, { type: 'vehicle', slot: 2, building: hangar.id });
  assert.equal(p.cash, 50);
  assert.equal(hangar.investment, till + price);
});
test('boarding requires the hangar, safe apron, stopped pilot and cargo fit before consuming a spare', () => {
  const w = airfield(),
    b = w.buildings.find((b) => b.aircraftHangar)!,
    p = addPlayer(w, 'p', 'Pilot');
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  p.spareBiplanes = 4;
  p.cash = 0;
  p.online = true;
  p.x = b.x - 15;
  p.z = b.z;
  const garage = w.buildings.find((b) => b.kind === 'garage' && !b.aircraftHangar)!;
  p.x = garage.x;
  p.z = garage.z;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 2, building: garage.id }), /hangar/);
  p.x = b.x - 15;
  p.z = b.z;
  p.speed = 3;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 2, building: b.id }), /Stop/);
  p.speed = 0;
  p.inventory = { bread: 34, water: 46, fuel: 20, wine: 1 };
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 2, building: b.id }),
    /^Error: Carrying 101 weight; the Biplane holds 90\. Unload 11 before boarding\.$/,
  );
  assert.equal(p.spareBiplanes, 4);
  assert.equal(!!p.fleet?.includes(2), false);
  p.inventory = {};
  const other = addPlayer(w, 'q', 'Other');
  other.online = true;
  other.x = b.x - 17;
  other.z = b.z;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 2, building: b.id }), /occupied/);
  other.online = false;
  act(w, p.id, { type: 'vehicle', slot: 2, building: b.id });
  assert.equal(p.vehicle, 2);
  assert.equal(p.spareBiplanes, 3);
  assert.equal(aircraftCount(p), 4);
  assert.equal(p.engine, false);
  assert.equal(p.fuel, 0);
  assert.equal(p.cash, 0);
  assert.equal(p.x, b.x - 17);
  // A hard impact destroys the commissioned airframe only.
  p.y = terrainHeight(w, p.x, p.z) + 0.01;
  p.speed = 30;
  Object.assign(flightState(p, terrainHeight(w, p.x, p.z)), {
    throttle: 0,
    pitch: 0,
    bank: 0,
    vx: 0,
    vy: -20,
    vz: 30,
    grounded: false,
    airspeed: 30,
  });
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(p.vehicle, 5);
  assert.equal(aircraftCount(p), 3);
  p.x = b.x - 15;
  p.z = b.z;
  act(w, p.id, { type: 'vehicle', slot: 2, building: b.id });
  assert.equal(aircraftCount(p), 3);
  assert.equal(p.spareBiplanes, 2);
  assert.equal(p.fuel, 0);
});
test('a controlled approach lands and stops within the actual public runway', () => {
  const w = airfield(),
    a = w.airfield!,
    p = addPlayer(w, 'pilot', 'Landing pilot');
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  Object.assign(p, {
    vehicle: 2,
    fleet: [0, 5, 2],
    x: a.x,
    z: a.z - a.length / 2 + 5,
    y: a.height + 3,
    heading: 0,
    speed: 26,
    fuel: 50,
    engine: true,
  });
  const f = flightState(p, a.height);
  Object.assign(f, { grounded: false, vz: 26, vy: -1.2, pitch: 0.08, throttle: 0.18 });
  let landed = false;
  for (let t = 0; t < 30; t += 0.05) {
    const grounded = p.flight?.grounded;
    if (grounded) {
      landed = true;
      p.flight!.throttle = 0;
    }
    const agl = p.y - a.height;
    const sink = agl < 1 ? -0.6 : -1.4;
    const speed = Math.max(20, p.flight!.airspeed);
    const angle = (9.81 / (0.0217 * speed ** 2) - 0.28) / 4.5 + Math.atan2(sink, speed);
    move(
      w,
      p,
      {
        throttle: 0,
        steer: 0,
        boost: false,
        pitch: grounded ? 0 : (angle - p.flight!.pitch - p.flight!.pitchRate * 0.7) * 3,
        brake: !!grounded,
      },
      0.05,
    );
    assert.equal(
      p.vehicle,
      2,
      `a gentle runway landing must not destroy the aircraft: ${JSON.stringify({ crash: p.lastFlightCrash, z: p.z })}`,
    );
    if (landed && p.speed < 0.05) break;
  }
  assert.ok(landed);
  assert.ok(p.speed < 0.05);
  assert.ok(p.z < a.z + a.length / 2, 'braked rollout stays on the marked runway');
});

test('worlds without a hangar retain garage boarding, and invalid sites cannot consume spares', () => {
  const w = createWorld('custom', 'Custom', 'owner'),
    p = addPlayer(w, 'pilot', 'Pilot');
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  p.spareBiplanes = 4;
  p.cash = 0;
  p.inventory = {};
  const wrong = w.buildings.find((b) => b.kind !== 'garage')!;
  p.x = wrong.x;
  p.z = wrong.z;
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 2, building: wrong.id }), /hangar/);
  assert.equal(p.spareBiplanes, 4);
  assert.equal(!!p.fleet?.includes(2), false);
  const garage = w.buildings.find((b) => b.kind === 'garage')!;
  p.x = garage.x;
  p.z = garage.z;
  act(w, p.id, { type: 'vehicle', slot: 2, building: garage.id });
  assert.equal(p.vehicle, 2);
  assert.equal(p.spareBiplanes, 3);
});

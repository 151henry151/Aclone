// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, advance } from '../src/shared/simulation';
import { MOTORBOAT, mooringKey } from '../src/shared/boats';
import { rescueAction, reboardReason } from '../src/shared/boat-rescue';
import { tenderAction, moveTender, tenderOf } from '../src/shared/boat-tender';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { fishingVessel } from '../src/shared/boat-fishing';
import { actionVisible } from '../src/client/action-visibility';
import { vehicles } from '../src/shared/catalog';
const setup = () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  w.settings.vehicleLicences = false;
  const p = addPlayer(w, 'p', 'Captain');
  Object.assign(p, {
    vehicle: MOTORBOAT,
    fleet: [0, 5, 30, MOTORBOAT],
    x: 5.5,
    z: 1000,
    y: 0,
    speed: 0,
    heading: 0,
    inventory: { fuel: 2 },
    fuel: 12,
    fuelVehicle: MOTORBOAT,
    parkedFuel: { 30: 0 },
    online: true,
    engine: true,
    cash: 5000000,
  });
  w.boatRescues = {
    p: {
      boat: { x: 0, z: 1000, heading: 0, slot: 30, paint: 'blue' },
      cargo: { cod: 10 },
      dinghy: { x: 0, z: 300, heading: 0, moored: true },
    },
  };
  return { w, p };
};
test('motorboat price, hold, rod fishing and empty-tank oars work', () => {
  const { w, p } = setup();
  delete w.boatRescues;
  p.inventory = {};
  p.fuel = 0;
  const z = p.z;
  for (let i = 0; i < 100; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.1);
  assert.ok(p.z > z + 2);
  assert.ok(p.speed <= 1.6);
  assert.equal(p.fuel, 0);
  assert.equal(fishingVessel(w, p), p);
  assert.equal(vehicles[MOTORBOAT].capacity, 50);
  assert.equal(vehicles[3].price, vehicles[MOTORBOAT].price * 2.5);
});
test('fuel-delivery transfer preserves cargo and both tanks, leaving one real motorboat afloat', () => {
  const { w, p } = setup();
  assert.equal(reboardReason(w, p), undefined);
  assert.equal(actionVisible(w, p, 'lifeboat', 'reboard'), true);
  rescueAction(w, p, 'reboard');
  assert.equal(p.vehicle, 30);
  assert.equal(p.fuel, 0);
  assert.equal(p.parkedFuel![MOTORBOAT], 12);
  assert.deepEqual(p.inventory, { cod: 10, fuel: 2 });
  assert.equal(w.boatRescues?.p, undefined);
  assert.equal(tenderOf(w, p)?.x, 5.5);
  assert.equal(tenderOf(w, p)?.landing, '');
  assert.throws(() => rescueAction(w, p, 'reboard'));
});
test('tender follows physical towline, survives reload, cannot disappear offshore, and stores at boatyard', () => {
  const { w, p } = setup();
  rescueAction(w, p, 'reboard');
  const t = tenderOf(w, p)!;
  p.x = t.x;
  p.z = t.z + 20;
  p.engine = false;
  tenderAction(w, p, 'hook');
  const before = { x: p.x, z: p.z, heading: p.heading };
  p.z += 1;
  moveTender(w, p, before);
  assert.ok(t.z > 1000.9);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }), /Secure.*tender/);
  assert.throws(() => tenderAction(w, p, 'dock'), /dock approach/);
  const saved = JSON.parse(JSON.stringify(w)),
    captain = saved.players.p;
  assert.equal(tenderOf(saved, captain)?.towedBy, 30);
  assert.equal(captain.parkedFuel[MOTORBOAT], 12);
  const dock = boatLandings(saved).find((d) => d.building)!;
  Object.assign(tenderOf(saved, captain)!, dock.berth);
  Object.assign(captain, { x: dock.berth.x, z: dock.berth.z + 20 });
  tenderAction(saved, captain, 'dock');
  assert.equal(tenderOf(saved, captain), undefined);
  assert.equal(captain.parkedFuel[MOTORBOAT], 12);
  Object.assign(captain, dock.berth, { inventory: {} });
  act(saved, captain.id, { type: 'vehicle', slot: 5, building: dock.id });
  act(saved, captain.id, { type: 'vehicle', slot: MOTORBOAT, building: dock.id });
  assert.equal(captain.fuel, 12);
});
test('an offshore parked tender cannot be summoned by buying/boarding at shore', () => {
  const { w, p } = setup();
  rescueAction(w, p, 'reboard');
  p.vehicle = 5;
  const dock = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, dock.land, { y: travelHeight(w, dock.land.x, dock.land.z) });
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: MOTORBOAT, building: dock.id }),
    /moored/,
  );
  assert.ok(w.mooredBoats![mooringKey(p.id, MOTORBOAT)]);
});

test('loss-on-death removes an attached tender and the fishing boat without duplicating either', () => {
  const { w, p } = setup();
  w.settings.loseBoatsOnDeath = true;
  rescueAction(w, p, 'reboard');
  const t = tenderOf(w, p)!;
  p.x = t.x;
  p.z = t.z + 20;
  tenderAction(w, p, 'hook');
  p.age = w.settings.maxAge + 1;
  advance(w, 0.1);
  assert.equal(tenderOf(w, p), undefined);
  assert.equal(p.fleet?.includes(MOTORBOAT), false);
  assert.equal(p.fleet?.includes(30), false);
});

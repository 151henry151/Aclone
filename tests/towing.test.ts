// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move } from '../src/shared/simulation';
import { towAction, moveTow, maintainTows, cancelPlayerTows } from '../src/shared/towing';
import { boatLandings, boatLanding } from '../src/shared/boathouse';
import { reboardReason } from '../src/shared/boat-rescue';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
const setup = () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const captain = addPlayer(w, 'captain', 'Captain'),
    tug = addPlayer(w, 'tug', 'Tug');
  Object.assign(captain, {
    online: true,
    vehicle: 30,
    fleet: [0, 5, 30],
    fuel: 0,
    fuelVehicle: 30,
    inventory: { cod: 10 },
    x: 0,
    z: 1000,
    y: 0,
    speed: 0,
    cash: 100000,
  });
  Object.assign(tug, {
    online: true,
    vehicle: 32,
    fleet: [0, 5, 32],
    fuel: 512,
    fuelVehicle: 32,
    x: 0,
    z: 1040,
    y: 0,
    speed: 0,
  });
  w.settings.vehicleLicences = false;
  return { w, captain, tug };
};
const agree = (s: ReturnType<typeof setup>, fee = 20000) => {
  towAction(s.w, s.tug, { type: 'tow', operation: 'offer', owner: s.captain.id, fee });
  towAction(s.w, s.captain, { type: 'tow', operation: 'accept' });
};
test('towing consent, escrow, cancellation and repeat actions cannot create money', () => {
  const s = setup(),
    { w, captain, tug } = s,
    cash = captain.cash;
  assert.throws(() => towAction(w, tug, { type: 'tow', operation: 'hook', owner: captain.id }));
  towAction(w, tug, { type: 'tow', operation: 'offer', owner: captain.id, fee: 20000 });
  assert.equal(captain.cash, cash);
  assert.throws(() => towAction(w, tug, { type: 'tow', operation: 'accept', owner: captain.id }));
  towAction(w, captain, { type: 'tow', operation: 'accept' });
  assert.equal(captain.cash, cash - 20000);
  assert.throws(() => towAction(w, captain, { type: 'tow', operation: 'accept' }));
  cancelPlayerTows(w, tug.id);
  cancelPlayerTows(w, tug.id);
  assert.equal(captain.cash, cash);
});
test('a tow follows in water, protects the disabled captain and refuses offshore delivery', () => {
  const s = setup(),
    { w, captain, tug } = s;
  agree(s);
  towAction(w, tug, { type: 'tow', operation: 'hook', owner: captain.id });
  const before = { x: tug.x, z: tug.z, heading: tug.heading };
  tug.z += 2;
  moveTow(w, tug, before);
  assert.ok(captain.z > 1001.9);
  const pos = captain.z;
  move(w, captain, { throttle: 1, steer: 1, boost: false }, 1);
  assert.equal(captain.z, pos);
  assert.throws(() => act(w, captain.id, { type: 'lifeboat', operation: 'launch' }), /towline/);
  assert.throws(() => act(w, tug.id, { type: 'vehicle', slot: 5 }), /towline/);
  assert.throws(
    () => towAction(w, tug, { type: 'tow', operation: 'deliver', owner: captain.id }),
    /boatyard|pier/,
  );
  assert.equal(captain.inventory.cod, 10);
});
test('restart preserves escrow and docking settles once', () => {
  const s = setup();
  agree(s);
  towAction(s.w, s.tug, { type: 'tow', operation: 'hook', owner: s.captain.id });
  const w = JSON.parse(JSON.stringify(s.w)),
    captain = w.players.captain,
    tug = w.players.tug;
  ensurePuddlewickBoatyard(w);
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(captain, d.berth);
  Object.assign(tug, { x: captain.x, z: captain.z + 40 });
  const cash = tug.cash;
  towAction(w, tug, { type: 'tow', operation: 'deliver', owner: captain.id });
  assert.equal(tug.cash, cash + 20000);
  assert.equal(w.towJobs.captain, undefined);
  assert.throws(() => towAction(w, tug, { type: 'tow', operation: 'deliver', owner: captain.id }));
  assert.equal(tug.cash, cash + 20000);
});
test('self rescue works while the captain is ashore and a delivered boat is recoverable', () => {
  const { w, captain } = setup();
  ensurePuddlewickBoatyard(w);
  w.boatRescues = {
    [captain.id]: {
      boat: { x: 0, z: 1000, heading: 0, slot: 30, paint: 'blue' },
      dinghy: { x: 0, z: 1000, heading: 0, moored: true },
      cargo: { cod: 10 },
    },
  };
  captain.vehicle = 5;
  captain.fleet!.push(32);
  captain.parkedFuel = { 30: 0, 32: 512 };
  captain.cash = 2000000;
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(captain, d.land);
  towAction(w, captain, { type: 'tow', operation: 'self' });
  captain.vehicle = 32;
  captain.x = 0;
  captain.z = 1040;
  towAction(w, captain, { type: 'tow', operation: 'hook' });
  Object.assign(w.boatRescues.captain.boat, d.berth);
  captain.x = d.berth.x;
  captain.z = d.berth.z + 40;
  towAction(w, captain, { type: 'tow', operation: 'deliver' });
  assert.equal(w.boatRescues.captain.landing, d.id);
  assert.equal(w.boatRescues.captain.cargo.cod, 10);
});
test('invalidated and abandoned offers cancel, but disconnected captains keep their tow', () => {
  const s = setup();
  agree(s);
  towAction(s.w, s.tug, { type: 'tow', operation: 'hook', owner: s.captain.id });
  s.captain.online = false;
  maintainTows(s.w);
  assert.ok(s.w.towJobs?.captain);
  s.tug.vehicle = 0;
  maintainTows(s.w);
  assert.equal(s.w.towJobs?.captain, undefined);
  assert.equal(s.captain.cash, 100000);
});

test('a long rescued hull alongside the boatyard can be delivered and reboarded ashore', () => {
  const { w, captain } = setup();
  ensurePuddlewickBoatyard(w);
  const d = boatLandings(w).find((d) => d.building)!;
  // Lightmun's reported approach: the tug is near shore, the trawler's centre
  // is 34.33 m from the berth, but its bow is already inside the 30 m approach.
  Object.assign(captain, {
    vehicle: 32,
    x: d.berth.x + 30.21998492336042,
    z: d.berth.z + 3.46696428457142,
  });
  const boat = {
    x: d.berth.x + 22.17302593146389,
    z: d.berth.z + 26.21012979349862,
    heading: 3.100825273516412,
    slot: 30,
    paint: 'blue',
  };
  w.boatRescues = {
    [captain.id]: {
      boat,
      dinghy: { ...d.berth, heading: 0, moored: true, landing: d.id },
      cargo: { cod: 10 },
    },
  };
  w.towJobs = {
    [captain.id]: {
      owner: captain.id,
      tug: captain.id,
      slot: 30,
      fee: 0,
      state: 'towing',
      created: w.time,
      rescue: true,
      rope: 24.33457742098003,
    },
  };
  assert.equal(boatLanding(w, boat, true, d.id), undefined, 'centre-only check reproduces bug');
  const position = { ...boat };
  towAction(w, captain, { type: 'tow', operation: 'deliver' });
  assert.equal(w.boatRescues[captain.id].landing, d.id);
  assert.deepEqual(w.boatRescues[captain.id].boat, position, 'delivery does not teleport the boat');
  assert.equal(w.boatRescues[captain.id].cargo.cod, 10);
  assert.equal(w.towJobs[captain.id], undefined);
  Object.assign(captain, d.land, { vehicle: 5 });
  assert.equal(reboardReason(w, captain), undefined);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, act } from '../src/shared/simulation';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { switchVehicle } from '../src/shared/tractors';
import { prepareFrame } from '../src/server/snapshots';
import { Store } from '../src/server/store';

function setup(slot = 30) {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  Object.assign(w.settings, {
    dayLength: 10,
    hungerRate: 0,
    thirstRate: 0,
    vehicleLicences: false,
    maxOfflineDays: 0,
  });
  const p = addPlayer(w, 'captain', 'Captain');
  Object.assign(p, {
    vehicle: slot,
    fuelVehicle: slot,
    fuel: 123,
    fleet: [0, 5, slot],
    x: 0,
    z: 230,
    y: w.settings.seaLevel,
    online: true,
    engine: true,
    speed: 0,
    inventory: { tuna: 12, wood: 2, fuel: 3 },
    boatStores: { bread: 10, water: 20 },
    trawl: { seconds: 4, deployed: true, fuelUsed: 2, catch: { cod: 4 } },
  });
  return { w, p };
}
function die(s: ReturnType<typeof setup>) {
  s.p.age = s.w.settings.maxAge + 1;
  advance(s.w, 0.1);
}
function recover(s: ReturnType<typeof setup>) {
  const { w, p } = s;
  const r = w.boatRescues![p.id];
  const d = boatLandings(w).find((d) => d.id === r.dinghy.landing)!;
  Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z), speed: 0 });
  act(w, p.id, { type: 'lifeboat', operation: 'board' });
  assert.equal(p.vehicle, 29);
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /five metres/);
  Object.assign(p, { x: r.boat.x + 2, z: r.boat.z, speed: 0 });
  act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
}
test('death leaves owned vessel and tank offshore; early recovery restores cargo, pantry and unhauled fish once', () => {
  const s = setup(),
    { w, p } = s;
  // The boat cargo stays offshore even if a world normally preserves personal inventory.
  w.settings.loseInventoryOnDeath = false;
  die(s);
  const r = w.boatRescues![p.id];
  assert.equal(p.vehicle, 5);
  assert.equal(p.engine, false);
  assert.ok(p.fleet!.includes(30));
  assert.equal(p.y, travelHeight(w, p.x, p.z));
  assert.deepEqual([r.boat.x, r.boat.z], [0, 230]);
  assert.deepEqual(p.inventory, {});
  assert.equal(p.boatStores, undefined);
  assert.equal(p.trawl, undefined);
  assert.equal(r.spoilage!.daysLeft, 5);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 30 }), /Recover/);
  const projected = JSON.parse(prepareFrame(w).fields.boatRescues)[p.id];
  assert.deepEqual(projected.cargo, {});
  assert.equal(projected.provisions, undefined);
  assert.equal(projected.net, undefined);
  assert.equal(projected.spoilage.daysLeft, 5);
  advance(w, 49);
  // Use the tractor on shore: its separate tank must not consume the abandoned boat's fuel.
  switchVehicle(p, 0);
  p.fuel = 9;
  recover(s);
  assert.equal(p.vehicle, 30);
  assert.equal(p.fuel, 123);
  assert.deepEqual(p.inventory, { tuna: 12, wood: 2, fuel: 3 });
  assert.deepEqual(p.boatStores, { bread: 10, water: 20 });
  assert.deepEqual(p.trawl!.catch, { cod: 4 });
  assert.equal(p.trawl!.deployed, false);
  assert.equal(w.boatRescues![p.id], undefined);
  advance(w, 5);
  assert.equal(p.inventory.tuna, 12);
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /no lifeboat/);
});
test('expiry survives a database save and removes all cargo exactly at five days, preserving vessel and tank', () => {
  const s = setup(3);
  die(s);
  advance(s.w, 20);
  const store = new Store(':memory:');
  store.saveWorld(s.w);
  const w = store.loadWorlds()[0].world;
  store.db.close();
  const p = w.players.captain;
  p.online = false;
  advance(w, 29.9);
  assert.equal(w.boatRescues![p.id].cargo.tuna, 12);
  advance(w, 0.1);
  const r = w.boatRescues![p.id];
  assert.equal(r.spoilage!.spoiled, true);
  assert.deepEqual(r.cargo, {});
  assert.equal(r.provisions, undefined);
  assert.equal(r.net, undefined);
  const notices = () =>
    w.messages.filter((m) => m.text.includes('after the world’s recovery period')).length;
  assert.equal(notices(), 1);
  advance(w, 20);
  assert.equal(notices(), 1);
  recover({ w, p });
  assert.equal(p.vehicle, 3);
  assert.equal(p.fuel, 123);
  assert.deepEqual(p.inventory, {});
});
test('world pauses and frozen calendars preserve stores, day-length changes count game days, repeated deaths do not reset expiry', () => {
  const s = setup(),
    { w, p } = s;
  die(s);
  advance(w, 10);
  const r = w.boatRescues![p.id];
  w.maintenance = { paused: true } as NonNullable<typeof w.maintenance>;
  advance(w, 100);
  assert.equal(r.spoilage!.daysLeft, 4);
  delete w.maintenance;
  w.settings.dayLength = 0;
  advance(w, 100);
  assert.equal(r.spoilage!.daysLeft, 4);
  w.settings.dayLength = 20;
  advance(w, 20);
  assert.equal(r.spoilage!.daysLeft, 3);
  die(s);
  assert.ok(r.spoilage!.daysLeft < 3);
  assert.deepEqual([r.boat.x, r.boat.z], [0, 230]);
  advance(w, 60);
  assert.equal(r.spoilage!.spoiled, true);
  assert.equal(p.fuel, 123);
});
test('offline death during catch-up starts the deadline at death, not at the end of catch-up', () => {
  const { w, p } = setup();
  p.online = false;
  p.boatStores = {};
  p.health = 6;
  p.hunger = 50000;
  p.thirst = 50000;
  delete p.needsGraceUntil;
  advance(w, 52);
  assert.equal(p.vehicle, 5);
  assert.equal(w.boatRescues![p.id].spoilage!.spoiled, true);
  assert.equal(p.fuel, 123);
});
test('a deckhand escapes offshore in a lifeboat and can disembark without owning the captain vessel', () => {
  const s = setup(),
    { w, p } = s;
  const q = addPlayer(w, 'crew', 'Crew');
  Object.assign(q, { hitch: p.id, vehicle: 5, x: p.x, z: p.z, online: true, inventory: {} });
  p.fishingVoyage = {
    members: { crew: 15 },
    offers: {},
    departed: true,
    caught: {},
    expenses: 0,
    fuelPrice: 1,
    provisionPrices: {},
  };
  die(s);
  assert.equal(q.vehicle, 29);
  assert.equal(q.hitch, undefined);
  assert.deepEqual([q.x, q.z], [0, 230]);
  assert.equal(w.boatRescues!.crew, undefined);
  const d = boatLandings(w).find((d) => d.id !== w.boatRescues![p.id].dinghy.landing)!;
  Object.assign(q, d.berth, { speed: 0 });
  act(w, q.id, { type: 'vehicle', slot: 5 });
  assert.equal(q.vehicle, 5);
  assert.deepEqual([q.x, q.z], [d.land.x, d.land.z]);
});

for (const reason of ['death', 'empty tank'])
  for (const slot of [3, 30, 31])
    test(`${reason}: hitch a recovery ride on boat ${slot} and transfer without teleporting or duplicating cargo`, () => {
      const s = setup(),
        { w, p } = s;
      if (reason === 'death') die(s);
      else {
        p.fuel = 0;
        act(w, p.id, { type: 'lifeboat', operation: 'launch' });
        const d = boatLandings(w)[0];
        Object.assign(p, d.berth, { speed: 0 });
        act(w, p.id, { type: 'vehicle', slot: 5 });
      }
      const r = w.boatRescues![p.id];
      const d = boatLandings(w).find((d) => d.id === r.dinghy.landing)!;
      const helper = addPlayer(w, 'helper', 'Helper');
      Object.assign(helper, d.berth, {
        vehicle: slot,
        fleet: [0, 5, slot],
        online: true,
        y: w.settings.seaLevel,
        speed: 0,
        inventory: { fish: 7 },
        fuel: 40,
      });
      Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z), inventory: { fuel: 2 } });
      act(w, p.id, { type: 'hitch', player: helper.id });
      assert.equal(p.hitch, helper.id);
      assert.equal(helper.fishingVoyage, undefined); // Recovery is not a paid fishing job.
      assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /alongside/);
      Object.assign(helper, {
        x: r.boat.x + (slot === 3 ? 6.5 : slot === 31 ? 7.5 : 8),
        z: r.boat.z,
        speed: 2,
      });
      assert.throws(
        () => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }),
        /stop alongside/,
      );
      helper.speed = 0;
      assert.throws(() => act(w, p.id, { type: 'detach' }), /boathouse/);
      const before = structuredClone(helper);
      act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
      assert.equal(p.hitch, undefined);
      assert.equal(p.vehicle, 30);
      assert.deepEqual([p.x, p.z], [r.boat.x, r.boat.z]);
      assert.equal(p.inventory.tuna, 12);
      assert.equal(p.inventory.fuel, 5);
      assert.deepEqual(helper, before);
      assert.equal(p.fuel, reason === 'death' ? 123 : 0);
      assert.equal(w.boatRescues![p.id], undefined);
    });

test('recovery transfers reject overload without detaching, and trawlers share two berths with crew', () => {
  const s = setup(),
    { w, p } = s;
  die(s);
  const r = w.boatRescues![p.id],
    d = boatLandings(w).find((d) => d.id === r.dinghy.landing)!;
  const helper = addPlayer(w, 'helper', 'Helper');
  Object.assign(helper, d.berth, { vehicle: 30, online: true, y: w.settings.seaLevel, speed: 0 });
  for (const id of ['a', 'b']) Object.assign(addPlayer(w, id, id), { hitch: helper.id });
  assert.throws(() => act(w, p.id, { type: 'hitch', player: helper.id }), /passenger room/);
  delete w.players.b.hitch;
  act(w, p.id, { type: 'hitch', player: helper.id });
  p.inventory = { stone: 100000 };
  Object.assign(helper, { x: r.boat.x + 7, z: r.boat.z });
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /exceeds/);
  assert.equal(p.hitch, helper.id);
  assert.equal(r.cargo.tuna, 12);
});

test('Puddlewick migration changes future death rules once without removing existing boats or touching other worlds', async () => {
  const { prepareBoatDeathRules } = await import('../src/server/boat-death-rules');
  const { w, p } = setup();
  const fleet = [...p.fleet!];
  assert.equal(prepareBoatDeathRules(w), true);
  assert.equal(w.settings.loseBoatsOnDeath, true);
  assert.deepEqual(p.fleet, fleet);
  w.settings.loseBoatsOnDeath = false;
  assert.equal(prepareBoatDeathRules(w), false);
  assert.equal(w.settings.loseBoatsOnDeath, false);
  const other = createWorld('other', 'Other', 'owner');
  assert.equal(prepareBoatDeathRules(other), false);
  assert.equal(other.settings.loseBoatsOnDeath, false);
});

test('loss-on-death removes owned active, moored and stored boats, cargo and fuel, but preserves unrelated vehicles', () => {
  const s = setup(),
    { w, p } = s;
  w.settings.loseBoatsOnDeath = true;
  w.settings.loseInventoryOnDeath = false;
  p.fleet = [0, 5, 2, 3, 24, 30];
  p.parkedFuel = { 0: 9, 2: 17, 3: 20 };
  p.fleetState = { 30: { acquiredAt: 1, metres: 500, condition: 20 } };
  w.mooredBoats = {
    'captain:3': { owner: p.id, slot: 3, x: 5, z: 200, heading: 0, paint: 'blue', landing: 'pier' },
  };
  die(s);
  assert.deepEqual(p.fleet, [0, 5, 2, 24]);
  assert.deepEqual(p.parkedFuel, { 0: 9, 2: 17 });
  assert.deepEqual(p.fleetState, {});
  assert.equal(p.fuel, 0);
  assert.deepEqual(p.inventory, {});
  assert.equal(p.boatStores, undefined);
  assert.equal(p.trawl, undefined);
  assert.equal(p.vehicle, 5);
  assert.equal(w.boatRescues?.[p.id], undefined);
  assert.deepEqual(w.mooredBoats, {});
});

test('loss policy still permits fuel rescue, but a subsequent death destroys the stranded boat', () => {
  const s = setup(),
    { w, p } = s;
  w.settings.loseBoatsOnDeath = true;
  p.fuel = 0;
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  assert.equal(w.boatRescues![p.id].cargo.tuna, 12);
  assert.equal(w.boatRescues![p.id].spoilage, undefined);
  die(s);
  assert.equal(w.boatRescues![p.id], undefined);
  assert.ok(!p.fleet!.includes(30));
  assert.equal(p.vehicle, 5);
});

test('world owners can configure recovery lifetime and fuel, including no spoilage, with validated settings', () => {
  const s = setup(),
    { w, p } = s;
  p.authority = 100;
  act(w, p.id, {
    type: 'settings',
    patch: { boatCargoSpoilageDays: 0, retainBoatFuelOnDeath: false, loseBoatsOnDeath: false },
  });
  for (const value of [-1, 366, NaN, Infinity, '5'])
    assert.throws(() =>
      act(w, p.id, { type: 'settings', patch: { boatCargoSpoilageDays: value } }),
    );
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { loseBoatsOnDeath: 'yes' } }));
  const guest = addPlayer(w, 'guest', 'Guest');
  assert.throws(() => act(w, guest.id, { type: 'settings', patch: { loseBoatsOnDeath: true } }));
  die(s);
  assert.equal(p.fuel, 0);
  assert.equal(w.boatRescues![p.id].spoilage!.never, true);
  advance(w, 200);
  assert.equal(w.boatRescues![p.id].cargo.tuna, 12);
  assert.equal(w.boatRescues![p.id].spoilage!.spoiled, undefined);
  recover(s);
  assert.equal(p.fuel, 0);
  assert.equal(p.inventory.tuna, 12);
});

test('a custom recovery lifetime applies at death and remains fixed for that abandoned cargo', () => {
  const s = setup(),
    { w, p } = s;
  w.settings.boatCargoSpoilageDays = 2;
  die(s);
  w.settings.boatCargoSpoilageDays = 9;
  advance(w, 20);
  assert.equal(w.boatRescues![p.id].spoilage!.spoiled, true);
});

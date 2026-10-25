// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import { vehicles, items } from '../src/shared/catalog';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, makeBuilding, move } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import {
  boatLandings,
  boathouseSite,
  boatLanding,
  withinBoatLanding,
  nearBoathouse,
} from '../src/shared/boathouse';
import { constructionSiteReason } from '../src/shared/construction-site';
import { terrainHeight } from '../src/shared/terrain';
import { travelHeight, fishingDock } from '../src/shared/dock';
import { LIFEBOAT } from '../src/shared/boat-rescue';
import { deepBoatFishing, fishingCatch } from '../src/shared/boat-fishing';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.ok(ensurePuddlewickBoatyard(w));
  const p = addPlayer(w, 'p', 'Sailor');
  Object.assign(p, {
    cash: 1000000,
    online: true,
    inventory: {},
    fleet: [0, 5, 3],
    fuelVehicle: 0,
    fuel: 50,
  });
  w.settings.vehicleLicences = false;
  const yard = w.buildings.find((b) => b.kind === 'boathouse')!,
    d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z) });
  return { w, p, yard, d };
}
const vehicle = (
  w: ReturnType<typeof createWorld>,
  p: { id: string },
  slot: number,
  building?: string,
) => act(w, p.id, { type: 'vehicle', slot, building });
test('shoreline siting reserves a dry boatyard, clear berth and boat-sized water, and migration is idempotent', () => {
  const { w, yard } = setup();
  assert.ok(boathouseSite(w, yard));
  assert.equal(ensurePuddlewickBoatyard(w), false);
  assert.match(constructionSiteReason(w, makeBuilding('inland', 'boathouse', 60, 0))!, /shoreline/);
  assert.equal(boathouseSite(w, { ...yard, rotation: 0 }), undefined);
  const before = structuredClone(w.buildings);
  w.id = 'other';
  assert.equal(ensurePuddlewickBoatyard(w), false);
  assert.deepEqual(w.buildings, before);
});
test('boathouse boards in water, refuses every offshore exit, and stores boats when back at berth', () => {
  const { w, p, yard, d } = setup();
  vehicle(w, p, 3, yard.id);
  assert.deepEqual({ x: p.x, z: p.z }, d.berth);
  assert.equal(p.y, w.settings.seaLevel);
  p.x = 0;
  p.z = 230;
  for (const action of [
    { type: 'vehicle', slot: 0 },
    { type: 'vehicle', slot: 5 },
    { type: 'crow' },
    { type: 'home', building: yard.id },
    { type: 'joinGame', game: 'race' },
    { type: 'respawn' },
    { type: 'chat', text: '*resetpos' },
  ]) {
    const before = JSON.stringify(p);
    assert.throws(() => act(w, p.id, action));
    assert.equal(JSON.stringify(p), before);
  }
  Object.assign(p, d.berth);
  vehicle(w, p, 0, yard.id);
  assert.deepEqual({ x: p.x, z: p.z }, d.land);
  assert.ok(!w.mooredBoats?.[`${p.id}:3`]);
});
test('fishing pier leaves one saved empty boat and only its owner can retrieve it there', () => {
  const { w, p, yard } = setup();
  vehicle(w, p, 3, yard.id);
  const pier = boatLandings(w).find((d) => !d.building)!;
  assert.ok(pier);
  Object.assign(p, pier.berth);
  vehicle(w, p, 0, fishingDock.id);
  assert.equal(w.mooredBoats?.[`${p.id}:3`].landing, pier.id);
  const store = new Store(':memory:');
  store.saveWorld(w);
  const saved = store.loadWorlds()[0].world;
  store.db.close();
  assert.deepEqual(saved.mooredBoats, w.mooredBoats);
  vehicle(w, p, 3, fishingDock.id);
  assert.equal(w.mooredBoats?.[`${p.id}:3`], undefined);
  assert.deepEqual({ x: p.x, z: p.z }, pier.berth);
});
test('full fuel rescue round trip keeps cargo offshore, rows without fuel, saves and recovers without teleporting', () => {
  const { w, p, yard } = setup();
  vehicle(w, p, 3, yard.id);
  Object.assign(p, { x: 0, z: 230, fuel: 0, inventory: { wood: 10, tackle: 1 }, heading: 0 });
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  assert.equal(p.vehicle, LIFEBOAT);
  assert.deepEqual(p.inventory, {});
  const original = { ...w.boatRescues![p.id].boat };
  const start = p.z;
  for (let i = 0; i < 80; i++) move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
  assert.ok(p.z > start + 1);
  p.speed = 0;
  assert.throws(() => vehicle(w, p, 0), /Visit/);
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'reboard' }), /five metres/);
  const pier = boatLandings(w).find((d) => !d.building)!;
  Object.assign(p, pier.berth);
  vehicle(w, p, 5, fishingDock.id);
  assert.ok(w.boatRescues![p.id].dinghy.moored);
  assert.deepEqual(w.boatRescues![p.id].boat, original);
  // A real fuel purchase on shore, then return along the same pier.
  const market = w.buildings.find((b) => b.kind === 'market')!;
  market.stock.fuel = 10;
  Object.assign(p, { x: market.x, z: market.z, y: travelHeight(w, market.x, market.z) });
  act(w, p.id, { type: 'trade', building: market.id, item: 'fuel', quantity: 2, direction: 'buy' });
  Object.assign(p, pier.land, { y: travelHeight(w, pier.land.x, pier.land.z) });
  act(w, p.id, { type: 'lifeboat', operation: 'board' });
  assert.throws(() => act(w, p.id, { type: 'use', item: 'fuel' }), /reboard/);
  const store = new Store(':memory:');
  store.saveWorld(w);
  const saved = store.loadWorlds()[0].world;
  store.db.close();
  assert.deepEqual(saved.boatRescues, w.boatRescues);
  Object.assign(p, { x: original.x + 3, z: original.z, speed: 0 });
  act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
  assert.equal(p.vehicle, 3);
  assert.equal(p.inventory.wood, 10);
  assert.equal(p.inventory.fuel, 2);
  assert.equal(p.fuel, 0);
  assert.deepEqual({ x: p.x, z: p.z }, { x: original.x, z: original.z });
  assert.ok(!w.boatRescues?.[p.id]);
  act(w, p.id, { type: 'use', item: 'fuel' });
  assert.equal(p.fuel, 8);
  assert.equal(p.inventory.fuel, 1);
});
test('rescue refuses nonempty tanks, duplicate launches and overloaded lifeboat boarding atomically', () => {
  const { w, p, yard } = setup();
  vehicle(w, p, 3, yard.id);
  Object.assign(p, { x: 0, z: 230, fuel: 1 });
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'launch' }), /empty/);
  assert.ok(!w.boatRescues);
  p.fuel = 0;
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'launch' }));
  const pier = boatLandings(w).find((d) => !d.building)!;
  Object.assign(p, pier.berth);
  vehicle(w, p, 0, fishingDock.id);
  p.inventory = { stone: 100 };
  const before = JSON.stringify(w.boatRescues);
  assert.throws(() => act(w, p.id, { type: 'lifeboat', operation: 'board' }), /40/);
  assert.equal(JSON.stringify(w.boatRescues), before);
  assert.throws(() => vehicle(w, p, 3, fishingDock.id), /Recover/);
});
test('deep-water fishing stays afloat, grants weighted species only offshore and sells actual catches', () => {
  const { w, p, yard } = setup();
  vehicle(w, p, 3, yard.id);
  Object.assign(p, { x: 0, z: 1400, inventory: { tackle: 1 }, fuel: 20 });
  assert.ok(deepBoatFishing(w, p));
  assert.equal(fishingCatch(w, p, 0.9), 'cod');
  assert.equal(fishingCatch(w, p, 0.97), 'halibut');
  assert.equal(fishingCatch(w, p, 0.999), 'tuna');
  act(w, p.id, { type: 'joinGame', game: 'fishing' });
  assert.equal(p.z, 1400);
  move(w, p, { throttle: 1, steer: 1, boost: true }, 1);
  assert.equal(p.y, w.settings.seaLevel);
  assert.equal(p.z, 1400);
  p.fishCatch = 'tuna';
  w.time = p.fishAt!;
  act(w, p.id, { type: 'reel' });
  assert.equal(p.inventory.tuna, 1);
  act(w, p.id, { type: 'leaveGame' });
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.berth);
  vehicle(w, p, 0, yard.id);
  const cash = p.cash;
  act(w, p.id, { type: 'trade', building: yard.id, item: 'tuna', quantity: 1, direction: 'sell' });
  assert.ok(p.cash > cash + 10000);
  assert.equal(fishingCatch(w, p, 0.999), 'fish');
});
test('passengers remain aboard the fuel rescue and can disembark only after reaching a dock', () => {
  const { w, p, d, yard } = setup();
  vehicle(w, p, 3, yard.id);
  const guest = addPlayer(w, 'guest', 'Passenger');
  Object.assign(guest, { online: true, hitch: p.id, inventory: {} });
  p.x = 0;
  p.z = 230;
  p.fuel = 0;
  assert.throws(() => act(w, guest.id, { type: 'detach' }), /Wait/);
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  assert.equal(guest.hitch, p.id);
  assert.throws(() => act(w, guest.id, { type: 'detach' }), /Wait/);
  Object.assign(p, d.berth, { speed: 0 });
  act(w, guest.id, { type: 'detach' });
  assert.equal(guest.hitch, undefined);
  assert.equal(guest.x, d.land.x);
  assert.equal(guest.z, d.land.z);
});

test('a full stranded hold can be rescued by pouring carried fuel alongside before reboarding', () => {
  const { w, p, yard } = setup();
  vehicle(w, p, 3, yard.id);
  Object.assign(p, { x: 0, z: 230, fuel: 0, inventory: { stone: 300 } });
  // Use the actual boat capacity, irrespective of future catalogue balancing.
  p.inventory.stone = vehicles[3].capacity / items.stone.weight;
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  p.inventory = { fuel: 1 };
  act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
  assert.equal(p.vehicle, 3);
  assert.equal(p.fuel, 8);
  assert.equal(p.inventory.stone, vehicles[3].capacity / items.stone.weight);
  assert.equal(p.inventory.fuel, 0);
  assert.equal(w.boatRescues?.[p.id], undefined);
});

test('every public berth clears the enlarged hull and lands on solid ground or the pier deck', () => {
  const { w } = setup();
  for (const d of boatLandings(w)) {
    const c = Math.cos(d.heading),
      s = Math.sin(d.heading);
    for (const x of [-4.1, 0, 4.1])
      for (const z of [-10.5, 0, 10.5])
        assert.ok(
          terrainHeight(w, d.berth.x + x * c + z * s, d.berth.z - x * s + z * c) <=
            w.settings.seaLevel - 1,
          d.id,
        );
    assert.ok(travelHeight(w, d.land.x, d.land.z) > w.settings.seaLevel, d.id);
  }
});

test('returning boats can disembark throughout the waterfront arrival area, but not from offshore or across land', () => {
  const { w, p, d, yard } = setup();
  vehicle(w, p, 3, yard.id);
  for (const [dx, dz] of [
    [22, 0],
    [-22, 0],
    [0, 25],
    [18, 18],
  ]) {
    Object.assign(p, {
      x: d.berth.x + dx,
      z: d.berth.z + dz,
      y: w.settings.seaLevel,
      speed: 0,
      vehicle: 3,
    });
    assert.equal(boatLanding(w, p, true, yard.id)?.id, yard.id);
    assert.ok(nearBoathouse(w, p, yard));
    vehicle(w, p, 5, yard.id);
    assert.deepEqual({ x: p.x, z: p.z }, d.land);
  }
  Object.assign(p, {
    x: d.berth.x,
    z: d.berth.z + 35,
    y: w.settings.seaLevel,
    speed: 0,
    vehicle: 3,
  });
  assert.equal(boatLanding(w, p, true, yard.id), undefined);
  assert.throws(() => vehicle(w, p, 5, yard.id), /Visit/);
  Object.assign(p, { x: d.berth.x, z: d.berth.z + 22, speed: 1 });
  assert.throws(() => vehicle(w, p, 5, yard.id), /Stop/);
  p.speed = 0;
  w.terrain.push({ x: p.x, z: d.berth.z + 11, radius: 5, height: 50 });
  w.revision++;
  assert.equal(withinBoatLanding(w, p, d, true), false);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, move, money } from '../src/shared/simulation';
import { FISHING_BOAT, mooringKey } from '../src/shared/boats';
import { HAULS, TRAWL_FUEL, TRAWL_SECONDS, trawlHaul } from '../src/shared/commercial-fishing';
import { boatLandings } from '../src/shared/boathouse';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { vehicles, items, buildings } from '../src/shared/catalog';
import { Store } from '../src/server/store';
import { exportShipments } from '../src/shared/export-shipments';
import { LIFEBOAT } from '../src/shared/boat-rescue';
import { travelHeight } from '../src/shared/dock';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  const p = addPlayer(w, 'p', 'Skipper');
  Object.assign(p, {
    cash: 1000000,
    online: true,
    inventory: {},
    fleet: [0, 5, 3],
    fuelVehicle: 0,
    fuel: 50,
  });
  w.settings.vehicleLicences = false;
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z) });
  act(w, p.id, { type: 'vehicle', slot: FISHING_BOAT, building: d.id });
  return { w, p, d };
}
function sea(p: ReturnType<typeof addPlayer>) {
  Object.assign(p, { x: 0, z: 400, y: -1, heading: 0, engine: true, fuel: 144, boatThrottle: 1 });
}
const control = { throttle: 1, steer: 0.08, boost: false };
test('commercial boat purchase, fuel, moorings and rescue retain the exact machine', () => {
  const { w, p, d } = setup();
  assert.equal(p.cash, 300000);
  assert.equal(p.fuel, 0);
  assert.ok(p.fleet!.includes(FISHING_BOAT));
  const pier = boatLandings(w).find((d) => !d.building)!;
  Object.assign(p, pier.berth, { speed: 0 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(w.mooredBoats![mooringKey(p.id, FISHING_BOAT)].slot, FISHING_BOAT);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 3 }), /moored boat/);
  act(w, p.id, { type: 'vehicle', slot: FISHING_BOAT });
  assert.equal(Object.keys(w.mooredBoats!).length, 0);
  sea(p);
  p.fuel = 0;
  p.inventory = { cod: 20 };
  act(w, p.id, { type: 'lifeboat', operation: 'launch' });
  assert.equal(p.vehicle, LIFEBOAT);
  assert.equal(w.boatRescues![p.id].boat.slot, FISHING_BOAT);
  act(w, p.id, { type: 'lifeboat', operation: 'reboard' });
  assert.equal(p.vehicle, FISHING_BOAT);
  assert.equal(p.inventory.cod, 20);
  p.inventory = {};
  Object.assign(p, d.berth, { speed: 0 });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  act(w, p.id, { type: 'vehicle', slot: FISHING_BOAT, building: d.id });
  assert.equal(p.cash, 300000);
});
test('real movement completes a paid deep-water tow; save/reload and repeated haul cannot reroll or duplicate fish', () => {
  let { w, p } = setup();
  sea(p);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  for (let i = 0; i < 3000; i++) {
    move(w, p, control, 0.1);
    w.time += 0.1;
  }
  assert.ok(p.trawl!.seconds > 290 && p.trawl!.seconds < 301);
  act(w, p.id, { type: 'trawl', operation: 'stow' });
  const previous = p.trawl!.seconds;
  for (let i = 0; i < 10; i++) move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(p.trawl!.seconds, previous);
  const store = new Store(':memory:');
  store.saveWorld(w);
  w = store.loadWorlds()[0].world;
  p = w.players[p.id];
  store.close();
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  for (let i = 0; i < 4400 && p.trawl!.deployed; i++) {
    move(w, p, control, 0.1);
    w.time += 0.1;
  }
  assert.equal(p.trawl!.seconds, TRAWL_SECONDS);
  assert.ok(p.trawl!.catch);
  assert.ok(p.trawl!.fuelUsed >= TRAWL_FUEL && p.trawl!.fuelUsed < TRAWL_FUEL + 1);
  assert.ok(p.fuel > 19 && p.fuel < 20);
  const caught = structuredClone(p.trawl!.catch);
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'deploy' }), /haul/);
  p.inventory = { stone: 280 };
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'haul' }), /room/);
  assert.deepEqual(p.trawl!.catch, caught);
  p.inventory = {};
  act(w, p.id, { type: 'trawl', operation: 'haul' });
  assert.deepEqual(p.inventory, caught);
  assert.deepEqual(p.statistics!.gathered, caught);
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'haul' }), /Finish/);
});
test('stationary, shallow, disabled fishing and prediction cannot grant free catches', () => {
  const { w, p } = setup();
  sea(p);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  const start = p.fuel;
  p.boatThrottle = 0;
  move(w, p, { throttle: 0, steer: 0, boost: false }, 1);
  assert.equal(p.trawl!.seconds, 0);
  assert.ok(p.fuel < start);
  p.x = 0;
  p.z = 0;
  p.speed = 2;
  move(w, p, control, 1);
  assert.equal(p.trawl!.seconds, 0);
  sea(p);
  p.speed = 2;
  w.settings.fishingMode = 0;
  move(w, p, control, 1);
  assert.equal(p.trawl!.seconds, 0);
  w.settings.fishingMode = 1;
  p.trawl!.seconds = TRAWL_SECONDS - 0.1;
  move(w, p, control, 0.2, true);
  assert.equal(p.trawl!.catch, undefined);
  assert.deepEqual(p.inventory, {});
  assert.throws(() => act(w, p.id, { type: 'joinGame', game: 'fishing' }), /Stow/);
  p.fuel = 0;
  move(w, p, control, 1);
  assert.deepEqual(p.inventory, {});
});
test('expected earnings allow losing trips, remain near business margins and fit the hold', () => {
  const bid = buildings.boathouse.buy;
  const values = HAULS.map((h) =>
    Object.entries(h.catch).reduce((s, [id, n]) => s + n * bid[id], 0),
  );
  assert.deepEqual(values, [33600, 89600, 315000]);
  assert.deepEqual(
    [trawlHaul(0), trawlHaul(0.3), trawlHaul(0.9)],
    [HAULS[0].catch, HAULS[1].catch, HAULS[2].catch],
  );
  const mean = values.reduce((s, v, i) => s + v * HAULS[i].chance, 0);
  assert.equal(mean, 95340);
  const fullTank =
    (vehicles[FISHING_BOAT].tank! / items.fuel.fuel!) * buildings.boathouse.sell.fuel;
  assert.equal(fullTank, 81000);
  const hourly = ((mean - fullTank) * 3) / 10000; // 12m tow + 3m sailing + 5m logistics
  assert.ok(hourly > 3 && hourly < 5);
  assert.ok(values[0] < fullTank && values[1] > fullTank && values[2] > fullTank * 3);
  for (const h of HAULS)
    assert.ok(
      Object.entries(h.catch).reduce((s, [id, n]) => s + n * items[id].weight, 0) <=
        vehicles[FISHING_BOAT].capacity,
    );
  console.log(
    `Fishing: average ${money(mean)}, fuel ${money(fullTank)}, expected ${hourly.toFixed(3)}s/hour at three trips/hour.`,
  );
});
test('boatyard exports purchased fish with bounded real-cargo settlement, without exporting rescue fuel', () => {
  const { w, d } = setup(),
    b = d.building!;
  b.stock = { cod: 50, halibut: 20, tuna: 12, fuel: 50 };
  const before = b.investment;
  exportShipments(w, 1800);
  assert.equal(b.stock.fuel, 50);
  assert.equal(b.stock.cod, 10);
  assert.equal(b.stock.halibut, 8);
  assert.equal(b.stock.tuna, 8);
  assert.ok(b.investment > before);
  const till = b.investment;
  exportShipments(w, 1800);
  assert.equal(b.investment, till);
});
test('fishing boat throttle persists when keys are released, idles on request and supports slow reverse', () => {
  const { w, p } = setup();
  sea(p);
  p.boatThrottle = 0;
  for (let i = 0; i < 20; i++) move(w, p, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.ok(p.boatThrottle! > 0.45 && p.boatThrottle! < 0.5);
  const set = p.boatThrottle;
  for (let i = 0; i < 30; i++) move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(p.boatThrottle, set);
  assert.ok(p.speed > 1);
  act(w, p.id, { type: 'boatIdle' });
  assert.equal(p.boatThrottle, 0);
  for (let i = 0; i < 80; i++) move(w, p, { throttle: -1, steer: 0, boost: true }, 0.1);
  assert.equal(p.boatThrottle, -0.4);
  assert.ok(p.speed < 0);
  assert.ok(p.speed >= -vehicles[FISHING_BOAT].speed * 0.4);
  move(w, p, { throttle: 0, steer: 0, boost: false, brake: true }, 0.1);
  assert.equal(p.boatThrottle, 0);
});

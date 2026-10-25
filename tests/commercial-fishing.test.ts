import { prepareFishingVoyages } from '../src/server/fishing-voyages';
import { fishingGroundQuality } from '../src/shared/fishing-water';
import { boatLoadFactors, startVoyage } from '../src/shared/fishing-expedition';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, move, money } from '../src/shared/simulation';
import { FISHING_BOAT, mooringKey } from '../src/shared/boats';
import {
  FISHING_GROUNDS,
  NET_CAPACITY,
  netWeight,
  TRAWL_REFERENCE_SECONDS,
  TRAWL_FUEL_PER_SECOND,
  advanceTrawl,
} from '../src/shared/commercial-fishing';
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
    cash: 4000000,
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
  Object.assign(p, { x: 0, z: 1400, y: -1, heading: 0, engine: true, fuel: 144, boatThrottle: 1 });
}
const control = { throttle: 1, steer: 0.08, boost: false };
test('commercial boat purchase, fuel, moorings and rescue retain the exact machine', () => {
  const { w, p, d } = setup();
  assert.equal(p.cash, 4000000 - vehicles[FISHING_BOAT].price);
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
  assert.equal(p.cash, 4000000 - vehicles[FISHING_BOAT].price);
});
function seeded(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test('fish arrive during a short tow and may be hauled at any time without rerolling or duplication', () => {
  let { w, p } = setup();
  sea(p);
  p.fuel = 30; // Partial trips no longer require a full-tow fuel commitment.
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  p.trawl!.shoal = { ground: 1, nextChange: 1000, nextFish: 1 };
  for (let i = 0; i < 300; i++) move(w, p, control, 0.1);
  assert.ok(p.trawl!.seconds > 25 && p.trawl!.seconds < 31);
  assert.ok(Object.values(p.trawl!.catch!).reduce((s, n) => s + n, 0) > 0);
  act(w, p.id, { type: 'trawl', operation: 'stow' });
  const saved = structuredClone(p.trawl);
  for (let i = 0; i < 10; i++) move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.deepEqual(p.trawl, saved);
  const store = new Store(':memory:');
  store.saveWorld(w);
  w = store.loadWorlds()[0].world;
  p = w.players[p.id];
  store.close();
  assert.deepEqual(p.trawl, saved);
  const caught = structuredClone(p.trawl!.catch);
  act(w, p.id, { type: 'trawl', operation: 'haul' });
  assert.deepEqual(p.inventory, caught);
  assert.deepEqual(p.statistics!.gathered, caught);
  assert.deepEqual(p.trawl!.shoal, saved!.shoal);
  assert.equal(p.trawl!.deployed, false);
  assert.match(act(w, p.id, { type: 'trawl', operation: 'haul' }), /no fish/);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  assert.deepEqual(p.trawl!.shoal, saved!.shoal);
});
test('full hold stops towing and preserves earned fish and the next fish until space is available', () => {
  const { w, p } = setup();
  sea(p);
  p.speed = 2;
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  p.inventory = { stone: (vehicles[FISHING_BOAT].capacity - 6) / 2 };
  p.trawl!.shoal = { ground: 0, nextChange: 1000, nextFish: 0.1 };
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl!.catch!.cod, 1);
  p.trawl!.shoal!.nextFish = 0.1;
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl!.deployed, false);
  assert.equal(p.trawl!.holdFull, true);
  assert.equal(p.trawl!.shoal!.pendingFish, 'cod');
  assert.equal(p.trawl!.catch!.cod, 1);
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'deploy' }), /room/);
  p.inventory.stone = vehicles[FISHING_BOAT].capacity / 2;
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'haul' }), /room/);
  p.inventory = {};
  act(w, p.id, { type: 'trawl', operation: 'haul' });
  assert.equal(p.inventory.cod, 1);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl!.catch!.cod, 1);
  assert.equal(p.trawl!.shoal!.pendingFish, undefined);
});
test('stationary, coastal, disabled, offline and predicted movement cannot advance encounters or grant fish', () => {
  const { w, p } = setup();
  sea(p);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  const shoal = structuredClone(p.trawl!.shoal);
  const fuel = p.fuel;
  p.speed = 0;
  advanceTrawl(w, p, 1, 0);
  assert.ok(p.fuel < fuel);
  p.z = 230;
  p.speed = 2;
  advanceTrawl(w, p, 1, 2);
  p.z = 1400;
  w.settings.fishingMode = 0;
  advanceTrawl(w, p, 1, 2);
  assert.equal(p.trawl!.seconds, 0);
  assert.deepEqual(p.trawl!.shoal, shoal);
  w.settings.fishingMode = 1;
  advanceTrawl(w, p, 720, 1440, true, () => {
    throw Error('prediction must not roll');
  });
  assert.equal(p.trawl!.catch, undefined);
  assert.deepEqual(p.trawl!.shoal, shoal);
  assert.deepEqual(p.inventory, {});
  assert.throws(() => act(w, p.id, { type: 'joinGame', game: 'fishing' }), /Stow/);
  p.fuel = 0;
  advanceTrawl(w, p, 1, 2);
  assert.deepEqual(p.inventory, {});
});
test('encounters change mid-trip and their results are independent of simulation tick size', () => {
  const { w, p } = setup();
  sea(p);
  p.speed = 2;
  const initial = {
    seconds: 0,
    fuelUsed: 0,
    deployed: true,
    shoal: { ground: 0, nextChange: 60, nextFish: 50 },
  };
  p.trawl = structuredClone(initial);
  const a = structuredClone(p),
    b = structuredClone(p);
  const ra = seeded(312),
    rb = seeded(312);
  for (let i = 0; i < 900; i++) advanceTrawl(w, a, 0.2, 0.4, false, ra);
  for (let i = 0; i < 18; i++) advanceTrawl(w, b, 10, 20, false, rb);
  assert.deepEqual(a.trawl!.catch, b.trawl!.catch);
  assert.equal(a.trawl!.shoal!.ground, b.trawl!.shoal!.ground);
  assert.ok(Math.abs(a.trawl!.shoal!.nextFish - b.trawl!.shoal!.nextFish) < 1e-7);
  assert.ok(Math.abs(a.fuel - b.fuel) < 0.1);
  assert.ok(Object.values(a.trawl!.catch!).reduce((s, n) => s + n, 0) > 0);
});
test('continuous towing has no twelve-minute finish and persists both legacy catches and partial paid effort', () => {
  const { w, p } = setup();
  sea(p);
  p.speed = 2;
  p.trawl = { seconds: 360, fuelUsed: 62, deployed: false };
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  assert.ok(p.trawl!.catch!.cod >= 2);
  const legacyCatch = { tuna: 2 };
  p.trawl = { seconds: 720, fuelUsed: 124, deployed: false, catch: legacyCatch };
  act(w, p.id, { type: 'trawl', operation: 'haul' });
  assert.equal(p.inventory.tuna, 2);
  p.trawl = {
    seconds: 719,
    fuelUsed: 0,
    deployed: true,
    shoal: { ground: 0, nextChange: 1000, nextFish: 1000 },
  };
  advanceTrawl(w, p, 10, 20);
  assert.equal(p.trawl.seconds, 729);
  assert.equal(p.trawl.deployed, true);
  assert.equal(p.trawl.catch, undefined);
});
test('bay trips and long ocean voyages have distinct, uncertain returns, including losses and full holds', () => {
  const { w, p } = setup();
  prepareFishingVoyages(w);
  sea(p);
  p.speed = 2;
  const random = seeded(619),
    bid = buildings.boathouse.buy;
  const crew = [addPlayer(w, 'deck-a', 'Deck A'), addPlayer(w, 'deck-b', 'Deck B')];
  const run = (z: number, minutes: number, trips: number, hands = 0) => {
    let sum = 0,
      losses = 0,
      full = 0,
      small = 0,
      spent = 0;
    for (let i = 0; i < trips; i++) {
      Object.assign(p, {
        x: 0,
        z,
        fuel: vehicles[FISHING_BOAT].tank,
        inventory: { bread: 10, water: 10 },
        trawl: undefined,
        fishingVoyage: undefined,
      });
      const voyage = startVoyage(w, p);
      crew.forEach((q, index) => {
        delete q.hitch;
        if (index < hands) {
          q.hitch = p.id;
          voyage.members[q.id] = 15;
        }
      });
      const travelSeconds = (2 * Math.abs(z - 169)) / 5.2;
      const travelFuel = travelSeconds * vehicles[FISHING_BOAT].fuel * 1.25;
      p.fuel -= travelFuel / 2;
      p.trawl = { seconds: 0, fuelUsed: 0, deployed: true };
      const start = p.fuel;
      for (let t = 0; t < minutes * 60 && p.fuel > travelFuel / 2 + 30; t += 10) {
        advanceTrawl(w, p, 10, 20, false, random);
        if (!p.trawl.deployed) {
          act(w, p.id, { type: 'trawl', operation: 'haul' });
          if (netWeight(w, p.inventory) > vehicles[FISHING_BOAT].capacity - 35) break;
          p.trawl.deployed = true;
        }
      }
      act(w, p.id, { type: 'trawl', operation: 'haul' });
      const value = Object.entries(p.inventory).reduce((s, [id, n]) => s + n * (bid[id] ?? 0), 0);
      const fuelCost =
        ((start - p.fuel + travelFuel) * buildings.boathouse.sell.fuel) / items.fuel.fuel!;
      const tripSeconds = minutes * 60 + travelSeconds;
      const supplies =
        (hands + 1) *
        (Math.ceil((tripSeconds * w.settings.hungerRate) / items.bread.food!) * items.bread.price +
          Math.ceil((tripSeconds * w.settings.thirstRate) / items.water.drink!) *
            items.water.price);
      const operating = value - fuelCost - supplies;
      sum += operating - Math.max(0, operating) * hands * 0.15;
      spent += fuelCost;
      if (value < fuelCost + supplies) losses++;
      if (netWeight(w, p.inventory) > vehicles[FISHING_BOAT].capacity - 40) full++;
      if (netWeight(w, p.inventory) < vehicles[FISHING_BOAT].capacity * 0.3) small++;
    }
    return {
      meanProfit: sum / trips / 10000,
      fuelCost: spent / trips / 10000,
      losses,
      full,
      small,
    };
  };
  const bay = run(500, 20, 500),
    ocean = run(6500, 210, 500),
    oneHand = run(6500, 210, 500, 1),
    twoHands = run(6500, 210, 500, 2);
  console.log({
    qualityBay: fishingGroundQuality(w, { x: 0, z: 500 }),
    qualityOcean: fishingGroundQuality(w, { x: 0, z: 6500 }),
    bay,
    ocean,
    oneHand,
    twoHands,
  });
  assert.ok(ocean.losses > 50 && ocean.full > 5 && ocean.small > 20, JSON.stringify(ocean));
  assert.ok(ocean.meanProfit > bay.meanProfit, JSON.stringify({ bay, ocean }));
  assert.ok(bay.meanProfit > -5 && bay.meanProfit < 8, JSON.stringify(bay));
  assert.ok(ocean.meanProfit > 0 && ocean.meanProfit < 45, JSON.stringify(ocean));
  assert.ok(
    oneHand.meanProfit > 0 && twoHands.meanProfit > 0,
    JSON.stringify({ oneHand, twoHands }),
  );
});
test('boatyard exports purchased fish with bounded real-cargo settlement, without exporting rescue fuel', () => {
  const { w, d } = setup(),
    b = d.building!;
  b.stock = { cod: 50, halibut: 20, tuna: 12, fuel: 50 };
  const before = b.investment;
  exportShipments(w, 1800);
  assert.equal(b.stock.fuel, 50 + Math.min(400, Math.floor(before / 3600)));
  assert.equal(b.stock.cod, 8);
  assert.equal(b.stock.halibut, 8);
  assert.equal(b.stock.tuna, 8);
  assert.ok(b.investment > before - 400 * 3600);
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

test('nets fill separately from the hold and hauling retains the same encounter and voyage luck', () => {
  const { w, p } = setup();
  sea(p);
  p.speed = 2;
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  p.trawl!.catch = { cod: NET_CAPACITY / 4 };
  p.trawl!.shoal = { ground: 0, nextChange: 1000, nextFish: 0, luck: 3.75, nextLuck: 5000 };
  advanceTrawl(w, p, 1, 2, false, seeded(42));
  assert.equal(p.trawl!.netFull, true);
  assert.equal(p.trawl!.deployed, false);
  assert.equal(p.trawl!.holdFull, false);
  assert.throws(() => act(w, p.id, { type: 'trawl', operation: 'deploy' }), /full/);
  const shoal = structuredClone(p.trawl!.shoal);
  act(w, p.id, { type: 'trawl', operation: 'haul' });
  assert.equal(p.inventory.cod, NET_CAPACITY / 4);
  assert.deepEqual(p.trawl!.shoal, shoal);
  act(w, p.id, { type: 'trawl', operation: 'deploy' });
  assert.equal(p.trawl!.shoal!.luck, 3.75);
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, move, carry } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { prepareFishingVoyages } from '../src/server/fishing-voyages';
import { terrainHeight, woodland } from '../src/shared/terrain';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import {
  boatLoadFactors,
  deckhands,
  expeditionAction,
  startVoyage,
} from '../src/shared/fishing-expedition';
import { fishingGroundQuality, deepFishingWater } from '../src/shared/fishing-water';
import { advanceTrawl, TRAWL_FUEL_PER_SECOND } from '../src/shared/commercial-fishing';
import { vehicles } from '../src/shared/catalog';
import { privatePlayer, prepareFrame } from '../src/server/snapshots';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  prepareFishingVoyages(w);
  const p = addPlayer(w, 'captain', 'Captain'),
    a = addPlayer(w, 'a', 'Able'),
    b = addPlayer(w, 'b', 'Baker');
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.berth, {
    vehicle: 30,
    fleet: [0, 5, 30],
    engine: true,
    online: true,
    inventory: {},
    fuel: 3200,
    speed: 0,
  });
  for (const q of [a, b])
    Object.assign(q, d.land, {
      vehicle: 5,
      online: true,
      inventory: {},
      y: travelHeight(w, d.land.x, d.land.z),
      speed: 0,
    });
  return { w, p, a, b, d };
}
function hire(s: ReturnType<typeof setup>) {
  for (const q of [s.a, s.b]) {
    act(s.w, s.p.id, { type: 'expedition', operation: 'offer', player: q.id, share: 15 });
    act(s.w, q.id, { type: 'expedition', operation: 'accept', captain: s.p.id });
  }
}
test('ocean expansion preserves existing terrain, woodland, buildings and fuel, and applies once', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  const locations = [
    { x: 0, z: 0 },
    { x: 900, z: 700 },
    { x: 4200, z: 5000 },
    { x: 6000, z: 0 },
  ];
  const heights = locations.map((p) => terrainHeight(w, p.x, p.z)),
    woods = locations.map((p) => woodland(w, p.x, p.z));
  const positions = w.buildings.map((b) => [b.id, b.x, b.z]);
  assert.equal(prepareFishingVoyages(w), true);
  assert.equal(w.settings.mapSize, 18500);
  assert.equal(w.terrainMapSize, 12500);
  assert.deepEqual(
    locations.map((p) => terrainHeight(w, p.x, p.z)),
    heights,
  );
  assert.deepEqual(
    locations.map((p) => woodland(w, p.x, p.z)),
    woods,
  );
  assert.deepEqual(
    w.buildings.map((b) => [b.id, b.x, b.z]),
    positions,
  );
  const till = w.buildings.find((b) => b.id === 'parish-boatyard')!.investment;
  assert.equal(till, 5000000, 'landing capital remains available after paying for fuel delivery');
  assert.equal(prepareFishingVoyages(w), false);
  assert.equal(w.buildings.find((b) => b.id === 'parish-boatyard')!.investment, till);
  assert.equal(deepFishingWater(w, { x: 0, z: 320 }), true);
  assert.equal(deepFishingWater(w, { x: 0, z: 230 }), false);
  const grades = [500, 2000, 4000, 6500].map((z) => fishingGroundQuality(w, { x: 0, z }));
  assert.ok(
    grades.every((n, i) => i === 0 || n > grades[i - 1]),
    JSON.stringify(grades),
  );
  for (let z = 500; z < 7500; z += 100)
    assert.ok(
      Math.abs(fishingGroundQuality(w, { x: 0, z }) - fishingGroundQuality(w, { x: 0, z: z + 1 })) <
        0.01,
    );
});
test('crew accept explicitly at the dock, cannot be replaced or leave at sea, and share real profit once', () => {
  const s = setup(),
    { w, p, a, b, d } = s;
  assert.throws(
    () => act(w, a.id, { type: 'expedition', operation: 'accept', captain: p.id }),
    /offer/,
  );
  hire(s);
  assert.equal(deckhands(w, p).length, 2);
  assert.equal(a.hitch, p.id);
  assert.equal(privatePlayer(w, a).crewBerth?.share, 15);
  p.z = 1000;
  p.speed = 2;
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(p.fishingVoyage!.departed, true);
  assert.throws(() => act(w, a.id, { type: 'detach' }), /boat to stop/i);
  assert.throws(() => act(w, a.id, { type: 'vehicle', slot: 5 }), /deckhand/);
  assert.throws(
    () => act(w, p.id, { type: 'expedition', operation: 'offer', player: a.id, share: 5 }),
    /dock/,
  );
  Object.assign(p, d.berth, { speed: 0, boatThrottle: 0 });
  p.inventory = { cod: 20 };
  p.fishingVoyage!.caught = { cod: 20 };
  p.fishingVoyage!.expenses = 20000;
  assert.throws(
    () =>
      act(w, p.id, { type: 'trade', building: d.id, direction: 'sell', item: 'cod', quantity: 20 }),
    /settle/i,
  );
  const cash = [p.cash, a.cash, b.cash],
    till = d.building!.investment;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  const receipts = 20 * d.building!.buy.cod,
    pay = Math.floor((receipts - 20000) * 0.15);
  assert.equal(a.cash, cash[1] + pay);
  assert.equal(b.cash, cash[2] + pay);
  assert.equal(p.cash, cash[0] + receipts - pay * 2);
  assert.equal(d.building!.investment, till - receipts);
  assert.equal(d.building!.stock.cod, 20);
  assert.equal(a.hitch, undefined);
  assert.equal(a.x, d.land.x);
  assert.equal(a.y, travelHeight(w, d.land.x, d.land.z));
  assert.throws(() => act(w, p.id, { type: 'expedition', operation: 'finish' }), /No expedition/);
});
test('crew may decline or leave before sailing; loss-making trips pay no shares and insufficient buyers cannot partially settle', () => {
  const s = setup(),
    { w, p, a, d } = s;
  act(w, p.id, { type: 'expedition', operation: 'offer', player: a.id, share: 25 });
  act(w, a.id, { type: 'expedition', operation: 'decline', captain: p.id });
  assert.equal(a.hitch, undefined);
  hire(s);
  act(w, a.id, { type: 'detach' });
  assert.equal(a.hitch, undefined);
  assert.equal(deckhands(w, p).length, 1);
  p.fishingVoyage!.expenses = 1e7;
  p.fishingVoyage!.caught = { cod: 2 };
  p.inventory = { cod: 2 };
  d.building!.investment = 0;
  const before = structuredClone(p);
  assert.throws(() => act(w, p.id, { type: 'expedition', operation: 'finish' }), /working cash/);
  assert.deepEqual(p, before);
  d.building!.investment = 200000;
  const crewCash = s.b.cash;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  assert.equal(s.b.cash, crewCash);
});
test('shared provisions consume equally online/offline for deckhands; online captains must eat manually', () => {
  const s = setup(),
    { w, p, a, b } = s;
  hire(s);
  p.inventory = { bread: 20, water: 20 };
  act(w, p.id, { type: 'expedition', operation: 'store', item: 'bread', quantity: 20 });
  act(w, p.id, { type: 'expedition', operation: 'store', item: 'water', quantity: 20 });
  const carried = carry(p, w);
  assert.ok(carried > 0);
  assert.equal(p.inventory.bread, 0);
  for (const q of [p, a, b]) {
    q.hunger = 30000;
    q.thirst = 30000;
    q.needsGraceUntil = 0;
  }
  b.online = false;
  advance(w, 1);
  assert.ok(p.hunger >= 30000);
  assert.ok(a.hunger < 30000 && b.hunger < 30000);
  assert.equal(a.hunger, b.hunger);
  assert.equal(a.thirst, b.thirst);
  p.online = false;
  advance(w, 1);
  assert.ok(p.hunger < 30000 && p.thirst < 30000);
  assert.ok(p.fishingVoyage!.expenses > 0);
  assert.throws(
    () =>
      expeditionAction(w, a, { type: 'expedition', operation: 'take', item: 'bread', quantity: 1 }),
    /Board your/,
  );
  const store = new Store(':memory:');
  store.saveWorld(w);
  const loaded = store.loadWorlds()[0].world;
  store.close();
  assert.deepEqual(loaded.players[p.id].boatStores, p.boatStores);
  assert.deepEqual(loaded.players[p.id].fishingVoyage, p.fishingVoyage);
});
test('cargo and bunker load reduce speed and increase fuel burn without changing other boats', () => {
  const { w, p } = setup();
  p.fuel = 1;
  p.inventory = {};
  const light = boatLoadFactors(w, p);
  p.fuel = 3200;
  p.inventory = { cod: 790 };
  const heavy = boatLoadFactors(w, p);
  assert.ok(heavy.speed < light.speed && heavy.fuel > light.fuel);
  const lightBoat = structuredClone(p),
    heavyBoat = structuredClone(p);
  Object.assign(lightBoat, {
    x: 0,
    z: 2000,
    heading: 0,
    fuel: 3200,
    inventory: {},
    boatThrottle: 1,
  });
  Object.assign(heavyBoat, { x: 0, z: 2000, heading: 0, boatThrottle: 1 });
  for (let i = 0; i < 600; i++) {
    move(w, lightBoat, { throttle: 0, steer: 0, boost: false }, 0.1);
    move(w, heavyBoat, { throttle: 0, steer: 0, boost: false }, 0.1);
  }
  assert.ok(lightBoat.speed > heavyBoat.speed);
  assert.ok(
    (3200 - heavyBoat.fuel) / (heavyBoat.z - 2000) > (3200 - lightBoat.fuel) / (lightBoat.z - 2000),
  );
  p.vehicle = 3;
  assert.deepEqual(boatLoadFactors(w, p), { speed: 1, fuel: 1 });
});

test('one tank covers 21 Puddlewick days of loaded towing plus the offshore round trip', () => {
  const { w, p } = setup();
  const seconds = 21 * w.settings.dayLength;
  assert.equal(seconds, 12600);
  const radius = 6500 - 169;
  // Worst loaded burn on both legs; actual bunker weight falls as fuel is used.
  const transit = ((radius * 2) / vehicles[30].speed) * vehicles[30].fuel * 1.5;
  assert.ok(seconds * TRAWL_FUEL_PER_SECOND * 1.5 + transit < vehicles[30].tank!);
  Object.assign(p, {
    x: 0,
    z: 6500,
    speed: 1.7,
    fuel: vehicles[30].tank! - transit / 2,
    inventory: { cod: 790 },
    trawl: {
      seconds: 0,
      deployed: true,
      fuelUsed: 0,
      shoal: { ground: 0, nextChange: 1e8, nextFish: 1e8, luck: 0.45, nextLuck: 1e8 },
    },
  });
  for (let elapsed = 0; elapsed < seconds; elapsed += 10) advanceTrawl(w, p, 10, 17);
  assert.equal(p.trawl!.seconds, seconds);
  assert.ok(p.fuel > transit / 2 + 100, `Return fuel reserve ${p.fuel}`);
});
test('returning deckhands can step ashore before sale without forfeiting their contracted pay', () => {
  const s = setup(),
    { w, p, a, d } = s;
  hire(s);
  p.fishingVoyage!.departed = true;
  p.fishingVoyage!.caught = { cod: 20 };
  p.inventory = { cod: 20 };
  d.building!.investment = 0;
  act(w, a.id, { type: 'detach' });
  assert.equal(a.hitch, undefined);
  assert.equal(p.fishingVoyage!.members[a.id], 15);
  d.building!.investment = 1e6;
  const before = a.cash;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  assert.ok(a.cash > before);
});
test('offline deckhands remain visible aboard, while private catches stay hidden', () => {
  const s = setup();
  hire(s);
  s.a.online = false;
  s.p.online = false;
  const frame = prepareFrame(s.w);
  assert.equal(JSON.parse(frame.players[s.a.id]).hitch, s.p.id);
  assert.equal(JSON.parse(frame.players[s.p.id]).vehicle, 30);
});
test('provisions stay aboard on disembarking and count against capacity when reboarding', () => {
  const { w, p, a, b, d } = setup();
  w.settings.vehicleLicences = false;
  a.online = false;
  b.online = false;
  p.boatStores = { bread: 200 };
  p.inventory = {};
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.boatStores.bread, 200);
  assert.equal(carry(p, w), 0);
  Object.assign(p, d.land, { y: travelHeight(w, d.land.x, d.land.z) });
  p.inventory = { cod: 790 };
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 30 }), /Unload cargo/);
  p.inventory = {};
  act(w, p.id, { type: 'vehicle', slot: 30 });
  assert.equal(carry(p, w), 200);
});

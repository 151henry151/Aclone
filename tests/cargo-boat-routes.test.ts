// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, act, advance, makeBuilding } from '../src/shared/simulation';
import { vehicleDef } from '../src/shared/vehicle-config';
import { vehicleRunningRules } from '../src/shared/vehicle-running-rules';
import { trailerDefs } from '../src/shared/trailers';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { landBounds, mapHalf, terrainHeight } from '../src/shared/terrain';
import { surfaceWaterLevel } from '../src/shared/ocean';
import { quaySetup } from './freight-quay.test';
import { boatLandings } from '../src/shared/boathouse';
import { quaySite } from '../src/shared/quay';
import { worldItems } from '../src/shared/world-catalogue';
import { economyRules } from '../src/shared/economy-rules';
import type { World, Player } from '../src/shared/types';
function sail(w: World, p: Player, target: { x: number; z: number }) {
  let elapsed = 0;
  while (Math.hypot(target.x - p.x, target.z - p.z) > 0.5 && elapsed < 40000) {
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    p.heading = Math.atan2(target.x - p.x, target.z - p.z);
    p.boatThrottle = 1;
    p.engine = true;
    const dt = Math.min(1, distance / vehicleDef(w, p.vehicle).speed);
    move(w, p, { throttle: 0, steer: 0, boost: false }, dt);
    w.time += dt;
    elapsed += dt;
    assert.ok(p.fuel > 0, 'Fuel exhausted before arrival');
    assert.ok(p.boatThrottle > 0, 'Route contacted the shore');
  }
  assert.ok(Math.hypot(target.x - p.x, target.z - p.z) <= 0.5, 'Did not arrive');
  p.speed = 0;
  p.engine = false;
  p.boatThrottle = 0;
  return elapsed;
}
test('full coastal bulk loads beat every tractor and tipping trailer on fuel per delivered weight-distance', () => {
  const w = createWorld('fuel-economics', 'Economics', 'owner'),
    v = vehicleDef(w, 35),
    rules = vehicleRunningRules(w.settings);
  const sea = v.fuel / v.speed / v.holdCapacity!;
  for (const slot of [0, 24, 25, 26, 27, 28]) {
    const tractor = vehicleDef(w, slot),
      road =
        ((tractor.fuel / tractor.speed) * (rules.trailerFuelBase + rules.trailerLoadFuelPenalty)) /
        (tractor.capacity + trailerDefs.dump.capacity);
    assert.ok(sea < road, `${v.name} ${sea} must beat ${tractor.name} ${road}`);
  }
});
test('a fully loaded coaster completes a surveyed circuit around the expanded island with reserve', () => {
  const w = createWorld('puddlewick', 'Coast circuit', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.settings.requireCaptainSkill = false;
  w.settings.vehicleLicences = false;
  const b = landBounds(w),
    margin = 500,
    points = [
      { x: b.minX - margin, z: b.maxZ + margin },
      { x: b.maxX + margin, z: b.maxZ + margin },
      { x: b.maxX + margin, z: b.minZ - margin },
      { x: b.minX - margin, z: b.minZ - margin },
    ];
  assert.ok(points.every((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) < mapHalf(w) - 20));
  const p = addPlayer(w, 'owner', 'Captain'),
    v = vehicleDef(w, 35);
  Object.assign(p, points[0], {
    y: 0,
    vehicle: 35,
    fleet: [0, 5, 35],
    fuel: v.tank,
    boatHold: { stone: 1000 },
    engine: true,
  });
  let seconds = 0;
  const startFuel = p.fuel;
  for (const target of [...points.slice(1), points[0]]) seconds += sail(w, p, target);
  assert.ok(
    p.fuel >= v.tank! * 0.2,
    'Keep at least twenty percent in reserve after a full circuit',
  );
  console.log(
    'COAST_CIRCUIT',
    JSON.stringify({
      metres: p.fleetState![35].metres,
      seconds,
      fuelUsed: startFuel - p.fuel,
      reserve: p.fuel,
      condition: p.fleetState![35].condition,
    }),
  );
});
test('funded 4 km quarry-to-mason freight remains profitable after purchase, tax, fuel, maintenance and crew', () => {
  const { w, b } = quaySetup();
  w.terrainMapSize = 1000;
  w.settings.mapSize = 10000;
  b.x = -2000;
  w.settings.requireCaptainSkill = false;
  w.settings.vehicleLicences = false;
  w.settings.hungerRate = 0;
  w.settings.thirstRate = 0;
  w.settings.dayLength = 0;
  const other = makeBuilding('destination', 'quay', 2000, 0);
  other.rotation = Math.PI;
  w.buildings.push(other);
  assert.ok(quaySite(w, b));
  assert.ok(quaySite(w, other));
  const docks = boatLandings(w),
    origin = docks.find((d) => d.id === b.id)!,
    destination = docks.find((d) => d.id === other.id)!;
  const seller = makeBuilding('quarry', 'quarry', origin.land.x + 15, origin.land.z);
  seller.stock = { stone: 1000 };
  seller.capacity = 2000;
  seller.recipe = undefined;
  seller.owner = 'merchant';
  const buyer = makeBuilding('mason', 'mason', destination.land.x + 15, destination.land.z);
  buyer.stock = {};
  buyer.capacity = 2000;
  buyer.investment = 2000000;
  buyer.recipe = undefined;
  buyer.owner = 'merchant';
  w.buildings.push(seller, buyer);
  const p = addPlayer(w, 'owner', 'Captain'),
    v = vehicleDef(w, 35);
  Object.assign(p, origin.berth, {
    heading: Math.PI / 2,
    vehicle: 35,
    fleet: [0, 5, 35],
    inventory: {},
    boatHold: {},
    fuel: v.tank,
    cash: 10000000,
  });
  const q = addPlayer(w, 'crew', 'Crew');
  Object.assign(q, origin.land, {
    vehicle: 5,
    y: terrainHeight(w, origin.land.x, origin.land.z),
    online: true,
  });
  act(w, p.id, { type: 'expedition', operation: 'offer', player: q.id, share: 20 });
  act(w, q.id, { type: 'expedition', operation: 'accept', captain: p.id });
  const cash = p.cash,
    crew = q.cash,
    fuel = p.fuel;
  act(w, p.id, {
    type: 'trade',
    storage: 'hold',
    slot: 35,
    direction: 'buy',
    building: seller.id,
    item: 'stone',
    quantity: 1000,
  });
  advance(w, 200);
  assert.equal(p.boatHold?.stone, 1000);
  const acquisition = cash - p.cash;
  const outbound = sail(w, p, destination.berth);
  act(w, p.id, {
    type: 'trade',
    storage: 'hold',
    slot: 35,
    direction: 'sell',
    building: buyer.id,
    item: 'stone',
    quantity: 1000,
  });
  advance(w, 200);
  assert.equal(p.boatHold?.stone, 0);
  const inbound = sail(w, p, origin.berth),
    fuelCost = p.fishingVoyage!.expenses;
  act(w, p.id, { type: 'expedition', operation: 'finish' });
  const condition = p.fleetState![35].condition,
    maintenance =
      ((100 - condition) / 25) *
      (economyRules(w.settings).vehicleServiceFee +
        economyRules(w.settings).vehicleServiceSteel * worldItems(w).steel.price);
  const net = p.cash - cash - fuelCost - maintenance;
  assert.ok(net > 0);
  assert.equal(seller.stock.stone, 0);
  assert.equal(buyer.stock.stone, 1000);
  assert.ok(q.cash > crew);
  console.log(
    'FREIGHT_ROUTE',
    JSON.stringify({
      metres: p.fleetState![35].metres,
      acquisition,
      receipts: buyer.buy.stone * 1000,
      fuelUsed: fuel - p.fuel,
      fuelCost,
      maintenance,
      crewPay: q.cash - crew,
      net,
      seconds: outbound + inbound + 400,
      capital: v.price,
      paybackTrips: v.price / net,
    }),
  );
});

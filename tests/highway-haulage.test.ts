// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createWorld, addPlayer, makeBuilding, act, move, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { Navigator } from '../src/server/npc/navigation';
import { vehicleRecord } from '../src/shared/vehicle-services';
import { vehicleRunningRules } from '../src/shared/vehicle-running-rules';
import { recipes } from '../src/shared/catalog';
import { productionInterval } from '../src/shared/simulation';
import { economyRules } from '../src/shared/economy-rules';
import { worldBuildings } from '../src/shared/world-catalogue';

test('a loaded highway rig delivers finite paid freight and drives the empty return, accounting for fuel, wear and handling', () => {
  const w = createWorld('highway-earnings', 'Truck freight', 'owner');
  w.towns = [];
  w.terrain = [];
  w.zones = [];
  w.buildings = [];
  w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
  Object.assign(w.settings, {
    mapSize: 5000,
    seaLevel: -50,
    vehicleMaintenance: true,
    hungerRate: 0,
    thirstRate: 0,
    activeWork: false,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  w.roads = [{ a: { x: 0, z: -100 }, b: { x: 0, z: 1100 }, width: 50 }];
  w.pavedRoads = [{ ...w.roads[0], town: '', kind: 'trunk' }];
  const p = addPlayer(w, 'haulier', 'Haulier');
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 20,
    heading: 0,
    vehicle: 37,
    fleet: [0, 5, 37],
    fuelVehicle: 37,
    fuel: 320,
    engine: false,
    cash: 50_000_000,
    inventory: {},
    skills: ['driver'],
    online: true,
  });
  const t = {
    id: 'box',
    owner: p.id,
    kind: 'semiBox' as const,
    x: 0,
    z: -7.1,
    heading: 0,
    attached: p.id,
    cargo: {} as Record<string, number>,
  };
  w.trailers = { box: t };
  const seller = makeBuilding('steel', 'forge', -16, 0),
    buyer = makeBuilding('buyer', 'warehouse', -16, 1000);
  seller.owner = 'mill-owner';
  buyer.owner = 'factory-owner';
  seller.stock = {};
  seller.investment = 10_000_000;
  seller.sell = { steel: 22000 };
  buyer.stock = {};
  buyer.buy = { steel: 24921 };
  buyer.capacity = 1500;
  buyer.investment = 1500 * 24921;
  const ore = makeBuilding('ore', 'warehouse', -16, 0);
  ore.owner = 'mine-owner';
  ore.stock = { ore: 7500 };
  ore.sell = { ore: worldBuildings(w).mine.sell.ore };
  w.buildings = [seller, buyer, ore];
  const millOwner = addPlayer(w, 'mill-owner', 'Mill owner');
  Object.assign(millOwner, { x: -16, z: 0, vehicle: 0, cash: 50_000_000, inventory: {} });
  for (let i = 0; i < worldBuildings(w).forge.idealEmployees!; i++) {
    const q = addPlayer(w, 'mill-worker' + i, 'Steelworker');
    Object.assign(q, { x: -16, z: 0, skills: [recipes[seller.recipe!].skill] });
    act(w, q.id, { type: 'job', building: seller.id });
  }
  const millOpening = millOwner.cash + seller.investment;
  const cash = p.cash,
    fuel = p.fuel,
    condition = vehicleRecord(w, p).condition;
  let supplied = 0,
    productionWait = 0,
    inputOre = 0,
    loadingSeconds = 0;
  while (supplied < 1500) {
    if ((seller.stock.ore ?? 0) < recipes[seller.recipe!].inputs.ore && ore.stock.ore > 0) {
      const n = Math.min(50, ore.stock.ore);
      act(w, millOwner.id, {
        type: 'trade',
        building: ore.id,
        direction: 'buy',
        item: 'ore',
        quantity: n,
      });
      act(w, millOwner.id, {
        type: 'stock',
        building: seller.id,
        direction: 'deposit',
        item: 'ore',
        quantity: n,
      });
      inputOre += n;
    }
    const interval = productionInterval(w, seller);
    advance(w, interval);
    productionWait += interval;
    const n = Math.min(seller.stock.steel ?? 0, 1500 - supplied);
    if (n) {
      act(w, p.id, {
        type: 'trade',
        building: seller.id,
        direction: 'buy',
        item: 'steel',
        quantity: n,
        storage: 'trailer',
        trailer: t.id,
      });
      supplied += n;
      advance(w, 30);
      loadingSeconds += 30;
    }
    assert.ok(productionWait < 400 * 3600, 'Finite real steel production supplies the load');
  }
  assert.equal(seller.accounts?.produced.steel, 1500);
  assert.equal(seller.accounts?.consumed.ore, 7500);
  let seconds = 0;
  const go = (z: number) => {
    const nav = new Navigator(w, p, { x: 0, z }, 2, true);
    let arrived = false;
    for (let i = 0; i < 16000; i++) {
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined, `Haulage route: ${result.error} at ${p.x},${p.z}`);
      if (result.arrived) {
        arrived = true;
        break;
      }
      const before = { x: p.x, z: p.z };
      move(w, p, result.input, 0.05);
      seconds += 0.05;
      assert.ok(Math.hypot(p.x - before.x, p.z - before.z) < 2, 'No teleport to the customer');
    }
    assert.ok(arrived, 'Reach the actual loading/unloading point');
  };
  p.engine = true;
  go(1000);
  act(w, p.id, {
    type: 'trade',
    building: buyer.id,
    direction: 'sell',
    item: 'steel',
    quantity: 1500,
    storage: 'trailer',
    trailer: t.id,
  });
  advance(w, 30);
  go(0);
  advance(w, seconds);
  const record = vehicleRecord(w, p),
    fuelBurned = fuel - p.fuel,
    wear = condition - record.condition;
  const economy = economyRules(w.settings),
    catalogue = worldBuildings(w);
  const fuelProvision = (fuelBurned / w.settings.fuelUnitsPerItem!) * catalogue.garage.sell.fuel;
  const serviceProvision =
    (wear / 25) *
    (economy.vehicleServiceFee + economy.vehicleServiceSteel * catalogue.forge.sell.steel);
  const gross = p.cash - cash,
    net = gross - fuelProvision - serviceProvision;
  assert.equal(buyer.stock.steel, 1500);
  assert.equal(seller.stock.steel, 0);
  assert.equal(buyer.investment, 0);
  assert.equal(
    Object.values(t.cargo).reduce((sum, n) => sum + Number(n), 0),
    0,
  );
  assert.ok(
    record.metres > 1990 && record.metres < 2400,
    'Count actual outward and empty return movement',
  );
  assert.ok(fuelBurned > 0 && wear > 0 && net > 0);
  assert.ok(
    Math.abs(wear - record.metres * vehicleRunningRules(w.settings).vehicleWearPerMetre) < 1e-6,
  );
  const result = {
    steelDelivered: 1500,
    metres: record.metres,
    driveSeconds: seconds,
    handlingSeconds: loadingSeconds + 30,
    productionWaitHours: productionWait / 3600,
    inputOre,
    millRealizedContribution: millOwner.cash + seller.investment - millOpening,
    fuelBurned,
    conditionLost: wear,
    grossTradingMargin: gross,
    fuelProvision,
    serviceProvision,
    netContribution: net,
    buyerFundsRemaining: buyer.investment,
    assumptions:
      'One full 3,000-weight load from finite paid Ore, an actual staffed Steel mill and its production waits on a broad surveyed paved corridor, actual Navigator steering and empty return through shared physics. Conservative resident speed control, not a claim of continuous 65 mph. Replacement fuel and amortized service are cost provisions; purchase prices of truck, trailer, bridge and road construction are excluded from operating contribution.',
  };
  mkdirSync('output/automotive-factory', { recursive: true });
  writeFileSync('output/automotive-factory/highway-haulage.json', JSON.stringify(result, null, 2));
});

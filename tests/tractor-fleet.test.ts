// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  move,
  terrainHeight,
  canCarry,
} from '../src/shared/simulation.ts';
import { vehicles } from '../src/shared/catalog.ts';
import {
  tractorSlots,
  fuelCapacity,
  returnTractor,
  tractorSurface,
} from '../src/shared/tractors.ts';
import { vehicleRecord, requiredLicence } from '../src/shared/vehicle-services.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { refuellingStatus } from '../src/shared/player-aid.ts';
import { Store } from '../src/server/store.ts';
import { actionVisible, actionBlocker } from '../src/client/action-visibility.ts';
import { tractorShapes } from '../src/client/tractor-fleet.ts';
import { vehicleGround } from '../src/client/vehicle-ground.ts';
import { Vector3, Quaternion } from 'three';
function setup() {
  const w = createWorld('tractors', 'Tractors', 'a'),
    p = addPlayer(w, 'a', 'Ada');
  p.online = true;
  p.x = p.z = 0;
  p.y = terrainHeight(w, 0, 0);
  p.inventory = { fuel: 100 };
  p.cash = 1000000;
  const b = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [b];
  return { w, p, b };
}
function choose(w: any, p: any, b: any, slot: number) {
  act(w, p.id, { type: 'vehicle', slot, building: b.id });
}
test('six tractor choices have no universally superior specification, even ignoring price', () => {
  assert.equal(tractorSlots.length, 6);
  const merits = (i: number) => {
    const v = vehicles[i];
    return [
      v.speed,
      v.acceleration,
      v.turn,
      v.capacity,
      v.tank!,
      v.speed / v.fuel,
      v.traction!,
      v.headlight!,
      v.lightRange!,
    ];
  };
  for (const a of tractorSlots)
    for (const b of tractorSlots) {
      if (a === b) continue;
      assert.ok(
        merits(a).some((v, i) => v > merits(b)[i]),
        `${vehicles[a].name} must have a strength over ${vehicles[b].name}`,
      );
    }
  assert.equal(vehicles[8].name, 'Custom slot 9');
  assert.equal(vehicles[23].name, 'Custom slot 24');
});
test('purchase charges once; recall preserves fuel, condition and ownership across a save', () => {
  const { w, p, b } = setup();
  p.inventory = { fuel: 5 };
  p.fuel = 31;
  choose(w, p, b, 28);
  assert.equal(p.cash, 1000000 - vehicles[28].price);
  assert.equal(p.fuel, 0);
  assert.equal(fuelCapacity(p), 104);
  act(w, p.id, { type: 'use', item: 'fuel' });
  assert.equal(p.fuel, 8);
  vehicleRecord(w, p).condition = 63;
  choose(w, p, b, 0);
  assert.equal(p.fuel, 31);
  choose(w, p, b, 28);
  assert.equal(p.fuel, 8);
  const cash = p.cash;
  choose(w, p, b, 28);
  assert.equal(p.cash, cash);
  assert.equal(p.fuel, 8);
  assert.equal(vehicleRecord(w, p).condition, 63);
  choose(w, p, b, 5);
  assert.equal(returnTractor(p), 28);
  assert.equal(fuelCapacity(p), 104);
  p.x = 100;
  act(w, p.id, { type: 'vehicle', slot: returnTractor(p) });
  assert.equal(p.vehicle, 28);
  assert.equal(p.fuel, 8);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const q = store.loadWorlds()[0].world.players.a;
    assert.deepEqual(q.parkedFuel, p.parkedFuel);
    assert.equal(q.fuel, 8);
    assert.equal(returnTractor(q), 28);
  } finally {
    store.close();
  }
});
test('small and large tanks cap both inventory and roadside refuelling at the correct capacity', () => {
  for (const slot of tractorSlots) {
    const { w, p, b } = setup();
    p.inventory = { fuel: 2 };
    choose(w, p, b, slot);
    p.fuel = fuelCapacity(p) - 1;
    act(w, p.id, { type: 'use', item: 'fuel' });
    assert.equal(p.fuel, fuelCapacity(p));
    assert.throws(() => act(w, p.id, { type: 'use', item: 'fuel' }), /full/);
    assert.equal(p.inventory.fuel, 1);
    const donor = addPlayer(w, 'b', 'Bo');
    donor.online = true;
    donor.x = p.x;
    donor.z = p.z;
    donor.y = p.y;
    donor.inventory = { fuel: 2 };
    p.fuel -= 3;
    assert.equal(refuellingStatus(w, donor, p).units, 3);
    act(w, donor.id, { type: 'refuelPlayer', player: p.id });
    assert.equal(p.fuel, fuelCapacity(p));
  }
});
test('purchase and cargo failures cannot change a tank, charge cash or grant ownership', () => {
  const { w, p, b } = setup();
  p.inventory = { water: 200 }; // 200 weight: fits only the hauler
  p.vehicle = 26;
  p.fleet = [0, 5, 26];
  p.fuel = 50;
  const before = JSON.stringify(p);
  assert.throws(() => choose(w, p, b, 24), /Unload/);
  assert.equal(JSON.stringify(p), before);
  p.inventory = {};
  p.cash = 1;
  const broke = JSON.stringify(p);
  assert.throws(() => choose(w, p, b, 25), /cash/);
  assert.equal(JSON.stringify(p), broke);
  p.cash = 1000000;
  p.x = 50;
  const distant = JSON.stringify(p);
  assert.throws(() => choose(w, p, b, 25), /closer|near|18|Visit/i);
  assert.equal(JSON.stringify(p), distant);
});
test('all tractor cargo capacities apply to purchases and controls respect the remembered tractor', () => {
  const { w, p, b } = setup();
  p.inventory = {};
  for (const slot of tractorSlots) {
    choose(w, p, b, slot);
    assert.equal(canCarry(p, 'water', vehicles[slot].capacity, w), true);
    assert.equal(canCarry(p, 'water', vehicles[slot].capacity + 1, w), false);
    assert.equal(
      requiredLicence({ ...w, settings: { ...w.settings, vehicleLicences: true } }, slot),
      undefined,
    );
    assert.equal(actionVisible(w, p, 'tractor'), false);
  }
  p.inventory = {};
  choose(w, p, b, 5);
  assert.equal(actionVisible(w, p, 'tractor'), true);
  assert.equal(returnTractor(p), 28);
  p.cash = 0;
  p.fleet = [0, 5];
  assert.equal(actionBlocker(w, p, 'vehicle', '25', b), 'Not enough cash');
});
test('real movement separates road courier, snow specialist and efficient starter; deep snow still matters', () => {
  function drive(slot: number, snow: number) {
    const { w, p } = setup();
    w.buildings = [];
    w.creator = creatorSchema.parse({ roads: false });
    w.roads = [];
    w.climate = { snow: snow ? 1 : 0, snowDepth: snow, wetness: 0 };
    p.vehicle = slot;
    p.inventory = {};
    p.engine = true;
    p.fuel = 64;
    p.x = 20;
    p.z = 0;
    p.y = terrainHeight(w, p.x, p.z);
    p.speed = 100;
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    return p.speed;
  }
  assert.ok(drive(25, 0) > drive(0, 0));
  assert.ok(drive(27, 0.16) > drive(25, 0.16));
  assert.ok(drive(27, 1) < drive(27, 0.16));
  for (const slot of tractorSlots) {
    assert.equal(tractorSurface(1, vehicles[slot].traction), 1);
    assert.ok(drive(slot, 0) > drive(slot, 0.16));
  }
  assert.ok(vehicles[0].speed / vehicles[0].fuel > vehicles[25].speed / vehicles[25].fuel);
});
test('each unique wheelbase rests all four contacts on sloped terrain', () => {
  for (const slot of tractorSlots) {
    const d = tractorShapes[slot];
    const contacts = [-d.half, d.half].flatMap((x) =>
      [d.rear, d.front].map((z) => new Vector3(x, 0, z)),
    );
    for (const heading of [0, 0.7, Math.PI, 4.3]) {
      const height = (x: number, z: number) => 3 + x * 0.3 - z * 0.2;
      const pose = vehicleGround(12, 21, heading, height, contacts);
      const q = new Quaternion().setFromEuler(pose.rotation);
      for (const c of contacts) {
        const v = c
          .clone()
          .applyQuaternion(q)
          .add(new Vector3(12, pose.y, 21));
        assert.ok(Math.abs(v.y - height(v.x, v.z)) < 1e-8);
      }
    }
  }
});

test('legacy shared fuel migrates once and minigames neither fill nor lose parked tractor tanks', () => {
  const { w, p, b } = setup();
  p.inventory = {};
  p.vehicle = 8;
  p.fuel = 21;
  choose(w, p, b, 0);
  assert.equal(p.fuel, 21);
  choose(w, p, b, 28);
  assert.equal(p.fuel, 0);
  p.fuel = 92;
  act(w, p.id, { type: 'joinGame', game: 'race' });
  assert.equal(p.vehicle, 0);
  assert.equal(fuelCapacity(p), 64);
  assert.equal(p.fuel, 21);
  assert.equal(p.parkedFuel?.[28], 92);
  act(w, p.id, { type: 'leaveGame' });
  choose(w, p, b, returnTractor(p));
  assert.equal(p.vehicle, 28);
  assert.equal(p.fuel, 92);
});

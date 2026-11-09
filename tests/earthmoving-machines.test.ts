// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, move, advance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { vehicles } from '../src/shared/catalog';
import {
  automotiveConfig,
  automotiveSchema,
  patchAutomotive,
} from '../src/shared/automotive-config';
import { advanceManufacturing } from '../src/shared/automotive-manufacturing';
import { requiredLicence } from '../src/shared/vehicle-services';
import { vehicleDef, validateVehicleTuning } from '../src/shared/vehicle-config';
import { skillSlotsUsed } from '../src/shared/survival-rules';
import { prepareFrame } from '../src/server/snapshots';
import { switchVehicle } from '../src/shared/tractors';
import { trailerAction } from '../src/shared/trailers';
import { exportDesign, applyDesign } from '../src/server/world-design';

const DOZER = 38,
  BACKHOE = 39;
function setup() {
  const w = createWorld('plant-test', 'Plant', 'owner');
  w.towns = [];
  w.zones = [];
  w.terrain = [];
  w.roads = [];
  w.airfield = undefined;
  w.spaceportSite = undefined;
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, {
    mapSize: 2000,
    seaLevel: -40,
    vehiclesPersist: true,
    arrivalAnimation: 'off',
    activeWork: false,
    vehicleMaintenance: false,
    hungerRate: 0,
    thirstRate: 0,
  });
  const owner = addPlayer(w, 'owner', 'Founder'),
    p = addPlayer(w, 'buyer', 'Operator');
  Object.assign(p, {
    x: 0,
    z: 17,
    y: 20,
    vehicle: 5,
    online: true,
    speed: 0,
    cash: 30_000_000,
    inventory: {},
    skills: [],
  });
  Object.assign(owner, { x: 0, z: 0, skills: ['engineer'], online: false });
  const b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
  b.owner = owner.id;
  b.investment = 1_000_000;
  w.buildings = [b];
  return { w, p, b, owner };
}
test('earthmovers append fleet slots and require the distinct configurable plant qualification', () => {
  const { w, p } = setup();
  assert.match(vehicles[DOZER]?.name ?? '', /bulldozer/i);
  assert.match(vehicles[BACKHOE]?.name ?? '', /backhoe/i);
  assert.equal(vehicles[37].name, 'Highway tractor unit');
  w.settings.vehicleLicences = false;
  for (const slot of [DOZER, BACKHOE]) {
    assert.equal(requiredLicence(w, slot), 'plant operator');
    Object.assign(p, {
      vehicle: slot,
      fleet: [0, 5, slot],
      fuel: 100,
      fuelVehicle: slot,
      engine: true,
      skills: ['driver', 'excavator'],
      speed: 0,
    });
    const before = { x: p.x, z: p.z };
    move(w, p, { throttle: 1, steer: 0, boost: true }, 0.1);
    assert.deepEqual({ x: p.x, z: p.z }, before, 'existing qualifications cannot operate plant');
    p.skills.push('plant operator');
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.1);
    assert.ok(p.speed > 0);
  }
  act(w, 'owner', { type: 'settings', patch: { earthworksPlantLicence: false } });
  assert.equal(requiredLicence(w, DOZER), undefined);
  w.settings.vehicleLicences = true;
  assert.equal(
    requiredLicence(w, DOZER),
    'driver',
    'waiver leaves ordinary road licence policy intact',
  );
});
test('school teaches plant operator separately, charges configured tuition and enforces skill limits', () => {
  const { w, p } = setup();
  const school = makeBuilding('school', 'school', 0, 17);
  w.buildings = [school];
  act(w, 'owner', { type: 'settings', patch: { schoolLaterPrice: 1234, schoolLaterSeconds: 2 } });
  w.settings.licencesCountSkills = true;
  w.settings.maxSkills = 2;
  p.skills = ['driver', 'excavator'];
  assert.throws(
    () => act(w, p.id, { type: 'learn', building: school.id, skill: 'plant operator' }),
    /skill limit/i,
  );
  p.skills = ['excavator'];
  const cash = p.cash;
  act(w, p.id, { type: 'learn', building: school.id, skill: 'plant operator' });
  assert.equal(p.cash, cash - 1234);
  advance(w, 2);
  assert.deepEqual(p.skills, ['excavator', 'plant operator']);
  assert.equal(skillSlotsUsed(w, p), 2);
  w.settings.licencesCountSkills = false;
  assert.equal(
    skillSlotsUsed(w, p),
    1,
    'plant qualification follows configurable licence counting',
  );
});
test('both machines require real assembly and paid factory delivery, never a garage purchase', () => {
  for (const [product, slot] of [
    ['bulldozer', DOZER],
    ['backhoe', BACKHOE],
  ] as const) {
    const { w, p, b, owner } = setup();
    const recipe = (automotiveConfig(w).products as any)[product];
    assert.ok(recipe, 'factory product exists');
    assert.throws(() => act(w, p.id, { type: 'vehicle', slot }), /manufactured|factory/i);
    b.stock = { ...recipe.inputs };
    w.settings.ownerOperation = true;
    act(w, owner.id, { type: 'manufacturing', op: 'queue', building: b.id, product });
    assert.equal(b.manufacturing!.ready.length, 0);
    advanceManufacturing(w, 0, recipe.seconds * automotiveConfig(w).factory.idealEmployees);
    assert.equal(b.manufacturing!.ready.length, 1);
    const unit = b.manufacturing!.ready[0];
    const buy = () =>
      act(w, p.id, {
        type: 'manufacturing',
        op: 'buy',
        building: b.id,
        unit: unit.id,
        expectedPrice: recipe.price,
      });
    const cash = p.cash;
    buy();
    assert.equal(p.cash, cash - recipe.price);
    assert.ok(p.fleet!.includes(slot));
    const parked = w.parkedVehicles![p.id + ':' + slot];
    assert.ok(parked);
    assert.equal(parked.fuel, 0);
    assert.throws(buy, /stock|unit/i);
    Object.assign(p, { x: parked.x, z: parked.z });
    assert.throws(() => act(w, p.id, { type: 'vehicle', slot }), /plant operator/i);
    p.skills = ['plant operator'];
    act(w, p.id, { type: 'vehicle', slot });
    assert.equal(p.vehicle, slot);
    assert.equal(p.fuel, 0);
  }
});
test('earthmover road and field speed caps resist boost, burn fuel and accept per-world tuning', () => {
  for (const [slot, roadSpeed, fieldSpeed] of [
    [DOZER, 8 / 3.6, 1.5],
    [BACKHOE, 8, 3],
  ]) {
    for (const road of [false, true]) {
      const { w, p } = setup();
      w.buildings = [];
      w.roads = road ? [{ a: { x: 0, z: -800 }, b: { x: 0, z: 800 }, width: 10 }] : [];
      Object.assign(p, {
        x: 0,
        z: 0,
        vehicle: slot,
        fleet: [0, 5, slot],
        fuel: 100,
        fuelVehicle: slot,
        engine: true,
        skills: ['plant operator'],
      });
      for (let i = 0; i < 600; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.05);
      const cap = road ? roadSpeed : fieldSpeed;
      assert.ok(
        p.speed <= cap + 0.01 && p.speed > cap * 0.9,
        `${slot}/${road}: ${p.speed} vs ${cap}`,
      );
      assert.ok(p.fuel < 100, 'working engine consumes fuel');
      const tuning = validateVehicleTuning(w, slot, { speed: 1, offRoadSpeed: 0.5 });
      w.vehicleTuning = { [slot]: tuning };
      p.speed = 0;
      for (let i = 0; i < 200; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.05);
      assert.ok(p.speed <= (road ? 1 : 0.5) + 0.01);
    }
  }
});
test('legacy automotive settings gain machine defaults and portable overrides retain old prices', () => {
  const { w } = setup();
  const legacy = structuredClone(automotiveConfig(w)) as any;
  delete legacy.products.bulldozer;
  delete legacy.products.backhoe;
  legacy.products.tractor.price = 12345;
  w.automotive = automotiveSchema.parse(legacy);
  assert.ok((automotiveConfig(w).products as any).bulldozer);
  w.automotive = patchAutomotive(w, {
    products: { bulldozer: { price: 22222 }, backhoe: { seconds: 1000 } },
  });
  const next = createWorld('portable', 'Portable', 'other');
  applyDesign(next, exportDesign(w));
  assert.equal(automotiveConfig(next).products.tractor.price, 12345);
  assert.equal((automotiveConfig(next).products as any).bulldozer.price, 22222);
  assert.equal(vehicleDef(next, DOZER).price, 22222);
  assert.equal((automotiveConfig(next).products as any).backhoe.seconds, 1000);
});

test('implement controls require an available qualified machine and survive snapshots', () => {
  const { w, p } = setup();
  assert.throws(() => act(w, p.id, { type: 'earthmovingImplement' }), /earthmov|machine/i);
  p.vehicle = DOZER;
  p.skills = ['driver'];
  assert.throws(() => act(w, p.id, { type: 'earthmovingImplement' }), /plant operator/i);
  p.skills = ['plant operator'];
  act(w, p.id, { type: 'earthmovingImplement' });
  assert.equal(p.earthmovingImplement, true);
  assert.equal(JSON.parse(prepareFrame(w).players[p.id]).earthmovingImplement, true);
  act(w, p.id, { type: 'earthmovingImplement' });
  assert.equal((p as any).earthmovingImplement, false);
});

test('haulage purchase choices do not mistake earthmovers for semitrailers', async () => {
  const { automotivePurchaseChoices } = await import('../src/server/npc/automotive-policy');
  const { w, p, b } = setup();
  p.fleet = [0, 5, 37];
  const warehouse = makeBuilding('business', 'farm', 100, 100);
  warehouse.owner = p.id;
  w.buildings.push(warehouse);
  b.manufacturing = { orders: [], ready: [{ id: 'plant', product: 'bulldozer', completedAt: 0 }] };
  const choices: string[] = [];
  automotivePurchaseChoices(
    w,
    p,
    w.buildings,
    (description) => {
      choices.push(description);
    },
    (_b, steps) => steps,
  );
  assert.deepEqual(
    choices,
    [],
    'residents hire plant operators rather than treating a dozer as haulage equipment',
  );
});

test('dismounting raises the implement before another machine is boarded', () => {
  const { w, p } = setup();
  p.vehicle = DOZER;
  p.skills = ['plant operator'];
  act(w, p.id, { type: 'earthmovingImplement' });
  assert.equal(p.earthmovingImplement, true);
  switchVehicle(p, 5, true, w);
  switchVehicle(p, BACKHOE, true, w);
  assert.ok(!p.earthmovingImplement);
});

test('earthmover prediction agrees with authoritative driving without mutating snapshot terrain', () => {
  for (const slot of [DOZER, BACKHOE]) {
    const { w, p } = setup();
    w.buildings = [];
    Object.assign(p, {
      vehicle: slot,
      fuel: 100,
      fuelVehicle: slot,
      engine: true,
      skills: ['plant operator'],
    });
    const snapshot = structuredClone(w),
      before = structuredClone(snapshot),
      prediction = structuredClone(p);
    for (let i = 0; i < 120; i++) {
      const input = { throttle: 1, steer: 0.3, boost: true };
      move(w, p, input, 0.05);
      move(snapshot, prediction, input, 0.05, true);
    }
    assert.ok(Math.hypot(p.x - prediction.x, p.z - prediction.z) < 1e-7);
    assert.deepEqual(snapshot, before);
  }
});

test('machine delivery refuses insufficient cash, duplicate ownership and blocked yards atomically', () => {
  for (const [product, slot] of [
    ['bulldozer', DOZER],
    ['backhoe', BACKHOE],
  ] as const) {
    for (const problem of ['cash', 'owned', 'blocked']) {
      const { w, p, b } = setup();
      b.manufacturing = { orders: [], ready: [{ id: 'built', product, completedAt: 0 }] };
      if (problem === 'cash') p.cash = 0;
      if (problem === 'owned') p.fleet = [0, 5, slot];
      if (problem === 'blocked')
        for (let x = -40; x <= 40; x += 8)
          for (let z = 16; z <= 70; z += 8)
            w.buildings.push(makeBuilding(`block-${x}-${z}`, 'garage', x, z));
      const before = structuredClone(w);
      assert.throws(
        () =>
          act(w, p.id, {
            type: 'manufacturing',
            op: 'buy',
            building: b.id,
            unit: 'built',
            expectedPrice: automotiveConfig(w).products[product].price,
          }),
        /cash|already|clear/i,
      );
      assert.deepEqual(w, before);
    }
  }
});

test('a bulldozer cannot hitch an agricultural trailer', () => {
  const { w, p } = setup();
  Object.assign(p, { vehicle: DOZER, skills: ['plant operator'], x: 0, z: 0, heading: 0 });
  w.trailers = {
    tipper: { id: 'tipper', owner: p.id, kind: 'dump', x: 0, z: -3, heading: 0, cargo: {} },
  };
  const before = structuredClone(w);
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: 'tipper' }),
    /tractor|hitch/i,
  );
  assert.deepEqual(w, before);
});

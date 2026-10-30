// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move } from '../src/shared/simulation';
import { boatShoreCollision } from '../src/shared/boat-shore';
import { terrainHeight } from '../src/shared/terrain';
import { waterLevel } from '../src/shared/ocean';
import { vehicleCondition } from '../src/shared/vehicle-services';
import { vehicleDef } from '../src/shared/vehicle-config';

function setup(slot = 30) {
  const w = createWorld('shore-test', 'Shore test', 'owner');
  w.buildings = [];
  w.zones = [];
  w.terrain = [];
  w.settings.vehicleLicences = false;
  w.settings.vehicleMaintenance = false; // Isolate impact damage from normal travel wear.
  w.settings.tidalRange = 0;
  w.settings.oceanWaves = 0;
  const p = addPlayer(w, 'skipper', 'Skipper');
  Object.assign(p, {
    vehicle: slot,
    x: 0,
    z: 165,
    y: -2,
    heading: Math.PI,
    speed: 4,
    engine: true,
    fuel: 100,
    boatThrottle: 1,
  });
  return { w, p };
}

for (const slot of [3, 30, 31]) {
  test(`boat ${slot} rebounds from shore, loses only 1 condition point, idles and can reverse away`, () => {
    const { w, p } = setup(slot);
    const held = { throttle: 1, steer: 0, boost: false };
    let beforeImpact = p.z;
    for (let i = 0; i < 300 && vehicleCondition(p) === 100; i++) {
      beforeImpact = p.z;
      move(w, p, held, 0.05);
    }
    assert.equal(vehicleCondition(p), 99);
    assert.ok(p.z > beforeImpact, 'recoil moves the boat backwards into water');
    assert.ok(terrainHeight(w, p.x, p.z) < waterLevel(w));
    assert.equal(p.speed, 0);
    assert.equal(p.boatThrottle, 0);
    assert.equal(p.engine, true, 'shore impacts idle the throttle without stopping the engine');
    const parked = { x: p.x, z: p.z };
    for (let i = 0; i < 600; i++) move(w, p, held, 0.05);
    assert.deepEqual({ x: p.x, z: p.z }, parked);
    assert.equal(vehicleCondition(p), 99, 'holding throttle cannot cause repeated hits');
    for (let i = 0; i < 80; i++) move(w, p, { ...held, throttle: -1 }, 0.05);
    assert.ok(p.z > parked.z + 1, 'reverse remains usable');
    assert.equal(vehicleCondition(p), 99);
  });
}

test('latched fishing throttle cuts out even without a held key; releasing and reapplying permits another impact', () => {
  const { w, p } = setup();
  const idle = { throttle: 0, steer: 0, boost: false };
  for (let i = 0; i < 300 && vehicleCondition(p) === 100; i++) move(w, p, idle, 0.05);
  assert.equal(vehicleCondition(p), 99);
  const z = p.z;
  for (let i = 0; i < 300; i++) move(w, p, idle, 0.05);
  assert.equal(p.z, z);
  for (let i = 0; i < 300 && vehicleCondition(p) === 99; i++)
    move(w, p, { ...idle, throttle: 1 }, 0.05);
  assert.equal(vehicleCondition(p), 98);
});

test('reverse impacts, tidal boundaries and swept narrow land strips are blocked', () => {
  const { w, p } = setup();
  p.heading = 0;
  p.speed = -3;
  p.boatThrottle = -0.4;
  for (let i = 0; i < 300 && vehicleCondition(p) === 100; i++)
    move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
  assert.equal(vehicleCondition(p), 99);
  assert.equal(p.boatThrottle, 0);
  // A dry ridge between two wet endpoints must not be skipped by a fast tick.
  w.terrain = [{ x: 0, z: 190, radius: 1, height: 20 }];
  const hit = boatShoreCollision(w, { x: 0, z: 185 }, { x: 0, z: 195 }, 0.2);
  assert.ok(hit && hit.z < 190);
  w.terrain = [];
  w.settings.seaLevel = -1;
  assert.equal(boatShoreCollision(w, { x: 0, z: 160 }, { x: 0, z: 150 }, 0.8), undefined);
  w.settings.seaLevel = -3;
  assert.ok(boatShoreCollision(w, { x: 0, z: 160 }, { x: 0, z: 150 }, 0.8));
});

test('prediction matches the server without mutating shared fleet records', () => {
  const { w, p } = setup();
  p.z = 155;
  p.speed = 4;
  p.fleetState = { 30: { acquiredAt: 0, metres: 5, condition: 80 } };
  const previous = p.fleetState;
  const predicted = { ...p };
  const input = { throttle: 0, steer: 0, boost: false };
  move(w, predicted, input, 0.25, true);
  assert.equal(previous[30].condition, 80);
  move(w, p, input, 0.25);
  assert.equal(vehicleCondition(p), 79);
  assert.deepEqual(predicted, p);
});

for (const slot of [3, 29, 30, 31, 32, 33]) {
  test(`boat ${slot} can retreat from an already overlapping shoreline without further damage`, () => {
    const { w, p } = setup(slot);
    // A receding tide or a larger saved hull can put the bow beyond the water
    // boundary before this tick. Starting in collision must not trap the boat.
    const halfLength = vehicleDef(w, slot).length! / 2;
    let boundary = 140;
    while (terrainHeight(w, 0, boundary) >= waterLevel(w) - 0.05) boundary += 0.01;
    p.z = boundary + halfLength - 0.25;
    assert.ok(terrainHeight(w, 0, p.z - halfLength) >= waterLevel(w) - 0.05);
    p.speed = 0;
    p.boatThrottle = 0;
    const start = p.z;
    for (let i = 0; i < 400; i++) move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
    assert.ok(p.z > start + 3, `boat should reverse into water; travelled ${p.z - start} m`);
    assert.equal(vehicleCondition(p), 100, 'escaping an overlap is not a new impact');
  });
}

test('an overlapping hull cannot use recovery to move further onto land or cross a dry ridge', () => {
  const { w } = setup();
  const from = { x: 0, z: 155 };
  const r = 3.7,
    halfLength = 12.25;
  assert.ok(boatShoreCollision(w, from, { x: 0, z: 154 }, r, Math.PI, halfLength));
  // Wet endpoints on the far side are not enough: each swept step must escape
  // the existing overlap, never climb through dry ground.
  w.terrain = [{ x: 0, z: 190, radius: 2, height: 20 }];
  const ridge = { x: 0, z: 189.5 },
    beyond = { x: 0, z: 195 };
  assert.ok(terrainHeight(w, ridge.x, ridge.z) >= waterLevel(w));
  assert.ok(terrainHeight(w, beyond.x, beyond.z) < waterLevel(w));
  assert.ok(boatShoreCollision(w, ridge, beyond, 0.2));
});

test('falling water allows forward escape from a stranded stern and prediction agrees', () => {
  const { w, p } = setup();
  p.heading = 0;
  p.speed = 0;
  p.boatThrottle = 0;
  p.z = 164;
  const v = vehicleDef(w, p.vehicle);
  const end = { x: p.x, z: p.z + 0.1 };
  assert.equal(
    boatShoreCollision(w, p, end, v.collisionRadius!, p.heading, v.length! / 2),
    undefined,
  );
  w.settings.seaLevel -= 1;
  assert.ok(terrainHeight(w, p.x, p.z - v.length! / 2) >= waterLevel(w) - 0.05);
  const predicted = structuredClone(p),
    input = { throttle: 1, steer: 0, boost: false };
  for (let i = 0; i < 300; i++) {
    move(w, predicted, input, 0.05, true);
    move(w, p, input, 0.05);
  }
  assert.ok(p.z > 167, 'a stranded stern can escape forwards');
  assert.equal(vehicleCondition(p), 100);
  for (const key of [
    'x',
    'y',
    'z',
    'heading',
    'speed',
    'fuel',
    'boatThrottle',
    'fleetState',
  ] as const)
    assert.deepEqual(predicted[key], p[key], `predicted ${key} matches the server`);
});

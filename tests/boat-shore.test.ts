// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move } from '../src/shared/simulation';
import { boatShoreCollision } from '../src/shared/boat-shore';
import { terrainHeight } from '../src/shared/terrain';
import { waterLevel } from '../src/shared/ocean';
import { vehicleCondition } from '../src/shared/vehicle-services';

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

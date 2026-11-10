// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { parkingStatus } from '../src/client/parking-status';
import { parkedReturnReason } from '../src/shared/parked-vehicles';
import { boardingPanel, boardingReason } from '../src/client/parking-status';
function setup(slot = 39) {
  const w = createWorld('boarding', 'Boarding', 'owner');
  w.buildings = [];
  w.settings.vehiclesPersist = true;
  w.settings.arrivalAnimation = 'off';
  w.settings.garageStoresSpareTractors = false;
  const p = addPlayer(w, 'owner', 'Owner');
  Object.assign(p, {
    vehicle: 5,
    x: 4,
    z: 0,
    y: 0,
    heading: 0,
    speed: 0,
    fuelVehicle: 24,
    lastTractor: 24,
    fleet: [0, 5, 24, 38, 39],
    skills: ['plant operator'],
    inventory: {},
  });
  const record = (slot: number, x: number) => ({
    owner: p.id,
    slot,
    x,
    z: 0,
    y: 0,
    heading: 0,
    fuel: 15,
    condition: 90,
    parkedAt: w.time,
  });
  w.parkedVehicles = {
    'owner:24': { ...record(24, 60), inside: 'garage' },
    ['owner:' + slot]: record(slot, 0),
  };
  return { w, p, slot };
}
test('the nearby backhoe takes priority over the stored last tractor and can be boarded beside its body', () => {
  const { w, p, slot } = setup();
  assert.equal(parkingStatus(w, p)?.slot, slot);
  assert.equal(parkedReturnReason(w, p, slot), undefined);
  act(w, p.id, { type: 'vehicle', slot });
  assert.equal(p.vehicle, slot);
  assert.equal(p.fuel, 15);
  assert.ok(!w.parkedVehicles!['owner:' + slot]);
});
test('boarding uses rotated, world-tuned vehicle dimensions and the configured reach', () => {
  for (const slot of [0, 38, 39]) {
    const { w, p } = setup(slot);
    const v = w.parkedVehicles!['owner:' + slot];
    w.vehicleTuning = { [slot]: { length: 14, width: 4 } };
    v.heading = Math.PI / 2;
    w.settings.parkingReturnRange = 1;
    p.x = 7.9;
    p.z = 0;
    assert.equal(parkedReturnReason(w, p, slot), undefined);
    p.x = 8.1;
    assert.match(parkedReturnReason(w, p, slot)!, /Walk/);
    p.x = 0;
    p.z = 3.1;
    assert.match(parkedReturnReason(w, p, slot)!, /Walk/);
  }
});
test('a different height, storage and missing qualifications explain unavailable boarding', () => {
  const { w, p, slot } = setup();
  p.y = 30;
  assert.match(parkedReturnReason(w, p, slot)!, /height|level/);
  p.y = 0;
  p.skills = [];
  assert.match(parkingStatus(w, p)?.returnReason ?? '', /plant operator/);
  w.parkedVehicles!['owner:' + slot].inside = 'garage';
  assert.match(parkedReturnReason(w, p, slot)!, /garage/);
});

test('inventory lists the nearby machine and explains empty, foreign, busy and unqualified states', () => {
  const { w, p, slot } = setup();
  assert.match(boardingPanel(w, p), /Get in Backhoe/);
  p.skills = [];
  assert.match(boardingPanel(w, p), /disabled.*Get in Backhoe/);
  assert.match(boardingPanel(w, p), /plant operator/);
  p.skills = ['plant operator'];
  p.speed = 1;
  assert.match(boardingReason(w, p, w.parkedVehicles!['owner:' + slot])!, /Stop/);
  p.speed = 0;
  w.parkedVehicles!['owner:' + slot].owner = 'other';
  assert.match(boardingReason(w, p, w.parkedVehicles!['owner:' + slot])!, /not yours/);
  assert.match(boardingPanel(w, p), /No owned parked vehicle/);
});

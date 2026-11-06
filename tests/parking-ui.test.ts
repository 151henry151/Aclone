// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
test('walking guidance names the real empty tank, distance, compass direction and nearby refuel refusal', async () => {
  const ui = await import('../src/client/parking-status');
  const w = createWorld('parking', 'Parking', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'off' });
  Object.assign(p, { x: 0, z: 0, y: 0, speed: 0, fuel: 0, fuelVehicle: 0, inventory: { fuel: 1 } });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  p.z = 340;
  const status = (ui as any).parkingStatus(w, p);
  assert.match(status.text, /Out of fuel.*340 m north/);
  assert.match(status.refuelReason, /within 3 metres/);
  assert.deepEqual(status.point, { x: 0, z: 0, name: 'Puddle tractor' });
  p.x = -1.4;
  p.z = 0;
  assert.equal((ui as any).parkingStatus(w, p).refuelReason, undefined);
  act(w, p.id, { type: 'refuelParked', slot: 0 });
  assert.doesNotMatch((ui as any).parkingStatus(w, p).text, /Out of fuel/);
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal((ui as any).parkingStatus(w, p), undefined);
});

test('custom approach reach is honored by home actions and their UI blocker', async () => {
  const { makeBuilding, withinBuildingRange } = await import('../src/shared/simulation');
  const { actionBlocker } = await import('../src/client/action-visibility');
  const w = createWorld('range', 'Range', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  w.buildings = [b];
  Object.assign(w.settings, { vehiclesPersist: true, arrivalAnimation: 'full', arrivalRange: 30 });
  Object.assign(p, { x: 0, z: 25, y: 0, speed: 0 });
  assert.equal(withinBuildingRange(w, p, b), true);
  assert.equal(actionBlocker(w, p, 'home', undefined, b), undefined);
  act(w, p.id, { type: 'home', building: b.id });
  assert.equal(p.task?.kind, 'entering');
});

test('first steps explain walking back and delayed building entry using the world rules', async () => {
  const { firstSteps } = await import('../src/shared/first-steps');
  const w = createWorld('hints', 'Hints', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(w.settings, {
    vehiclesPersist: true,
    parkingReturnRange: 4,
    arrivalAnimation: 'full',
  });
  const text = firstSteps(w, p)
    .map((s) => s.detail)
    .join(' ');
  assert.match(text, /4 m/);
  assert.match(text, /walk.*door|door.*panel/i);
  assert.match(text, /fuel/i);
});

test('roadside help describes the configured parked reach and fuel item yield', async () => {
  const { playerAidPanel } = await import('../src/client/player-aid');
  const w = createWorld('aid-ui', 'Aid UI', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  Object.assign(w.settings, { vehiclesPersist: true, parkingReturnRange: 4 });
  const html = playerAidPanel(p, w);
  assert.match(html, /4 metres.*parked|parked.*4 metres/);
});

test('the configured arrival reach includes its boundary in both actions and interaction hints', async () => {
  const { makeBuilding, withinBuildingRange } = await import('../src/shared/simulation');
  const w = createWorld('edge', 'Edge', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    b = makeBuilding('home', 'home', 0, 0);
  Object.assign(w.settings, { vehiclesPersist: true, arrivalRange: 18 });
  Object.assign(p, { x: 18, z: 0 });
  w.buildings = [b];
  assert.equal(withinBuildingRange(w, p, b), true);
  p.x = 18.01;
  assert.equal(withinBuildingRange(w, p, b), false);
});

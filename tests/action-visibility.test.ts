// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { actionVisible, actionBlocker } from '../src/client/action-visibility.ts';

const setup = () => {
  const w = createWorld('visibility', 'Visibility', 'pilot');
  const p = addPlayer(w, 'pilot', 'Pilot');
  const b = w.buildings.find((b) => b.kind === 'farm')!;
  return { w, p, b };
};
test('movement controls follow body, home, task and passenger state', () => {
  const { w, p } = setup();
  p.inventory.rc = 1;
  const available = () =>
    ['walk', 'tractor', 'crow', 'detach'].filter((a) => actionVisible(w, p, a));
  p.vehicle = 0;
  assert.deepEqual(available(), ['walk', 'crow']);
  p.vehicle = 5;
  assert.deepEqual(available(), ['tractor', 'crow']);
  p.atHome = true;
  assert.deepEqual(available(), []);
  p.atHome = false;
  p.task = { kind: 'labour', end: w.time + 15 };
  assert.deepEqual(available(), []);
  delete p.task;
  p.hitch = 'driver';
  assert.deepEqual(available(), ['detach']);
  delete p.hitch;
  p.crowBody = { x: p.x, z: p.z, vehicle: 5 };
  p.vehicle = 7;
  p.inventory.rc = 0;
  assert.deepEqual(available(), ['crow']);
  assert.equal(actionVisible(w, p, 'use', 'water'), false);
});
test('activity controls only apply to the current activity and world rules', () => {
  const { w, p } = setup();
  assert.equal(actionVisible(w, p, 'reel'), false);
  assert.equal(actionVisible(w, p, 'kricket'), false);
  assert.equal(actionVisible(w, p, 'leaveGame'), false);
  p.game = 'fishing';
  assert.equal(actionVisible(w, p, 'reel'), true);
  assert.equal(actionVisible(w, p, 'joinGame', 'fishing'), false);
  assert.equal(actionVisible(w, p, 'leaveGame'), true);
  delete p.game;
  w.settings.fishingMode = 0;
  assert.equal(actionVisible(w, p, 'joinGame', 'fishing'), false);
  w.settings.fighting = false;
  assert.equal(actionVisible(w, p, 'joinCombat', 'ctf'), false);
});
test('farm visitors cannot tend or expand, and completed plot care is hidden', () => {
  const { w, p, b } = setup();
  assert.equal(p.authority, 20);
  assert.equal(actionVisible(w, p, 'farm', 'plant', b, 0), false);
  assert.equal(actionVisible(w, p, 'farm', 'expand', b), false);
  b.employees.push(p.id);
  assert.equal(actionVisible(w, p, 'farm', 'plant', b, 0), true);
  b.plots = [{ crop: 'hay', planted: w.time, ready: w.time + 100, water: 3, fertilized: true }];
  assert.equal(actionVisible(w, p, 'farm', 'water', b, 0), false);
  assert.equal(actionVisible(w, p, 'farm', 'fertilize', b, 0), false);
  assert.equal(actionVisible(w, p, 'farm', 'harvest', b, 0), false);
  w.time += 101;
  assert.equal(actionVisible(w, p, 'farm', 'harvest', b, 0), true);
  b.owner = p.id;
  assert.equal(actionVisible(w, p, 'farm', 'expand', b), true);
});
test('irrelevant garage, school and property actions are hidden', () => {
  const { w, p, b } = setup();
  p.vehicle = 0;
  assert.equal(actionVisible(w, p, 'vehicle', '0'), false);
  p.skills.push('farmer');
  assert.equal(actionVisible(w, p, 'learn', 'farmer'), false);
  assert.equal(actionVisible(w, p, 'use', 'tools'), false);
  p.fuel = 64;
  assert.equal(actionVisible(w, p, 'use', 'fuel'), false);
  b.condition = 100;
  assert.equal(actionVisible(w, p, 'repair', undefined, b), false);
  b.government = true;
  assert.equal(actionVisible(w, p, 'demolish', undefined, b), false);
});
test('caretakers invest as neighbours unless explicitly managing a business', () => {
  const { w, p, b } = setup();
  b.owner = 'someone-else';
  b.government = false;
  p.x = b.x;
  p.z = b.z;
  p.cash = 100000;
  act(w, p.id, { type: 'investment', building: b.id, direction: 'deposit', amount: 1000 });
  assert.equal(b.stakes?.find((s) => s.investor === p.id)?.principal, 1000);
  act(w, p.id, {
    type: 'investment',
    building: b.id,
    direction: 'deposit',
    amount: 1000,
    caretaker: true,
  });
  assert.equal(b.stakes?.find((s) => s.investor === p.id)?.principal, 1000);
  const guest = addPlayer(w, 'guest', 'Guest');
  guest.x = b.x;
  guest.z = b.z;
  assert.throws(
    () =>
      act(w, guest.id, {
        type: 'investment',
        building: b.id,
        direction: 'withdraw',
        amount: 1,
        caretaker: true,
      }),
    /No earned return/,
  );
});

test('visible alternatives explain missing cargo space, qualification and purchase funds', () => {
  const { w, p, b } = setup();
  p.x = b.x;
  p.z = b.z;
  p.cash = 0;
  assert.match(actionBlocker(w, p, 'buyBuilding', undefined, b)!, /cash/);
  p.inventory.stone = 100;
  assert.match(actionBlocker(w, p, 'walk')!, /Unload/);
  assert.match(actionBlocker(w, p, 'farm', 'plant', b)!, /Farmer/);
  p.skills.push('farmer');
  assert.equal(actionBlocker(w, p, 'farm', 'plant', b), undefined);
});

import type { Player } from '../src/shared/types';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, move } from '../src/shared/simulation';
import { prepareFrame } from '../src/server/snapshots';

test('mount and dismount freeze movement for the configured duration and publish the same sequence to observers', () => {
  const w = createWorld('mount', 'Mount', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.buildings = [];
  Object.assign(w.settings, {
    vehiclesPersist: true,
    arrivalAnimation: 'full',
    hungerRate: 0,
    thirstRate: 0,
  });
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 0,
    heading: 0,
    fuel: 31,
    fuelVehicle: 0,
    speed: 0,
    online: true,
  });
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.task?.kind, 'dismounting');
  assert.equal(p.task!.end - w.time, 1.6);
  const before = [p.x, p.y, p.z];
  move(w, p, { throttle: 1, steer: 1, boost: true }, 1);
  assert.deepEqual([p.x, p.y, p.z], before);
  const other = addPlayer(w, 'observer', 'Observer');
  assert.deepEqual(JSON.parse(prepareFrame(w).players[p.id]).task, p.task);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 0 }), /finish|Finish/);
  advance(w, 1.6);
  assert.equal(p.task, undefined);
  w.settings.parkingMountSeconds = 2.4;
  act(w, p.id, { type: 'vehicle', slot: 0 });
  assert.equal((p as Player).task?.kind, 'mounting');
  assert.ok(Math.abs((p as Player).task!.end - w.time - 2.4) < 1e-8);
  assert.equal(p.fuel, 31);
  advance(w, 2.4);
  assert.equal(p.task, undefined);
  w.settings.arrivalAnimation = 'off';
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(p.task, undefined);
});

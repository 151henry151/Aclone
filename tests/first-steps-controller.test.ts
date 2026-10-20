// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, terrainHeight } from '../src/shared/simulation.ts';
import { firstSteps } from '../src/shared/first-steps.ts';
import { controllerInput } from '../src/client/controller.ts';
import { worldResources, resourceAmount } from '../src/shared/resources.ts';
test('first steps reflect survival and job rules without promising remote stock', () => {
  const w = createWorld('intro', 'Intro', 'server'),
    p = addPlayer(w, 'p', 'Pilot');
  assert.ok(firstSteps(w, p).some((s) => s.title === 'Carry provisions'));
  w.settings.hungerRate = w.settings.thirstRate = 0;
  w.settings.jobsEnabled = false;
  assert.ok(
    !firstSteps(w, p).some((s) => s.title === 'Carry provisions' || s.title.includes('wages')),
  );
});
test('controller dead zone, disconnection and axis remapping', () => {
  const pad = { axes: [0.1, -1], buttons: [] };
  assert.deepEqual(controllerInput(pad), { throttle: 1, steer: 0, boost: false });
  assert.deepEqual(controllerInput(null), { throttle: 0, steer: 0, boost: false });
});
test('repeat gathering uses serial tasks, stops on disconnect and refunds only unfinished reservation', () => {
  const w = createWorld('gather', 'Gather', 'server'),
    p = addPlayer(w, 'p', 'Pilot');
  const n = worldResources(w).find((n) => n.item === 'dirt')!;
  w.buildings = [];
  p.x = n.x;
  p.z = n.z;
  p.y = terrainHeight(w, p.x, p.z);
  p.inventory = { shovel: 1 };
  p.online = true;
  const before = resourceAmount(w, n);
  act(w, p.id, { type: 'gather', node: n.id, repeat: true });
  advance(w, 21);
  assert.equal(p.inventory.dirt, 3);
  assert.equal(p.task?.repeat, true);
  act(w, p.id, { type: 'stopGather' });
  act(w, p.id, { type: 'stopGather' });
  assert.equal(resourceAmount(w, n), before - 3);
  assert.equal(p.task, undefined);
  act(w, p.id, { type: 'gather', node: n.id, repeat: true });
  p.online = false;
  advance(w, 21);
  assert.equal(p.inventory.dirt, 3);
  assert.equal(p.task, undefined);
  assert.equal(resourceAmount(w, n), before - 3);
});

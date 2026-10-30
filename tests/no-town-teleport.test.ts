// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, advance, command, createWorld } from '../src/shared/simulation';
import { stepSchema } from '../src/server/npc/decision';

test('legacy town-return actions cannot relocate players or clear their state', () => {
  for (const vehicle of [0, 5, 3, 29, 30]) {
    for (const authority of [0, 20]) {
      const w = createWorld('no-teleport', 'Travel', 'server');
      const p = addPlayer(w, 'p', 'Pilot');
      Object.assign(p, {
        x: 170,
        z: 210,
        vehicle,
        authority,
        fuel: 0,
        inventory: { bread: 3, water: 4 },
        courseRun: {
          id: 'run',
          definition: 'test',
          start: 0,
          next: 1,
          last: { x: 170, z: 210 },
          hold: 0,
          vehicle,
          deaths: 0,
        },
      });
      for (const action of [
        { type: 'respawn' },
        { type: 'command', text: '*resetpos' },
        { type: 'chat', text: '*resetpos' },
      ]) {
        const before = JSON.stringify(w);
        assert.throws(() => act(w, p.id, action), /travel|reset is unavailable/);
        assert.equal(
          JSON.stringify(w),
          before,
          `state changed for ${action.type}, vehicle ${vehicle}`,
        );
      }
    }
  }
});

test('real deaths still respawn with the configured losses, without a client request', () => {
  const w = createWorld('death', 'Travel', 'server');
  const p = addPlayer(w, 'p', 'Pilot');
  Object.assign(p, { x: 170, z: 70, health: 1, hunger: 50000, thirst: 50000, inventory: {} });
  w.settings.loseInventoryOnDeath = true;
  p.inventory.stone = 1;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(p.health, 60000);
  assert.equal(p.x, 0);
  assert.equal(p.z, 17);
  assert.deepEqual(p.inventory, {});
});

test('caretaker recovery requires authority and NPC plans cannot request a free respawn', () => {
  const w = createWorld('recovery', 'Travel', 'server');
  const p = addPlayer(w, 'p', 'Pilot');
  p.authority = 0;
  const before = JSON.stringify(w);
  assert.throws(() => command(w, p, '*teleport p 10 20'), /authority/);
  assert.equal(JSON.stringify(w), before);
  p.authority = 12;
  command(w, p, '*teleport p 10 20');
  assert.equal(p.x, 10);
  assert.equal(p.z, 20);
  assert.doesNotMatch(command(w, p, '*help'), /resetpos/);
  assert.equal(
    stepSchema.safeParse({ kind: 'operation', operation: 'respawn', parameters: [] }).success,
    false,
  );
});

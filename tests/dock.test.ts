// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, act, terrainHeight } from '../src/shared/simulation.ts';
import { dockHeight, travelHeight, fishingDock } from '../src/shared/dock.ts';

test('tractors drive up the dock ramp, remain on its deck, and reverse back to shore', () => {
  const w = createWorld('dock', 'Dock', 'p');
  const p = addPlayer(w, 'p', 'Pilot');
  p.x = fishingDock.x;
  p.z = 134;
  p.y = terrainHeight(w, p.x, p.z);
  p.heading = 0;
  for (let i = 0; i < 160 && p.z < 158; i++) {
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    assert.ok(p.y >= travelHeight(w, p.x, p.z) - 0.001, 'never sink below the deck');
  }
  assert.ok(p.z > 155, 'cross the shoreline without resetting to town');
  assert.equal(p.y, dockHeight(w));
  assert.ok(terrainHeight(w, p.x, p.z) < w.settings.seaLevel);
  p.speed = 0;
  for (let i = 0; i < 200 && p.z > 134; i++)
    move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
  assert.ok(p.z < 136);
  assert.ok(Math.abs(p.y - terrainHeight(w, p.x, p.z)) < 0.1);
});
test('fishing places players on the deck and deck height follows sea-level changes', () => {
  const w = createWorld('dock', 'Dock', 'p');
  const p = addPlayer(w, 'p', 'Pilot');
  w.settings.seaLevel = 3;
  act(w, p.id, { type: 'joinGame', game: 'fishing' });
  assert.equal(p.y, dockHeight(w));
  assert.ok(p.y > w.settings.seaLevel);
  p.y = -4;
  move(w, p, { throttle: 0, steer: 0, boost: false }, 0.05);
  assert.equal(p.y, dockHeight(w), 'already fishing players recover after an upgrade');
  act(w, p.id, { type: 'leaveGame' });
  assert.equal(p.game, undefined);
  assert.equal(p.y, dockHeight(w));
});

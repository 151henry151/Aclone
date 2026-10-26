// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, createWorld, makeBuilding, move } from '../src/shared/simulation.ts';
import {
  blocksBuilding,
  buildingBlocksMovement,
  buildingPenetration,
} from '../src/shared/building-shapes.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { vehicles } from '../src/shared/catalog.ts';

function farm(rotation = 0) {
  return {
    ...makeBuilding('worksite', 'farm', 0, 0),
    architecture: 'model-5',
    style: 'stone-gable',
    size: 'standard' as const,
    rotation,
    construction: { gravel: 4, blocks: 15, wood: 5 },
  };
}
function point(x: number, z: number, rotation: number) {
  return {
    x: x * Math.cos(rotation) + z * Math.sin(rotation),
    z: z * Math.cos(rotation) - x * Math.sin(rotation),
  };
}
for (const rotation of [0, Math.PI / 2, 0.73]) {
  test(`tractor escapes overlapping farm wall and equipment yard at rotation ${rotation}`, () => {
    const w = createWorld('escape', 'Escape', 'owner');
    w.creator = creatorSchema.parse({ scenery: false, roads: false });
    const b = farm(rotation);
    w.buildings = [b];
    const p = addPlayer(w, 'builder', 'Builder');
    // An anonymized reproduction of the incident: the tractor's clearance
    // overlaps both barn and yard, with a 25cm gap between their actual walls.
    Object.assign(p, point(6.1250000173, 0.8328642145, rotation), {
      y: 0,
      heading: 78.5878172036 + rotation,
      speed: 0,
    });
    const start = { x: p.x, z: p.z };
    assert.ok(blocksBuilding(b, p.x, p.z, 0, 1.3));
    for (let i = 0; i < 200; i++) move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
    assert.ok(
      Math.hypot(p.x - start.x, p.z - start.z) > 3,
      'must move out instead of bouncing forever',
    );
    assert.equal(blocksBuilding(b, p.x, p.z, 0, 1.3), false);
    assert.equal(p.deaths, 0);
  });
}
test('escape follows the exterior of the combined footprint and still blocks entering or going deeper', () => {
  const b = farm();
  const trapped = { x: 6.125, z: 0.83 };
  const escape = { x: 6.225, z: 0.93 };
  assert.ok(
    buildingPenetration(b, escape.x, escape.z, 0, 1.3) <
      buildingPenetration(b, trapped.x, trapped.z, 0, 1.3),
  );
  assert.equal(buildingBlocksMovement(b, trapped, escape, 0, 1.3), false);
  assert.equal(buildingBlocksMovement(b, escape, trapped, 0, 1.3), true);
  assert.equal(buildingBlocksMovement(b, { x: -8, z: 0 }, { x: -7, z: 0 }, 0, 1.3), true);
  assert.equal(blocksBuilding(b, trapped.x, trapped.z, 100, 1.3), false);
});
test('escaping one footprint cannot bypass a second building', () => {
  const w = createWorld('escape-blocked', 'Escape', 'owner');
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  const b = farm(),
    other = makeBuilding('neighbour', 'warehouse', 7, 15);
  w.buildings = [b, other];
  const p = addPlayer(w, 'builder', 'Builder');
  Object.assign(p, { x: 6.125, z: 0.83, y: 0, heading: 78.5878172036, speed: 0 });
  for (let i = 0; i < 400; i++) {
    move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
    assert.equal(
      blocksBuilding(other, p.x, p.z, 0, vehicles[p.vehicle].collisionRadius ?? 1.3),
      false,
    );
  }
  assert.ok(p.z > 4 && p.z < other.z, 'leave the worksite and stop before the neighbour');
  assert.ok(Math.abs(p.speed) < 1, 'the neighbouring wall must actually stop the tractor');
});

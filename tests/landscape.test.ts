// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, terrainHeight } from '../src/shared/simulation.ts';
import { creatorBlocksSegment, defaultCreator } from '../src/shared/creator.ts';
import { landscapeSchema, landscapeRoads, scatterObjects } from '../src/shared/landscape.ts';
import { townRoads } from '../src/shared/town.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';
function setup() {
  const w = createWorld('land', 'Land', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.creator = defaultCreator();
  return { w, p };
}
test('landscape changes are authorized, bounded, atomic, portable and undoable', () => {
  const { w, p } = setup(),
    outsider = addPlayer(w, 'visitor', 'Visitor');
  const edit = landscapeSchema.parse({
    paths: [
      {
        id: 'lane',
        points: [
          { x: 10, z: 10 },
          { x: 40, z: 30 },
          { x: 80, z: 20 },
        ],
        width: 5,
      },
    ],
  });
  assert.throws(() => act(w, outsider.id, { type: 'landscape', landscape: edit }), /caretaker/i);
  act(w, p.id, { type: 'landscape', landscape: edit });
  w.creator!.roads = false;
  assert.deepEqual(townRoads(w), landscapeRoads(w));
  assert.ok(townRoads(w).length > 2, 'curved path is sampled consistently');
  const before = structuredClone(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'landscape',
        landscape: { ...edit, paths: [...edit.paths, ...edit.paths] },
      }),
    /Duplicate/,
  );
  assert.deepEqual(w, before);
  const restored = createWorld('copy', 'Copy', 'owner');
  applyDesign(restored, exportDesign(w));
  assert.deepEqual(restored.landscape, edit);
  act(w, p.id, { type: 'landscape', operation: 'undo' });
  assert.deepEqual(w.landscape, landscapeSchema.parse({}));
});
test('heightmaps share bilinear heights with water and subsequent terrain stamps', () => {
  const { w, p } = setup();
  const samples = Array.from({ length: 1089 }, (_, i) => (i % 33) - 16);
  act(w, p.id, { type: 'landscape', landscape: { heightmap: samples } });
  assert.equal(terrainHeight(w, 0, 0), 0);
  assert.equal(terrainHeight(w, 250, 250), 16);
  assert.equal(terrainHeight(w, -250, -250), -16);
  assert.equal(terrainHeight(w, 7.8125, 0), 0.5);
  act(w, p.id, { type: 'terrain', x: 0, z: 0, radius: 20, height: 3 });
  assert.equal(terrainHeight(w, 0, 0), 3);
});
test('fences block swept movement and projectiles but permit escape and flying over them', () => {
  const { w, p } = setup();
  act(w, p.id, {
    type: 'landscape',
    landscape: {
      barriers: [
        {
          id: 'fence',
          points: [
            { x: -10, z: 0 },
            { x: 10, z: 0 },
          ],
          height: 2,
          width: 0.3,
        },
      ],
    },
  });
  assert.ok(creatorBlocksSegment(w, { x: 0, z: -20, y: 1 }, { x: 0, z: 20, y: 1 }, 1));
  assert.ok(!creatorBlocksSegment(w, { x: 0, z: -20, y: 5 }, { x: 0, z: 20, y: 5 }, 1));
  assert.ok(!creatorBlocksSegment(w, { x: 0, z: 0, y: 1 }, { x: 0, z: 3, y: 1 }, 1, true));
});
test('scatter is deterministic, bounded, avoids roads/buildings/water, and requires a real model', () => {
  const { w, p } = setup();
  w.creator!.models.push({
    id: 'rock',
    name: 'Rock',
    width: 2,
    height: 2,
    depth: 2,
    parts: [{ shape: 'sphere', color: '#888888', x: 0, y: 1, z: 0, sx: 2, sy: 2, sz: 2, yaw: 0 }],
  });
  act(w, p.id, {
    type: 'landscape',
    landscape: {
      scatter: [
        {
          id: 'grove',
          model: 'rock',
          x: -180,
          z: -180,
          radius: 30,
          count: 10,
          seed: 42,
          solid: true,
        },
      ],
    },
  });
  const objects = scatterObjects(w);
  assert.equal(objects.length, 10);
  assert.deepEqual(scatterObjects(structuredClone(w)), objects);
  const object = objects[0];
  assert.ok(
    creatorBlocksSegment(
      w,
      { x: object.x, z: object.z, y: terrainHeight(w, object.x, object.z) + 1 },
      { x: object.x, z: object.z, y: terrainHeight(w, object.x, object.z) + 1 },
      0,
    ),
  );
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'landscape',
        landscape: { scatter: [{ ...w.landscape!.scatter[0], model: 'missing' }] },
      }),
    /model/i,
  );
});

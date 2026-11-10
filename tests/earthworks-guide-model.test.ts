// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { EarthworkGuide } from '../src/client/earthwork-guide';
import { terrainHeight } from '../src/shared/terrain';

test('the guide draws one terrain-following local work area and reuses it between updates', () => {
  const w = createWorld('guide', 'Guide', 'p');
  Object.assign(w, {
    buildings: [],
    towns: [],
    zones: [],
    terrain: [],
    roads: [],
    airfield: undefined,
    spaceportSite: undefined,
  });
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(10),
  };
  Object.assign(w.settings, {
    mapSize: 500,
    seaLevel: -40,
    spawnClearance: 0,
    townCentreClearance: 0,
  });
  const p = addPlayer(w, 'p', 'Operator');
  Object.assign(p, {
    x: 80,
    z: 80,
    y: 10,
    vehicle: 39,
    fleet: [5, 39],
    skills: ['plant operator'],
  });
  act(w, p.id, {
    type: 'earthwork',
    operation: 'confirm',
    x: 80,
    z: 80,
    width: 8,
    depth: 8,
    rotation: Math.PI / 4,
    shoulder: 12,
    target: 9,
  });
  const guide = new EarthworkGuide();
  guide.update(w, p);
  assert.equal(guide.group.visible, true);
  assert.equal(guide.group.children.length, 3);
  const line = guide.group.children[0] as import('three').Line;
  const geometry = line.geometry,
    positions = geometry.getAttribute('position');
  assert.ok(positions.count < 200, 'bounded geometry');
  for (let i = 0; i < positions.count; i++)
    assert.ok(positions.getY(i) >= terrainHeight(w, positions.getX(i), positions.getZ(i)));
  guide.update(w, { ...p, x: 81 });
  assert.equal((guide.group.children[0] as import('three').Line).geometry, geometry);
  const stranger = { ...p, id: 'stranger' };
  guide.update(w, stranger);
  assert.equal(guide.group.visible, false);
  guide.update(w, { ...p, vehicle: 5 });
  assert.equal(guide.group.visible, false);
  guide.update(w, { ...p, vehicle: 38 });
  assert.equal(guide.group.visible, true);
  w.earthworks = w.earthworks!.map((e) => ({ ...e, progress: 1 }));
  guide.update(w, p);
  assert.notEqual((guide.group.children[0] as import('three').Line).geometry, geometry);
  guide.dispose();
});

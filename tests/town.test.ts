// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, terrainHeight } from '../src/shared/simulation.ts';
import { blocksBuilding } from '../src/shared/building-shapes.ts';
import { legacyTown, migrateTown, townRoads, roadDistance } from '../src/shared/town.ts';
import { Store } from '../src/server/store.ts';

const area = (bs: { x: number; z: number }[]) =>
  (Math.max(...bs.map((b) => b.x)) - Math.min(...bs.map((b) => b.x))) *
  (Math.max(...bs.map((b) => b.z)) - Math.min(...bs.map((b) => b.z)));

test('expanded town occupies about eight times the area without enlarging buildings', () => {
  const w = createWorld('town', 'Town', 'owner');
  assert.ok(area(w.buildings) / area(legacyTown) > 7.8);
  assert.ok(area(w.buildings) / area(legacyTown) < 8.3);
  assert.equal(w.buildings.length, legacyTown.length);
  for (const b of w.buildings) {
    assert.ok(Math.abs(b.x) < 235 && b.z > -235 && b.z < 135);
    assert.ok(terrainHeight(w, b.x, b.z) > w.settings.seaLevel + 1);
    const approach = { x: b.x + Math.sin(b.rotation) * 13, z: b.z + Math.cos(b.rotation) * 13 };
    assert.ok(roadDistance(townRoads(w), approach.x, approach.z) < 2, b.kind + ' has road access');
  }
});
test('roads bend, connect to the village green and leave solid buildings and the pitch clear', () => {
  const w = createWorld('roads', 'Roads', 'owner'),
    roads = townRoads(w);
  assert.ok(
    roads.filter((r) => Math.abs(r.b.x - r.a.x) > 1 && Math.abs(r.b.z - r.a.z) > 1).length > 25,
  );
  for (const r of roads)
    for (let t = 0; t <= 1; t += 0.1) {
      const x = r.a.x + (r.b.x - r.a.x) * t,
        z = r.a.z + (r.b.z - r.a.z) * t;
      assert.ok(terrainHeight(w, x, z) > w.settings.seaLevel + 1);
      assert.ok(!(x > 59 && x < 121 && z > 19 && z < 71), 'pitch remains clear');
      for (const b of w.buildings.filter((b) => b.kind !== 'town'))
        assert.ok(!blocksBuilding(b, x, z, 0, r.width / 2), `${b.kind} blocks road at ${x},${z}`);
    }
  const reached = new Set([0]);
  for (let pass = 0; pass < roads.length; pass++)
    for (let i = 0; i < roads.length; i++) {
      if (
        [...reached].some((j) =>
          [roads[i].a, roads[i].b].some((a) =>
            [roads[j].a, roads[j].b].some((b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.01),
          ),
        )
      )
        reached.add(i);
    }
  assert.equal(reached.size, roads.length, 'every lane joins the same network');
});
test('saved starter lots expand once, preserving property, occupants and custom buildings', () => {
  const w = createWorld('old', 'Old', 'p');
  delete w.townLayout;
  w.buildings.forEach((b, i) => Object.assign(b, { x: legacyTown[i].x, z: legacyTown[i].z }));
  const p = addPlayer(w, 'p', 'Resident'),
    home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  home.stock = { bread: 41 };
  p.home = home.id;
  p.atHome = true;
  p.online = false;
  p.x = home.x;
  p.z = home.z + 12;
  const custom = makeBuilding('custom', 'home', 175, -175);
  custom.owner = p.id;
  w.buildings.push(custom);
  const original = structuredClone(custom);
  migrateTown(w);
  assert.equal(w.townLayout, 2);
  assert.equal(home.owner, p.id);
  assert.deepEqual(home.stock, { bread: 41 });
  assert.equal(p.atHome, true);
  assert.equal(p.x, home.x);
  assert.equal(p.z, home.z + 12);
  assert.deepEqual(custom, original);
  const once = JSON.stringify(w);
  migrateTown(w);
  assert.equal(JSON.stringify(w), once);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world, w);
  } finally {
    store.close();
  }
});
test('migration never overwrites edited lots or moves a starter building onto custom property', () => {
  const w = createWorld('edited', 'Edited', 'p'),
    planned = w.buildings.map((b) => ({ ...b }));
  delete w.townLayout;
  w.buildings.forEach((b, i) => Object.assign(b, { x: legacyTown[i].x, z: legacyTown[i].z }));
  w.buildings[0].x = 42;
  const custom = makeBuilding('custom', 'hotel', planned[1].x, planned[1].z);
  w.buildings.push(custom);
  migrateTown(w);
  assert.equal(w.buildings[0].x, 42);
  assert.equal(w.buildings[1].z, legacyTown[1].z);
  assert.equal(custom.x, planned[1].x);
});

test('loading an old SQLite world upgrades once and clears pilots parked on new lots', () => {
  const w = createWorld('sqlite-town', 'Old parish', 'p');
  const p = addPlayer(w, 'p', 'Parked');
  p.x = w.buildings[0].x;
  p.z = w.buildings[0].z;
  p.y = 0.15;
  delete w.townLayout;
  w.buildings.forEach((b, i) => Object.assign(b, { x: legacyTown[i].x, z: legacyTown[i].z }));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world,
      pilot = loaded.players.p;
    assert.equal(loaded.townLayout, 2);
    assert.ok(loaded.buildings.every((b) => !blocksBuilding(b, pilot.x, pilot.z, 0, 1.5)));
    assert.equal(pilot.cash, p.cash);
    store.saveWorld(loaded);
    assert.deepEqual(store.loadWorlds()[0].world, loaded);
  } finally {
    store.close();
  }
});

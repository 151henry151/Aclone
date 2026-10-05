// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, terrainHeight } from '../src/shared/simulation.ts';
import { mapHalf, legacyHalf, woodland } from '../src/shared/terrain.ts';
import { Store } from '../src/server/store.ts';

test('the wider countryside leaves the original village terrain untouched and joins it smoothly', () => {
  const big = createWorld('puddlewick', 'Puddlewick', 'server');
  const small = createWorld('village', 'Village', 'owner');
  small.settings.mapSize = 500;
  for (let x = -250; x <= 250; x += 25)
    for (let z = -250; z <= 250; z += 25)
      assert.equal(terrainHeight(big, x, z), terrainHeight(small, x, z), `${x},${z}`);
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, -1],
    [0.7, 0.7],
  ])
    for (let r = 200; r < 700; r += 2) {
      const a = terrainHeight(big, dx * r, dz * r),
        b = terrainHeight(big, dx * (r + 2), dz * (r + 2));
      assert.ok(Math.abs(a - b) < 2.5, `step of ${(a - b).toFixed(2)} m at ${r} along ${dx},${dz}`);
    }
});

test('the map edge is open sea, the interior is mostly land with real hills, and the harbour inlet reaches the sea', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const half = mapHalf(w),
    sea = w.settings.seaLevel;
  let land = 0,
    samples = 0,
    highest = -Infinity;
  for (let x = -half; x <= half; x += 125)
    for (let z = -half; z <= half; z += 125) {
      const h = terrainHeight(w, x, z);
      assert.ok(Number.isFinite(h));
      const edge = Math.max(Math.abs(x), Math.abs(z)) / half;
      if (edge >= 0.97) assert.ok(h < sea - 2, `sea at the edge ${x},${z}: ${h}`);
      if (edge <= 0.72) {
        samples++;
        if (h > sea + 1) land++;
        highest = Math.max(highest, h);
      }
    }
  assert.ok(land / samples > 0.75, `interior land share ${(land / samples).toFixed(2)}`);
  assert.ok(highest > 30, `tallest interior hill ${highest.toFixed(1)} m`);
  for (let z = 160; z <= half; z += 50)
    assert.ok(terrainHeight(w, 0, z) < sea - 1, `inlet at z=${z}`);
  assert.ok(terrainHeight(w, 3000, 300) > sea, 'land east of the inlet');
});

test('woodland density is deterministic, clear of the village and the sea, and forms real woods', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const half = mapHalf(w);
  let wooded = 0,
    samples = 0;
  for (let x = -half; x <= half; x += 100)
    for (let z = -half; z <= half; z += 100) {
      const d = woodland(w, x, z);
      assert.ok(d >= 0 && d <= 1);
      assert.equal(d, woodland(w, x, z));
      if (Math.max(Math.abs(x), Math.abs(z)) < 300)
        assert.equal(d, 0, `village stays open at ${x},${z}`);
      if (terrainHeight(w, x, z) < w.settings.seaLevel + 1) assert.equal(d, 0, `no trees in water`);
      if (Math.max(Math.abs(x), Math.abs(z)) < half * 0.7) {
        samples++;
        if (d > 0.6) wooded++;
      }
    }
  assert.ok(wooded / samples > 0.12 && wooded / samples < 0.6, `wooded share ${wooded / samples}`);
  const small = createWorld('arena', 'Arena', 'owner', 'combat');
  assert.equal(woodland(small, 200, 200), 0);
});

test('Puddlewick is 12.5 km square; arenas keep the compact 500 m footprint', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  assert.equal(w.settings.mapSize, 12500);
  assert.equal(mapHalf(w), 6250);
  assert.equal(legacyHalf, 250);
  for (const template of ['playground', 'combat', 'ctf', 'canvas'])
    assert.equal(createWorld(template, template, 'owner', template).settings.mapSize, 500);
});

test('saved worlds without a map size keep their old 500 m bounds, except the public Puddlewick', () => {
  const store = new Store(':memory:');
  try {
    const puddlewick = createWorld('puddlewick', 'Puddlewick', 'server');
    const other = createWorld('other', 'Other', 'owner');
    for (const w of [puddlewick, other]) {
      delete (w.settings as Partial<typeof w.settings>).mapSize;
      store.saveWorld(w);
    }
    const loaded = Object.fromEntries(store.loadWorlds().map(({ world }) => [world.id, world]));
    assert.equal(loaded.puddlewick.settings.mapSize, 12500);
    assert.equal(loaded.other.settings.mapSize, 500);
    other.settings.mapSize = 3000;
    store.saveWorld(other);
    assert.equal(
      store.loadWorlds().find(({ world }) => world.id === 'other')!.world.settings.mapSize,
      3000,
    );
  } finally {
    store.close();
  }
});

test('movement is clamped to the configured map, not the old 250 m square', () => {
  const w = createWorld('big', 'Big', 'owner');
  w.settings.mapSize = 12500;
  const p = addPlayer(w, 'p', 'Pilot');
  // The hovercraft crosses water, so this checks the boundary rather than the coastline.
  Object.assign(p, { x: 6240, z: 0, heading: Math.PI / 2, speed: 20, vehicle: 4 });
  for (let i = 0; i < 40; i++) move(w, p, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.ok(p.x > 250, 'travelled far beyond the old boundary');
  assert.ok(p.x <= 6250, 'stopped at the configured edge');
  const small = createWorld('small', 'Small', 'owner', 'playground');
  const q = addPlayer(small, 'q', 'Pilot');
  Object.assign(q, { x: 245, z: 0, heading: Math.PI / 2, speed: 20, vehicle: 4 });
  for (let i = 0; i < 40; i++) move(small, q, { throttle: 1, steer: 0, boost: false }, 0.1);
  assert.ok(q.x <= 250 && q.x > 240);
  assert.ok(Number.isFinite(terrainHeight(w, 6000, 6000)));
});

test('owners resize their world through settings within the supported range', () => {
  const w = createWorld('estate', 'Estate', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  act(w, p.id, { type: 'settings', patch: { mapSize: 3000 } });
  assert.equal(w.settings.mapSize, 3000);
  assert.equal(mapHalf(w), 1500);
  for (const bad of [100, 499, 20001, 2500.5, -1])
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { mapSize: bad } }));
  assert.equal(w.settings.mapSize, 3000);
});

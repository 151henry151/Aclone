// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, distance } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { Navigator } from '../src/server/npc/navigation';
import { trailerBlocks } from '../src/shared/trailers';

function setup(vehicle = 0) {
  const w = createWorld('trailer-route', 'Trailer routes', 'owner');
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.settings.seaLevel = -10;
  w.landscape = {
    heightmap: Array(1089).fill(0),
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
  };
  const p = addPlayer(w, 'npc', 'Traveller');
  Object.assign(p, { x: 0, z: -25, y: 0, heading: 0, speed: 0, vehicle, engine: true, fuel: 50 });
  w.trailers = {
    box: {
      id: 'box',
      kind: 'box',
      owner: 'owner',
      x: 0,
      z: 0,
      heading: Math.PI / 3,
      cargo: { wood: 2 },
    },
  };
  return { w, p, target: { x: 0, z: 25 } };
}

for (const vehicle of [0, 5])
  test(`vehicle ${vehicle} routes around a parked trailer using real movement`, () => {
    const { w, p, target } = setup(vehicle);
    const before = structuredClone(w.trailers);
    const nav = new Navigator(w, p, target, 2);
    let from = { x: p.x, z: p.z };
    for (const point of nav.waypoints()) {
      assert.equal(
        trailerBlocks(w, from, point, vehicle === 5 ? 0.25 : 1.3),
        false,
        'planned path must not lead straight through a parked trailer',
      );
      from = point;
    }
    let arrived = false;
    for (let i = 0; i < 3000; i++) {
      const old = { x: p.x, z: p.z };
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined);
      move(w, p, result.input, 0.05);
      assert.ok(distance(old, p) < 0.8, 'use ordinary movement without teleporting');
      if (result.arrived) {
        arrived = true;
        break;
      }
    }
    assert.ok(arrived, 'reach the other side without anyone moving the trailer');
    assert.deepEqual(w.trailers, before);
  });

test('a trailer parked across an existing route triggers deferred replanning within the shared budget', () => {
  const { w, p, target } = setup();
  const trailer = w.trailers!.box;
  w.trailers = {};
  const nav = new Navigator(w, p, target, 2);
  const original = structuredClone(nav.waypoints());
  w.trailers.box = trailer;
  assert.equal(
    nav.step(w, p, 0.05, { remainingMs: 0 }).input.throttle,
    0,
    'new obstacles must not be driven into while planning has no budget',
  );
  for (let i = 0; i < 1000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.error, undefined);
    if (nav.waypoints().length) break;
  }
  assert.notDeepEqual(nav.waypoints(), original);
});

test('an overlapped character can move outward but not deeper into a trailer', () => {
  const { w, p } = setup(5);
  w.trailers!.box.heading = 0;
  Object.assign(p, { x: 0.9, z: 0, heading: Math.PI / 2 });
  const old = { x: p.x, z: p.z };
  for (let i = 0; i < 40; i++) move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
  assert.ok(p.x > 2, 'escape outward from an existing overlap');
  assert.ok(trailerBlocks(w, { x: 3, z: 0 }, old, 0.25), 'outside entry remains solid');
});

test('an overlapped resident escapes by steering rather than moving the trailer', () => {
  const { w, p } = setup(5);
  Object.assign(p, { x: 0.9, z: 0 });
  w.trailers!.box.heading = 0;
  const original = structuredClone(w.trailers);
  const nav = new Navigator(w, p, { x: 12, z: 0 }, 2);
  let arrived = false;
  for (let i = 0; i < 1600; i++) {
    const r = nav.step(w, p, 0.05);
    assert.equal(r.error, undefined);
    move(w, p, r.input, 0.05);
    if (r.arrived) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
  assert.deepEqual(w.trailers, original);
  assert.equal(trailerBlocks(w, { x: 0.9, z: 0 }, { x: 0.8, z: 0 }, 0.25, undefined, true), true);
  assert.equal(trailerBlocks(w, { x: 0.9, z: 0 }, { x: 0.9, z: 0 }, 0.25, undefined, true), true);
});

test('moving, removing or storing trailers replans without rebuilding terrain', () => {
  const { w, p, target } = setup();
  const nav = new Navigator(w, p, target, 2);
  let reads = 0;
  const terrain = w.terrain;
  Object.defineProperty(w, 'terrain', {
    get() {
      reads++;
      return terrain;
    },
  });
  for (const change of [
    () => {
      w.trailers!.box.x = 15;
    },
    () => {
      w.trailers!.box.parkedWith = 'owner:0';
      w.parkedVehicles = {
        'owner:0': {
          owner: 'owner',
          slot: 0,
          x: 15,
          z: 0,
          y: 0,
          heading: 0,
          fuel: 0,
          condition: 100,
          parkedAt: 0,
          inside: 'garage',
        },
      };
    },
    () => {
      delete w.trailers!.box;
    },
  ]) {
    change();
    reads = 0;
    for (let i = 0; i < 1000; i++) {
      const result = nav.step(w, p, 0.05);
      assert.equal(result.error, undefined);
      if (nav.waypoints().length) break;
    }
    assert.ok(nav.waypoints().length);
    assert.ok(reads < 100, `reuse the terrain grid, got ${reads} terrain reads`);
  }
});

test('an inaccessible destination fails safely without moving or relocating obstacles', () => {
  const { w, p, target } = setup();
  Object.assign(w.trailers!.box, { x: target.x, z: target.z, heading: 0 });
  const nav = new Navigator(w, p, target, 1, true, true);
  const before = structuredClone(w.trailers);
  let failure;
  for (let i = 0; i < 2000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.input.throttle, 0);
    if (result.error) {
      failure = result.error;
      break;
    }
  }
  assert.match(failure ?? '', /No safe ground route/);
  assert.deepEqual(w.trailers, before);
  assert.deepEqual([p.x, p.z], [0, -25]);
});

test('garage-stored trailers do not divert a resident route', () => {
  const { w, p, target } = setup();
  w.trailers!.box.storedAt = 'garage';
  const stored = new Navigator(w, p, target, 2).waypoints();
  w.trailers = {};
  assert.deepEqual(stored, new Navigator(w, p, target, 2).waypoints());
});

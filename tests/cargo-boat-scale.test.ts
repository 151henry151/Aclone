// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, move } from '../src/shared/simulation';
import { boatLandings, landingBlocked, landingAccepts } from '../src/shared/boathouse';
import { quaySetup } from './freight-quay.test';
import { travelHeight } from '../src/shared/dock';
import { vehicleDef } from '../src/shared/vehicle-config';

function setup() {
  const { w, b } = quaySetup();
  Object.assign(w.settings, { requireCaptainSkill: false, vehicleLicences: false });
  const p = addPlayer(w, 'owner', 'Captain');
  const d = boatLandings(w, 35).find((d) => d.id === b.id)!;
  Object.assign(p, d.land, {
    vehicle: 5,
    y: travelHeight(w, d.land.x, d.land.z),
    fleet: [0, 5, 35],
    inventory: {},
    speed: 0,
  });
  return { w, b, p, d };
}

test('enlarged coaster uses an outside quay berth and preserves saved freight on reboarding', () => {
  const { w, b, p, d } = setup();
  const small = boatLandings(w, 33).find((d) => d.id === b.id)!;
  assert.ok(
    Math.hypot(d.berth.x - small.berth.x, d.berth.z - small.berth.z) > 4,
    'large beam must clear the existing quay without moving its structure',
  );
  assert.equal(landingAccepts(w, d, 35), true);
  act(w, p.id, { type: 'vehicle', slot: 35, building: b.id });
  p.boatHold = { stone: 123 };
  p.boatHoldBasis = { stone: 456 };
  act(w, p.id, { type: 'vehicle', slot: 5, building: b.id });
  assert.equal(w.mooredBoats![p.id + ':35'].cargo?.stone, 123);
  assert.deepEqual(w.mooredBoats![p.id + ':35'].cargoBasis, { stone: 456 });
  act(w, p.id, { type: 'vehicle', slot: 35, building: b.id });
  assert.equal(p.boatHold?.stone, 123);
  assert.deepEqual(p.boatHoldBasis, { stone: 456 });
  assert.equal(p.x, d.berth.x);
  assert.equal(p.z, d.berth.z);
  w.settings.quayMaxLength = 59;
  assert.equal(landingAccepts(w, d, 35), false, 'world quay length limit must be enforced');
  w.settings.quayMaxLength = 60;
  w.settings.quayMaxBeam = 16;
  assert.equal(landingAccepts(w, d, 35), false, 'world quay beam limit must be enforced');
});

test('boarding checks obstacles near the new bow, not only the old berth centre', () => {
  const { w, p, d } = setup();
  const obstacle = makeBuilding(
    'blocker',
    'home',
    d.berth.x + Math.sin(d.heading) * 25,
    d.berth.z + Math.cos(d.heading) * 25,
  );
  w.buildings.push(obstacle);
  assert.match(landingBlocked(w, d, p, true, 35) ?? '', /blocked|clear|occupied/i);
  const before = structuredClone(p);
  assert.throws(
    () => act(w, p.id, { type: 'vehicle', slot: 35, building: d.id }),
    /blocked|clear|occupied/i,
  );
  assert.deepEqual(p, before, 'a refused board cannot change fleet, cargo or cash');
});

test('cargo vessel draft is enforced by movement and remains world-configurable', () => {
  const w = createWorld('cargo-draft', 'Cargo draft', 'owner');
  w.buildings = [];
  w.terrain = [];
  w.zones = [];
  w.roads = [];
  Object.assign(w.settings, {
    seaLevel: 0,
    tidalRange: 0,
    oceanWaves: 0,
    vehicleLicences: false,
    requireCaptainSkill: false,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(-2),
  };
  const p = addPlayer(w, 'owner', 'Captain');
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 0,
    vehicle: 35,
    heading: 0,
    engine: true,
    fuel: 100,
    boatThrottle: 1,
    speed: 4,
  });
  move(w, p, { throttle: 0, steer: 0, boost: false }, 1);
  assert.equal(p.z, 0, 'a 3.75m keel cannot advance through 2m water');
  w.vehicleTuning = { 35: { draft: 1 } };
  Object.assign(p, { boatThrottle: 1, speed: 4 });
  delete p.boatShoreThrottle;
  move(w, p, { throttle: 0, steer: 0, boost: false }, 1);
  assert.ok(p.z > 1, 'a shallower authored keel may cross the same water');
  assert.equal(vehicleDef(w, 35).draft, 1);
});

test('public boatyard searches deeper outside water within the world limit', async () => {
  const { ensurePuddlewickBoatyard } = await import('../src/server/puddlewick-boatyard');
  const w = createWorld('puddlewick', 'Boatyard scale', 'owner');
  ensurePuddlewickBoatyard(w);
  Object.assign(w.settings, { requireCaptainSkill: false, vehicleLicences: false });
  const p = addPlayer(w, 'owner', 'Captain');
  const d = boatLandings(w, 35).find((d) => d.building)!;
  Object.assign(p, d.land, {
    vehicle: 5,
    y: travelHeight(w, d.land.x, d.land.z),
    fleet: [0, 5, 35],
    inventory: {},
    speed: 0,
  });
  assert.equal(
    landingBlocked(w, d, p, true, 35),
    undefined,
    'public berth must reach deep water without editing the island',
  );
  w.settings.boatBerthSearchDistance = 0;
  const restricted = boatLandings(w, 35).find((candidate) => candidate.id === d.id)!;
  assert.match(landingBlocked(w, restricted, p, true, 35) ?? '', /deeper|clear/i);
});

test('a shallow quay refuses the new keel without consuming cargo or money', () => {
  const { w, p, d } = setup();
  w.settings.boatBerthSearchDistance = 0;
  w.landscape!.heightmap = w.landscape!.heightmap!.map((n) => (n < 0 ? -2 : n));
  assert.match(landingBlocked(w, d, p, true, 35) ?? '', /deeper|clear/i);
  assert.equal(p.vehicle, 5);
  assert.deepEqual(p.inventory, {});
});

test('crew stand on the enlarged side deck rather than inside the hold', async () => {
  const { advance } = await import('../src/shared/simulation');
  const { w, p, d } = setup();
  act(w, p.id, { type: 'vehicle', slot: 35, building: d.id });
  const crew = addPlayer(w, 'crew', 'Crew');
  crew.hitch = p.id;
  advance(w, 1);
  const v = vehicleDef(w, 35),
    dx = crew.x - p.x,
    dz = crew.z - p.z;
  const sideways = dx * Math.cos(p.heading) - dz * Math.sin(p.heading);
  assert.ok(
    Math.abs(sideways) > v.beam! * 0.35 && Math.abs(sideways) < v.beam! / 2,
    'crew must stand on a side walkway',
  );
  assert.ok(crew.y >= p.y + v.freeboard!, 'crew feet must be above the deck');
});

test('loading an old moored coaster shifts only its clear berth and preserves the hold', async () => {
  const { Store } = await import('../src/server/store');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'coaster-scale-'));
  const { w, p, d } = setup();
  const old = boatLandings(w).find((q) => q.id === d.id)!;
  w.mooredBoats = {
    [p.id + ':35']: {
      owner: p.id,
      slot: 35,
      ...old.berth,
      heading: old.heading,
      paint: 'blue',
      landing: d.id,
      cargo: { stone: 123 },
      cargoBasis: { stone: 456 },
    },
  };
  const store = new Store(join(dir, 'world.sqlite'));
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const boat = loaded.mooredBoats![p.id + ':35'];
    assert.equal(boat.x, d.berth.x);
    assert.equal(boat.z, d.berth.z);
    assert.deepEqual(boat.cargo, { stone: 123 });
    assert.deepEqual(boat.cargoBasis, { stone: 456 });
    assert.deepEqual(loaded.players[p.id].fleet, p.fleet);
    Object.assign(p, d.berth, { vehicle: 33, online: true, heading: d.heading });
    store.saveWorld(w);
    const occupied = store.loadWorlds()[0].world.mooredBoats![p.id + ':35'];
    assert.equal(
      occupied.x,
      old.berth.x,
      'do not move a moored hull through its owner in another boat',
    );
    assert.equal(occupied.z, old.berth.z);
    assert.deepEqual(occupied.cargo, { stone: 123 });
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

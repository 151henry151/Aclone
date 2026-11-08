// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { addPlayer, move, act } from '../src/shared/simulation';
import { travelHeight } from '../src/shared/dock';
import { terrainHeight } from '../src/shared/terrain';
import { inlandBlocksGround } from '../src/shared/inland-travel';
import { trailerDefs } from '../src/shared/trailers';
import { bridgeGroundBlocked, bridgeDeckHeight } from '../src/shared/bridge-geometry';

test('only finished decks support a river crossing and saved dimensions survive rule edits', () => {
  const { w, bridge, point } = completedBridgeSite(),
    centre = point(0);
  assert.equal(travelHeight(w, centre.x, centre.z), bridge.deckY);
  assert.equal(inlandBlocksGround(w, bridge.a, bridge.b, 1.3), false);
  const saved = travelHeight(w, point(-40).x, point(-40).z);
  w.settings.bridgeMaximumGrade = 0.2;
  w.settings.bridgeClearance = 20;
  assert.equal(travelHeight(w, point(-40).x, point(-40).z), saved);
  delete bridge.completedAt;
  assert.equal(travelHeight(w, centre.x, centre.z), terrainHeight(w, centre.x, centre.z));
  assert.equal(inlandBlocksGround(w, bridge.a, bridge.b, 1.3), true);
});

test('a loaded tractor and articulated trailer drive across the real elevated deck, reverse and stop', () => {
  const { w, bridge } = completedBridgeSite();
  const p = addPlayer(w, 'driver', 'Driver'),
    dx = bridge.b.x - bridge.a.x,
    dz = bridge.b.z - bridge.a.z,
    length = Math.hypot(dx, dz);
  const heading = Math.atan2(dx, dz),
    ux = dx / length,
    uz = dz / length;
  Object.assign(p, {
    x: bridge.approachA.x - ux * 10,
    z: bridge.approachA.z - uz * 10,
    heading,
    vehicle: 0,
    speed: 0,
    fuel: 65000,
    inventory: { steel: 10 },
  });
  p.y = travelHeight(w, p.x, p.z);
  const drawbar = trailerDefs.dump.length / 2 + 1.4 + 2.7;
  const t = {
    id: 'loaded-rig',
    owner: p.id,
    attached: p.id,
    kind: 'dump' as const,
    x: p.x - ux * drawbar,
    z: p.z - uz * drawbar,
    heading,
    cargo: { stone: 100 },
  };
  w.trailers = { [t.id]: t };
  let crossed = false;
  for (let i = 0; i < 1600; i++) {
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    assert.ok(Number.isFinite(p.y));
    if (bridgeDeckHeight(w, p.x, p.z) !== undefined)
      assert.ok(Math.abs(p.y - travelHeight(w, p.x, p.z)) < 0.3);
    if ((p.x - bridge.approachB.x) * ux + (p.z - bridge.approachB.z) * uz > drawbar + 4) {
      crossed = true;
      break;
    }
  }
  assert.ok(crossed, `rig must cross; ended at ${p.x},${p.z}`);
  assert.deepEqual(t.cargo, { stone: 100 });
  for (let i = 0; i < 100; i++)
    move(w, p, { throttle: 0, steer: 0, boost: false, brake: true }, 0.05);
  const stopped = { x: p.x, z: p.z };
  assert.ok(Math.abs(p.speed) < 0.1);
  for (let i = 0; i < 60; i++) move(w, p, { throttle: -1, steer: 0, boost: false }, 0.05);
  assert.ok((p.x - stopped.x) * ux + (p.z - stopped.z) * uz < -1, 'reverse the full rig');
});

test('continuous bridge rails stop side entry, sideways exit and a long vehicle tunnelling across', () => {
  const { w, point } = completedBridgeSite();
  const p = addPlayer(w, 'driver', 'Driver');
  const heading = Math.atan2(point(20).x - point(0).x, point(20).z - point(0).z);
  Object.assign(p, point(0), { heading, vehicle: 0 });
  assert.ok(bridgeGroundBlocked(w, p, point(0, 20)));
  Object.assign(p, point(0, -20));
  assert.ok(bridgeGroundBlocked(w, p, point(0, 20)), 'sweep detects intervening deck');
});

test('pay explicitly before entry; a changed access rule never locks an occupant mid-span', () => {
  const { w, bridge, point } = completedBridgeSite(),
    p = addPlayer(w, 'driver', 'Driver');
  Object.assign(p, bridge.approachA, {
    x: bridge.approachA.x - ((bridge.b.x - bridge.a.x) / 40) * 5,
    z: bridge.approachA.z - ((bridge.b.z - bridge.a.z) / 40) * 5,
    vehicle: 5,
    cash: 1000,
    heading: Math.atan2(bridge.b.x - bridge.a.x, bridge.b.z - bridge.a.z),
  });
  w.settings.bridgeToll = 300;
  assert.ok(bridgeGroundBlocked(w, p, point(-40)));
  assert.equal(p.cash, 1000, 'movement never charges money');
  act(w, p.id, { type: 'bridge', op: 'passage', bridge: bridge.id });
  assert.equal(p.cash, 700);
  assert.equal(bridgeGroundBlocked(w, p, point(-40)), false);
  assert.throws(
    () => act(w, p.id, { type: 'bridge', op: 'passage', bridge: bridge.id }),
    /already/i,
  );
  Object.assign(p, point(0));
  p.bridgePasses![bridge.id].entered = true;
  w.settings.bridgePublicAccess = false;
  bridge.condition = 0;
  assert.equal(bridgeGroundBlocked(w, p, point(45)), false);
  assert.equal(bridgeGroundBlocked(w, p, point(-45)), false);
});

test('the rendered wheel-contact surface follows the bridge instead of the riverbed', async () => {
  const { snowTrackHeight } = await import('../src/client/snow-surface');
  const { w, bridge, point } = completedBridgeSite(),
    q = point(0);
  assert.equal(snowTrackHeight({ ...w, climate: undefined })(q.x, q.z), bridge.deckY);
});

test('a motorboat sails underneath; excessive configured air draft stops it before the deck', () => {
  for (const airDraft of [2, 30]) {
    const { w, bridge, point } = completedBridgeSite(),
      p = addPlayer(w, 'captain', 'Captain');
    p.authority = 20;
    act(w, 'captain', { type: 'vehicleTuning', slot: 33, airDraft });
    Object.assign(p, point(0, -15), {
      authority: 20,
      vehicle: 33,
      heading: Math.atan2(point(0, 15).x - point(0, -15).x, point(0, 15).z - point(0, -15).z),
      speed: 0,
      fuel: 100,
      engine: true,
    });
    // Vehicle catalogue editing is owner-authorized; ordinary movement has no elevated access.
    p.authority = 0;
    let wentUnder = false;
    for (let i = 0; i < 140; i++) {
      move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
      if (Math.hypot(p.x - point(0).x, p.z - point(0).z) < 2) wentUnder = true;
    }
    assert.equal(wentUnder, airDraft < bridge.deckY - bridge.thickness - bridge.highWater);
    assert.equal(
      p.bridgePasses?.[bridge.id],
      undefined,
      'boat passage does not grant a road toll pass',
    );
  }
});

test('boat clearance includes the physical deck beneath the outside rails', async () => {
  const { bridgeWaterClearance } = await import('../src/shared/bridge-geometry');
  const { w, bridge, point } = completedBridgeSite(),
    q = point(0, bridge.width / 2 + 0.1);
  assert.equal(
    bridgeWaterClearance(w, q.x, q.z, bridge.highWater),
    bridge.deckY - bridge.thickness - bridge.highWater,
  );
});

test('death removes a private passage and survey without erasing the shared bridge investment', async () => {
  const { advance } = await import('../src/shared/simulation');
  const { w, bridge } = completedBridgeSite(),
    p = addPlayer(w, 'owner', 'Builder');
  p.bridgePasses = { [bridge.id]: { entered: true } };
  p.bridgeSurvey = { id: 'old', status: 'pending' };
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.equal(p.deaths, 1);
  assert.equal(p.bridgePasses, undefined);
  assert.equal(p.bridgeSurvey, undefined);
  assert.equal(w.bridges![0], bridge);
  assert.deepEqual(bridge.paid, bridge.bill);
});

test('a remote bridge does not subdivide a long road query across the whole world', async () => {
  const { bridgeRectBlocked } = await import('../src/shared/bridge-geometry');
  const { w, point } = completedBridgeSite();
  let reads = 0;
  const axes = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
  ];
  const from = {
    ...point(-10000, 20000),
    hx: 2.5,
    hz: 0.001,
    get axes() {
      reads++;
      return axes;
    },
  };
  assert.equal(bridgeRectBlocked(w, from, { ...from, ...point(10000, 20000) }), false);
  assert.ok(reads < 100, `remote sweep inspected its axes ${reads} times`);
  assert.equal(
    bridgeRectBlocked(w, { ...from, ...point(0, -10000) }, { ...from, ...point(0, 10000) }),
    true,
    'a long sweep through the nearby rails still stops',
  );
});

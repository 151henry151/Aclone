// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
const drive = { throttle: 1, steer: 0, boost: false };
function setup() {
  const w = createWorld('contacts', 'Contacts', 'p');
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  Object.assign(w.settings, { mapSize: 2000, seaLevel: -10, vehicleMaintenance: true });
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  w.vehicleTuning = { 0: { length: 4, width: 2 } as any };
  const p = addPlayer(w, 'p', 'Driver'),
    q = addPlayer(w, 'q', 'Neighbour');
  for (const a of [p, q])
    Object.assign(a, {
      x: 300,
      z: 300,
      y: 0,
      heading: 0,
      speed: 0,
      engine: true,
      online: true,
      fuel: 64,
      fleetState: { 0: { acquiredAt: 0, metres: 0, condition: 100 } },
    });
  q.z = 305;
  p.speed = 10;
  return { w, p, q };
}
for (const speed of [0, 2])
  test(`rear-end stops entrant, leaving the ${speed ? 'slower' : 'stationary'} vehicle untouched`, () => {
    const { w, p, q } = setup();
    q.speed = speed;
    const other = structuredClone(q),
      fuel = p.fuel,
      health = p.health,
      condition = structuredClone(p.fleetState);
    move(w, p, drive, 0.5);
    assert.equal(p.speed, 0);
    assert.deepEqual(q, other);
    assert.equal(p.fuel, fuel);
    assert.equal(p.health, health);
    assert.deepEqual(p.fleetState, condition);
    assert.ok(p.z < q.z - 4);
  });
test('head-on contact stops both without pushing, damage or snapshot mutation during prediction', () => {
  const { w, p, q } = setup();
  q.heading = Math.PI;
  q.speed = 6;
  const other = structuredClone(q),
    predicted = structuredClone(p);
  move(w, predicted, drive, 0.5, true);
  assert.equal(predicted.speed, 0);
  assert.deepEqual(q, other);
  move(w, p, drive, 0.5);
  assert.equal(p.speed, 0);
  assert.equal(q.speed, 0);
  assert.deepEqual({ ...q, speed: other.speed }, other);
});
test('glancing contact follows the hull and reduces speed while stop-only mode stops', () => {
  for (const mode of ['glancing', 'stop-only']) {
    const { w, p, q } = setup();
    (w.settings as any).vehicleCollision = mode;
    Object.assign(p, { x: 302.2, z: 301, heading: -Math.PI / 18, speed: 8 });
    const other = structuredClone(q),
      start = { x: p.x, z: p.z };
    move(w, p, drive, 0.3);
    assert.deepEqual(q, other);
    if (mode === 'glancing') {
      assert.ok(p.speed > 0 && p.speed < 8);
      assert.ok(p.z > start.z);
      assert.ok(p.x >= 302 - 1e-6);
    } else assert.equal(p.speed, 0);
  }
});
test('rotated hulls and reverse motion use the configured footprint', () => {
  const { w, p, q } = setup();
  q.heading = Math.PI / 2;
  Object.assign(p, { x: 295, z: 305, heading: -Math.PI / 2, speed: -5 });
  move(w, p, { ...drive, throttle: -1 }, 0.6);
  assert.equal(p.speed, 0);
  assert.ok(p.x < q.x - 3);
});
test('pedestrians and tractors block one another, with separate pedestrian and off switches', () => {
  for (const walker of ['p', 'q'])
    for (const enabled of [true, false]) {
      const { w, p, q } = setup();
      (w.settings as any).pedestrianBlocking = enabled;
      if (walker === 'p') {
        p.vehicle = 5;
        p.z = 302.5;
        p.speed = 4;
      } else {
        q.vehicle = 5;
        p.z = 301;
      }
      const from = p.z,
        other = structuredClone(q);
      move(w, p, drive, 0.5);
      assert.deepEqual(q, other);
      if (enabled) {
        assert.equal(p.speed, 0);
        assert.ok(p.z < q.z - 0.25);
      } else assert.ok(p.z > from);
    }
  const { w, p, q } = setup();
  (w.settings as any).vehicleCollision = 'off';
  move(w, p, drive, 0.5);
  assert.ok(p.z > q.z - 4);
});
test('offline obstacles expire, home occupants do not block and zero timeout ignores sign-offs', () => {
  for (const state of ['recent', 'expired', 'zero', 'home']) {
    const { w, p, q } = setup();
    w.time = 100;
    q.online = false;
    q.lastSeen = state === 'recent' ? 99 : 0;
    if (state === 'zero') {
      q.lastSeen = 100;
      (w.settings as any).offlineVehicleObstacleSeconds = 0;
    }
    if (state === 'home') {
      q.online = true;
      q.atHome = true;
    }
    const from = p.z;
    move(w, p, drive, 0.5);
    if (state === 'recent') assert.equal(p.speed, 0);
    else assert.ok(p.z > from);
  }
});
test('explicit parking is refused in arrival clearances without moving the driver', () => {
  const { w, p } = setup();
  Object.assign(p, { x: w.settings.respawnX, z: w.settings.respawnZ, speed: 0 });
  const before = structuredClone(p);
  assert.throws(() => act(w, p.id, { type: 'engine' }), /clear|park|arrival|route/i);
  assert.deepEqual(p, before);
});

test('grounded aircraft contact stops harmlessly while airborne aircraft and boats are not land obstacles', () => {
  const { w, p, q } = setup();
  Object.assign(p, { vehicle: 2, fleet: [0, 2, 5], speed: 10, z: 300 });
  const fuel = p.fuel,
    health = p.health;
  move(w, p, drive, 0.5);
  assert.equal(p.speed, 0);
  assert.equal(p.vehicle, 2);
  assert.equal(p.fuel, fuel);
  assert.equal(p.health, health);
  assert.ok(p.z < q.z - 2);
  for (const target of ['air', 'boat']) {
    const { w, p, q } = setup();
    Object.assign(q, target === 'air' ? { vehicle: 2, y: 50 } : { vehicle: 3 });
    move(w, p, drive, 0.5);
    assert.ok(p.z > q.z - 4);
  }
});

test('route parking protection covers the spaceport gate and public jetty and is configurable', async () => {
  const { spaceportPoint } = await import('../src/shared/spaceport-site');
  const { fishingDock, travelHeight } = await import('../src/shared/dock');
  for (const where of ['gate', 'jetty']) {
    const { w, p } = setup();
    w.spaceportSite = { x: 0, z: 400, height: 0, building: 'port', exclusion: 80, fence: 100 };
    const at = where === 'gate' ? spaceportPoint(w.spaceportSite, 0, 100) : fishingDock;
    Object.assign(p, { x: at.x, z: at.z }, { y: travelHeight(w, at.x, at.z), speed: 0 });
    assert.throws(() => act(w, p.id, { type: 'engine' }), /clear|park|route/i);
    assert.equal(p.engine, true);
    act(w, p.id, { type: 'settings', patch: { clearRouteParking: false } });
    act(w, p.id, { type: 'engine' });
    assert.equal(p.engine, false);
  }
});

test('adding land footprint dimensions preserves existing hovercraft helm eligibility', async () => {
  const { needsCaptain } = await import('../src/shared/captain');
  const { vehicles } = await import('../src/shared/catalog');
  const { w } = setup();
  w.settings.requireCaptainSkill = true;
  for (const [slot, v] of vehicles.entries())
    if (v.mode === 5) assert.equal(needsCaptain(w, slot), false);
});

test('zero glancing speed stops contact without advancing the vehicle', () => {
  const { w, p } = setup();
  w.settings.vehicleGlancingSpeed = 0;
  Object.assign(p, { x: 302.2, z: 301, heading: -Math.PI / 18, speed: 8 });
  const before = { x: p.x, z: p.z, fuel: p.fuel };
  move(w, p, drive, 0.3);
  assert.equal(p.speed, 0);
  assert.deepEqual({ x: p.x, z: p.z, fuel: p.fuel }, before);
});

test('glancing along another hull cannot redirect a vehicle through a solid trunk', async () => {
  const { w, p, q } = setup();
  w.creator!.scenery = true;
  const { sceneryChunk } = await import('../src/shared/scenery-obstacles');
  const { sceneryContact, playerContact } = await import('../src/shared/ground-contacts');
  const tree = sceneryChunk(w, 1, 1).find((o) => o.kind === 'tree')!;
  assert.ok(tree);
  Object.assign(p, {
    x: tree.x - tree.radius - 1.24 - 0.01,
    z: tree.z - 2.36,
    heading: -Math.PI / 18,
    speed: 8,
  });
  Object.assign(q, { x: p.x - 2.2, z: p.z + 4 });
  const to = { x: p.x + Math.sin(p.heading) * 2.4, z: p.z + Math.cos(p.heading) * 2.4 };
  assert.equal(sceneryContact(w, { ...p }, to).stopped, false, 'original path clears the trunk');
  const glance = playerContact(w, { ...p }, to, true);
  assert.equal(glance.stopped, false, 'contact would normally slide');
  assert.equal(
    sceneryContact(w, { ...p }, glance.point).stopped,
    true,
    'redirected path meets the trunk',
  );
  const before = { x: p.x, z: p.z, fuel: p.fuel, health: p.health };
  move(w, p, drive, 0.3);
  assert.equal(p.speed, 0);
  assert.deepEqual({ x: p.x, z: p.z, fuel: p.fuel, health: p.health }, before);
});

test('snapshots retain a visible, private-data-free offline obstacle until its configured expiry', async () => {
  const { prepareFrame } = await import('../src/server/snapshots');
  const { w, p, q } = setup();
  w.time = 100;
  q.online = false;
  q.lastSeen = 99;
  q.inventory.gold = 12345;
  const frame = prepareFrame(w);
  assert.ok(frame.players[q.id], 'a still-solid signed-off vehicle must remain visible');
  const remote = JSON.parse(frame.players[q.id]);
  assert.equal(remote.online, false);
  assert.equal(remote.lastSeen, 99);
  assert.equal(remote.inventory, undefined);
  assert.equal(remote.cash, undefined);
  const prediction = structuredClone(w);
  prediction.players = { [p.id]: structuredClone(p), [q.id]: remote };
  move(prediction, prediction.players[p.id], drive, 0.5, true);
  assert.equal(prediction.players[p.id].speed, 0);
  w.time = 159;
  assert.equal(prepareFrame(w).players[q.id], undefined);
  w.time = 100;
  w.settings.offlineVehicleObstacleSeconds = 0;
  assert.equal(prepareFrame(w).players[q.id], undefined);
});

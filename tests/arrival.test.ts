import type { Player } from '../src/shared/types';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, advance, move } from '../src/shared/simulation';
function setup() {
  const w = createWorld('arrival', 'Arrival', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('shop', 'market', 0, -12);
  w.buildings = [b];
  Object.assign(w.settings, {
    vehiclesPersist: true,
    arrivalAnimation: 'full',
    hungerRate: 0,
    thirstRate: 0,
  });
  Object.assign(p, { x: 0, z: 0, y: 0, speed: 0, online: true, fuel: 31, fuelVehicle: 0 });
  return { w, p, b };
}
test('approach parks, immobilises and enters only after the authoritative walk completes', () => {
  const { w, p, b } = setup();
  act(w, p.id, { type: 'approach', building: b.id });
  assert.equal(p.task?.kind, 'entering');
  assert.equal(p.vehicle, 5);
  assert.ok(w.parkedVehicles?.['owner:0']);
  assert.equal((p as any).inside, undefined);
  const before = [p.x, p.y, p.z];
  move(w, p, { throttle: 1, steer: 0, boost: true }, 1);
  assert.deepEqual([p.x, p.y, p.z], before);
  const duration = p.task!.end - w.time;
  assert.ok(duration >= 2 && duration <= 4);
  advance(w, duration - 0.01);
  assert.equal((p as any).inside, undefined);
  advance(w, 0.01);
  assert.equal((p as any).inside, b.id);
  assert.equal(p.task, undefined);
  assert.equal(p.atHome, false, 'visiting a shop does not supply home food or shelter');
  act(w, p.id, { type: 'exitBuilding' });
  assert.equal((p as Player).task?.kind, 'exiting');
  assert.equal((p as any).inside, undefined);
  advance(w, (p as Player).task!.end - w.time);
  assert.equal(p.task, undefined);
  assert.equal(p.vehicle, 5);
});
test('range, existing activities and missing destination refusals are atomic; cancelling reverses entry', () => {
  const { w, p, b } = setup();
  for (const mutate of [
    () => {
      p.x = 40;
    },
    () => {
      p.x = 0;
      p.task = { kind: 'labour', end: w.time + 10 };
    },
    () => {
      delete p.task;
      w.buildings = [];
    },
  ]) {
    mutate();
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'approach', building: b.id }));
    assert.equal(JSON.stringify(w), before);
  }
  w.buildings = [b];
  act(w, p.id, { type: 'approach', building: b.id });
  advance(w, 0.5);
  act(w, p.id, { type: 'exitBuilding' });
  assert.equal((p as Player).task?.kind, 'exiting');
  advance(w, (p as Player).task!.end - w.time);
  assert.equal((p as any).inside, undefined);
});
test('quick and off modes, changed ranges and home departure use their canonical rules', () => {
  for (const mode of ['quick', 'off']) {
    const { w, p, b } = setup();
    Object.assign(w.settings, {
      arrivalAnimation: mode,
      arrivalQuickSeconds: 1.5,
      arrivalRange: 20,
    });
    b.kind = 'home';
    b.owner = p.id;
    p.x = 0;
    p.z = 7;
    act(w, p.id, { type: 'approach', building: b.id });
    if (mode === 'quick') {
      assert.equal(p.task!.end - w.time, 1.5);
      advance(w, 1.5);
    }
    assert.equal((p as any).inside, b.id);
  }
  const { w, p, b } = setup();
  b.kind = 'home';
  b.owner = p.id;
  act(w, p.id, { type: 'home', building: b.id });
  assert.equal(p.atHome, false);
  advance(w, (p as Player).task!.end - w.time);
  assert.equal(p.atHome, true);
  act(w, p.id, { type: 'outside', depart: 'tractor' });
  assert.equal(p.vehicle, 5);
  advance(w, (p as Player).task!.end - w.time);
  assert.equal(p.vehicle, 0);
  assert.equal(p.fuel, 31);
  assert.equal(p.atHome, false);
});

test('home tractor departure refuses a missing target before leaving and safely handles a lost target during exit', () => {
  const { w, p, b } = setup();
  b.kind = 'home';
  b.owner = p.id;
  act(w, p.id, { type: 'home', building: b.id });
  advance(w, p.task!.end - w.time);
  const vehicle = w.parkedVehicles!['owner:0'];
  delete w.parkedVehicles!['owner:0'];
  const before = JSON.stringify(p);
  assert.throws(() => act(w, p.id, { type: 'outside', depart: 'tractor' }), /tractor|vehicle/);
  assert.equal(JSON.stringify(p), before);
  w.parkedVehicles!['owner:0'] = vehicle;
  act(w, p.id, { type: 'outside', depart: 'tractor' });
  delete w.parkedVehicles!['owner:0'];
  assert.doesNotThrow(() => advance(w, p.task!.end - w.time));
  assert.equal(p.vehicle, 5);
  assert.equal(p.atHome, false);
  assert.equal(p.task, undefined);
  assert.ok(w.messages.some((m) => m.to === p.id && /tractor|vehicle/.test(m.text)));
});

test('approach cannot teleport a boat or airborne aircraft into a building', () => {
  for (const slot of [3, 2]) {
    const { w, p, b } = setup();
    p.vehicle = slot;
    p.fuelVehicle = slot;
    if (slot === 2) {
      p.y = 100;
      p.flight = { grounded: false } as any;
    }
    const before = JSON.stringify(w);
    assert.throws(
      () => act(w, p.id, { type: 'approach', building: b.id }),
      /disembark|land|ground/i,
    );
    assert.equal(JSON.stringify(w), before);
  }
});

test('the person crosses only while the arrival door is open', async () => {
  const arrival = await import('../src/shared/arrival');
  const { w, p, b } = setup();
  act(w, p.id, { type: 'approach', building: b.id });
  const a = p.task!.arrival!;
  assert.equal(
    (arrival as any).arrivalVisible(p, a.end - 0.01),
    false,
    'person is inside while the door closes',
  );
  advance(w, a.end - w.time);
  act(w, p.id, { type: 'exitBuilding' });
  const exit = p.task!.arrival!;
  assert.equal(
    (arrival as any).arrivalVisible(p, exit.start + 0.01),
    false,
    'stay behind the closed door until it opens',
  );
  assert.equal(
    (arrival as any).arrivalVisible(p, exit.start + (exit.end - exit.start) * 0.5),
    true,
  );
});

test('moving pedestrians can enter without waiting, across animation modes and legacy settings', () => {
  for (const mode of ['full', 'quick', 'off'] as const) {
    for (const speed of [1.5, 5, -2]) {
      const { w, p, b } = setup();
      w.settings.arrivalAnimation = mode;
      delete w.settings.arrivalWalkIn;
      Object.assign(p, { vehicle: 5, speed });
      const from = { x: p.x, y: p.y, z: p.z };
      act(w, p.id, { type: 'approach', building: b.id });
      assert.equal(p.speed, 0);
      if (mode !== 'off') {
        assert.equal(p.task?.kind, 'entering');
        assert.deepEqual(p.task!.arrival!.from, from);
        move(w, p, { throttle: 1, steer: 1, boost: true }, 0.2);
        assert.equal(p.speed, 0);
        assert.deepEqual({ x: p.x, y: p.y, z: p.z }, from);
        advance(w, p.task!.end - w.time);
      }
      assert.equal(p.inside, b.id);
    }
  }
  const { w, p, b } = setup();
  b.kind = 'home';
  b.owner = p.id;
  Object.assign(p, { vehicle: 5, speed: 4 });
  act(w, p.id, { type: 'home', building: b.id });
  assert.equal(p.speed, 0);
  advance(w, p.task!.end - w.time);
  assert.equal(p.atHome, true);
});

test('walk-in opt-out and vehicle speeds retain stop checks without changing refused state', () => {
  for (const vehicle of [0, 5]) {
    const { w, p, b } = setup();
    w.settings.arrivalWalkIn = vehicle !== 5;
    Object.assign(p, { vehicle, speed: 2 });
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'approach', building: b.id }), /Stop outside/);
    assert.equal(JSON.stringify(w), before);
    p.speed = 0;
    act(w, p.id, { type: 'approach', building: b.id });
    assert.equal(p.task?.kind, 'entering');
  }
});

test('moving pedestrians still respect activities, range and construction atomically', () => {
  for (const block of ['task', 'game', 'hitch', 'inside', 'home', 'range', 'construction']) {
    const { w, p, b } = setup();
    Object.assign(p, { vehicle: 5, speed: 4 });
    if (block === 'task') p.task = { kind: 'labour', end: w.time + 20 };
    if (block === 'game') p.game = 'combat';
    if (block === 'hitch') p.hitch = 'other-player';
    if (block === 'inside') p.inside = 'other-building';
    if (block === 'home') p.atHome = true;
    if (block === 'range') p.x = 100;
    if (block === 'construction') b.construction = { required: {}, supplied: {} } as any;
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'approach', building: b.id }));
    assert.equal(JSON.stringify(w), before);
  }
});

test('exit preserves the last animated direction instead of turning back toward the door', async () => {
  const { arrivalPosition } = await import('../src/shared/arrival');
  for (const rotation of [0, 0.7, Math.PI, -1.3]) {
    const { w, p, b } = setup();
    b.rotation = rotation;
    p.vehicle = 5;
    act(w, p.id, { type: 'approach', building: b.id });
    advance(w, p.task!.end - w.time);
    act(w, p.id, { type: 'exitBuilding' });
    const a = p.task!.arrival!;
    const before = arrivalPosition(p, a.end - 0.01);
    const expected = Math.atan2(a.to.x - before.x, a.to.z - before.z);
    advance(w, a.end - w.time);
    assert.ok(
      Math.abs(Math.atan2(Math.sin(p.heading - expected), Math.cos(p.heading - expected))) < 1e-8,
      `exit facing ${p.heading} must match animated direction ${expected}`,
    );
  }
});

test('rear and side approaches go around the rotated solid building footprint', async () => {
  const { arrivalPosition } = await import('../src/shared/arrival');
  const { blocksBuilding, buildingPlan, buildingBounds } =
    await import('../src/shared/building-shapes');
  for (const rotation of [0, 0.7, Math.PI / 2]) {
    for (const kind of ['market', 'school', 'home']) {
      const { w, p, b } = setup();
      b.kind = kind;
      b.rotation = rotation;
      w.settings.arrivalRange = 50;
      const bounds = buildingBounds(buildingPlan(b));
      const z = bounds.minZ - 2;
      Object.assign(p, {
        vehicle: 5,
        x: b.x + z * Math.sin(rotation),
        z: b.z + z * Math.cos(rotation),
      });
      act(w, p.id, { type: 'approach', building: b.id });
      const a = p.task!.arrival!;
      for (let i = 0; i <= 200; i++) {
        const pos = arrivalPosition(p, a.start + ((a.end - a.start) * i) / 200);
        assert.equal(
          blocksBuilding(b, pos.x, pos.z, 0, 0),
          false,
          `${kind}, rotation ${rotation}: visible walk crosses wall at ${JSON.stringify(pos)}`,
        );
      }
    }
  }
});

test('routing faces each segment, avoids neighbouring walls and safely cancels from behind', async () => {
  const { arrivalPose, arrivalPosition } = await import('../src/shared/arrival');
  const { blocksBuilding } = await import('../src/shared/building-shapes');
  const { w, p, b } = setup();
  const neighbour = makeBuilding('neighbour', 'home', 8, -12);
  w.buildings.push(neighbour);
  Object.assign(p, { vehicle: 5, x: 0, z: -22, y: 0 });
  act(w, p.id, { type: 'approach', building: b.id });
  const a = p.task!.arrival!;
  assert.ok(a.path!.length > 2);
  for (let i = 1; i < 70; i++) {
    const time = a.start + ((a.end - a.start) * i) / 100;
    const pos = arrivalPose(p, time),
      later = arrivalPosition(p, time + 0.000001);
    for (const building of w.buildings)
      assert.equal(blocksBuilding(building, pos.x, pos.z, 0, 0), false);
    const direction = Math.atan2(later.x - pos.x, later.z - pos.z);
    assert.ok(
      Math.abs(Math.atan2(Math.sin(pos.heading - direction), Math.cos(pos.heading - direction))) <
        1e-6,
    );
  }
  advance(w, (a.end - a.start) * 0.2);
  const before = arrivalPosition(p, w.time);
  act(w, p.id, { type: 'exitBuilding' });
  assert.deepEqual(arrivalPosition(p, w.time), before, 'cancelling must not teleport to the door');
  const exit = p.task!.arrival!;
  for (let i = 0; i <= 100; i++) {
    const pos = arrivalPosition(p, exit.start + ((exit.end - exit.start) * i) / 100);
    for (const building of w.buildings)
      assert.equal(blocksBuilding(building, pos.x, pos.z, 0, 0), false);
  }
  advance(w, exit.end - w.time);
  assert.equal(p.inside, undefined);
});

test('blocked doorway refuses atomically, and stale home parking does not teleport a pedestrian', () => {
  const { w, p, b } = setup();
  Object.assign(p, { vehicle: 5, x: 0, z: -22 });
  const obstruction = makeBuilding('blocked-door', 'home', 0, -7);
  w.buildings.push(obstruction);
  const before = JSON.stringify(w);
  assert.throws(() => act(w, p.id, { type: 'approach', building: b.id }), /clear walking route/);
  assert.equal(JSON.stringify(w), before);
  w.buildings = [b];
  p.homeParking = { building: b.id, slot: 0 };
  const start = { x: p.x, y: p.y, z: p.z };
  act(w, p.id, { type: 'approach', building: b.id });
  assert.deepEqual(p.task!.arrival!.from, start);
});

test('legacy paths, zero-length arrivals and disabled animations retain final facing', async () => {
  const { arrivalPose, finishArrival } = await import('../src/shared/arrival');
  const { buildingEntry } = await import('../src/shared/parking-site');
  const { w, p, b } = setup();
  const from = { x: 0, y: 0, z: 0 },
    to = { x: 2, y: 0, z: 3 };
  p.task = { kind: 'exiting', end: 2, arrival: { building: b.id, start: 0, end: 2, from, to } };
  const heading = arrivalPose(p, 2).heading;
  finishArrival(w, p);
  assert.equal(p.heading, heading);
  p.heading = 1.25;
  p.task = { kind: 'exiting', end: 2, arrival: { building: b.id, start: 0, end: 2, from: to, to } };
  finishArrival(w, p);
  assert.equal(p.heading, 1.25);
  for (const mode of ['full', 'quick', 'off']) {
    Object.assign(w.settings, { arrivalAnimation: mode });
    Object.assign(p, buildingEntry(b), { vehicle: 5, y: 0, inside: b.id });
    act(w, p.id, { type: 'exitBuilding' });
    if (p.task) advance(w, p.task.end - w.time);
    assert.ok(Math.abs(p.heading - b.rotation) < 1e-8);
  }
});

test('arrival wall clearance uses validated world defaults and survives rule export', async () => {
  const { configureRules, exportDesign, applyDesign } = await import('../src/server/world-design');
  const { parkingRules } = await import('../src/shared/parking-rules');
  const { w, p } = setup();
  assert.equal(parkingRules(w.settings).arrivalWallClearance, 0.45);
  delete w.settings.arrivalWallClearance;
  assert.equal(parkingRules(w.settings).arrivalWallClearance, 0.45);
  configureRules(w, { arrivalWallClearance: 0.8 });
  const target = createWorld('clearance', 'Clearance', 'owner');
  applyDesign(target, exportDesign(w));
  assert.equal(target.settings.arrivalWallClearance, 0.8);
  for (const value of [0, 3, NaN, 'wide'])
    assert.throws(() => act(w, p.id, { type: 'settings', patch: { arrivalWallClearance: value } }));
});

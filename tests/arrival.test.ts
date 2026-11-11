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

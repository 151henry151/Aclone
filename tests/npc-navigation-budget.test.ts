// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, move, distance } from '../src/shared/simulation';
import { Navigator } from '../src/server/npc/navigation';

function fixture(id: string) {
  const w = createWorld(id, 'Planning check', 'owner');
  const p = addPlayer(w, 'npc', 'Traveller');
  p.x = -30;
  p.z = -50;
  w.buildings = [];
  w.roads = Array.from({ length: 2003 }, (_, i) => ({
    a: { x: 300 + i, z: 300 },
    b: { x: 301 + i, z: 300 },
    width: 5,
  }));
  return { w, p, target: { x: 30, z: -50 } };
}

test('deferred route construction yields before terrain work and matches the safe route', () => {
  const { w, p, target } = fixture('deferred');
  let reads = 0;
  const terrain = w.terrain;
  Object.defineProperty(w, 'terrain', {
    configurable: true,
    get() {
      reads++;
      return terrain;
    },
  });
  const nav = new Navigator(w, p, target, 3, false, true);
  assert.ok(reads < 10, `construction must not sweep terrain (${reads} reads)`);
  assert.deepEqual(nav.waypoints(), [], 'no partial path is exposed');
  const before = reads;
  assert.deepEqual(nav.step(w, p, 0.05, { remainingMs: 0 }).input, {
    throttle: 0,
    steer: 0,
    boost: false,
  });
  assert.equal(reads, before, 'exhausted shared budget leaves work for another tick');
  let ready = false;
  for (let i = 0; i < 2000; i++) {
    const start = performance.now();
    const r = nav.step(w, p, 0.05);
    assert.ok(performance.now() - start < 100, 'a planning slice must return within 100 ms');
    assert.equal(r.error, undefined);
    if (nav.waypoints().length) {
      ready = true;
      break;
    }
    assert.equal(r.input.throttle, 0, 'do not drive an unfinished route');
    assert.equal(r.arrived, undefined, 'waiting is not arrival');
  }
  assert.ok(ready, 'planning completes');
  assert.deepEqual(nav.waypoints(), new Navigator(w, p, target, 3).waypoints());
  let arrived = false;
  for (let i = 0; i < 6000; i++) {
    const before = { x: p.x, z: p.z };
    const r = nav.step(w, p, 0.05);
    assert.equal(r.error, undefined);
    move(w, p, r.input, 0.05);
    assert.ok(distance(before, p) < 0.8, 'deferred navigation uses ordinary physics without jumps');
    if (r.arrived) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived, 'the completed deferred route reaches its destination');
});

test('deferred routes preserve arrival and report blocked routes without driving', () => {
  const { w, p } = fixture('deferred-blocked');
  w.settings.seaLevel = 1000;
  assert.equal(new Navigator(w, p, p, 3, false, true).step(w, p, 0.05).arrived, true);
  const nav = new Navigator(w, p, { x: 40, z: 40 }, 3, false, true);
  let failure;
  for (let i = 0; i < 2000; i++) {
    const r = nav.step(w, p, 0.05);
    assert.equal(r.input.throttle, 0);
    if (r.error) {
      failure = r.error;
      break;
    }
    assert.equal(r.arrived, undefined);
  }
  assert.match(failure ?? '', /route/);
});

test('a world edit during deferred planning discards obsolete terrain', () => {
  const { w, p, target } = fixture('deferred-edited');
  const nav = new Navigator(w, p, target, 3, false, true);
  nav.step(w, p, 0.05, { remainingMs: 0.1 });
  w.settings.seaLevel = 1000;
  let failure;
  for (let i = 0; i < 2000; i++) {
    const r = nav.step(w, p, 0.05);
    assert.equal(r.input.throttle, 0, 'never drive a stale dry-land route after flooding');
    if (r.error) {
      failure = r.error;
      break;
    }
  }
  assert.match(failure ?? '', /route/);
});

test('multiple residents share the remaining planning budget rather than multiplying it', () => {
  const a = fixture('budget-a'),
    b = fixture('budget-b');
  const first = new Navigator(a.w, a.p, a.target, 3, false, true);
  const second = new Navigator(b.w, b.p, b.target, 3, false, true);
  let reads = 0;
  const terrain = b.w.terrain;
  Object.defineProperty(b.w, 'terrain', {
    get() {
      reads++;
      return terrain;
    },
  });
  const budget = { remainingMs: 0.000001 };
  first.step(a.w, a.p, 0.05, budget);
  assert.equal(budget.remainingMs, 0);
  assert.equal(second.step(b.w, b.p, 0.05, budget).input.throttle, 0);
  assert.equal(reads, 0, 'the second resident cannot start another expensive slice');
});

test('deferred planning completes across ordinary game-clock updates', (t) => {
  const { w, p, target } = fixture('advancing-clock');
  const nav = new Navigator(w, p, target, 3, false, true);
  let clock = 0;
  t.mock.method(performance, 'now', () => ++clock);
  for (let i = 0; i < 1000 && !nav.waypoints().length; i++) {
    w.time += 0.05;
    w.settings.time = (w.settings.time + (0.05 * 86400) / w.settings.dayLength) % 86400;
    const r = nav.step(w, p, 0.05);
    assert.equal(r.error, undefined);
    if (!nav.waypoints().length) assert.equal(r.input.throttle, 0);
  }
  assert.ok(nav.waypoints().length, 'ordinary clock ticks must not restart the partial route');
  assert.deepEqual(nav.waypoints(), new Navigator(w, p, target, 3).waypoints());
});

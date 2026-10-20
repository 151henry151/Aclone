// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('courses', 'Courses', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  p.online = true;
  p.vehicle = 0;
  p.x = 0;
  p.z = 0;
  act(w, p.id, {
    type: 'course',
    operation: 'configure',
    course: {
      id: 'test',
      name: 'Test',
      starts: 0,
      ends: 10000,
      limit: 600,
      reward: 100,
      points: [
        { x: 0, z: 0, radius: 2 },
        { x: 30, z: 0, radius: 2, holdSeconds: 1 },
      ],
    },
  });
  return { w, p };
}
function finish(w: ReturnType<typeof createWorld>, p: ReturnType<typeof addPlayer>) {
  for (let x = 1; x <= 30; x++) {
    p.x = x;
    advance(w, 0.1);
  }
  for (let i = 0; i < 11; i++) advance(w, 0.1);
}
test('validated finishes preserve scores and pay only one escrow reward across reload', () => {
  let { w, p } = setup();
  p.cash = 10000;
  act(w, p.id, { type: 'course', operation: 'fund', course: 'test', amount: 500 });
  act(w, p.id, { type: 'course', operation: 'start', course: 'test' });
  finish(w, p);
  assert.equal(p.cash, 9600);
  assert.equal(w.courses![0].pot, 400);
  assert.ok(w.courses![0].allTime[p.id]);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    w = store.loadWorlds()[0].world;
    p = w.players[p.id];
    p.online = true;
    p.x = 0;
    act(w, p.id, { type: 'course', operation: 'start', course: 'test' });
    finish(w, p);
    assert.equal(p.cash, 9600);
    assert.equal(w.courses![0].pot, 400);
  } finally {
    store.close();
  }
});
test('teleports, offline catchup and unauthorised course editing cannot win', () => {
  const { w, p } = setup(),
    q = addPlayer(w, 'other', 'Other');
  assert.throws(
    () =>
      act(w, q.id, { type: 'course', operation: 'configure', course: w.courses![0].definition }),
    /caretaker/,
  );
  act(w, p.id, { type: 'course', operation: 'start', course: 'test' });
  p.x = 30;
  advance(w, 0.1);
  assert.equal(p.courseRun, undefined);
  assert.deepEqual(w.courses![0].allTime, {});
  p.x = 0;
  act(w, p.id, { type: 'course', operation: 'start', course: 'test' });
  advance(w, 60);
  assert.equal(p.courseRun, undefined);
});
test('optional phase cycle freezes combat outside war and archives once across restart', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'roundCycle', rules: { build: 60, peace: 60, war: 60 } });
  assert.equal(w.settings.fighting, false);
  advance(w, 60);
  assert.equal(w.roundCycle?.phase, 'peace');
  advance(w, 60);
  assert.equal(w.settings.fighting, true);
  advance(w, 60);
  assert.equal(w.settings.fighting, false);
  assert.equal(w.roundCycle?.history.length, 1);
  advance(w, 0.1);
  assert.equal(w.roundCycle?.history.length, 1);
});

test('course bounds and overlapping checkpoints are rejected; phase archives survive disable', () => {
  const { w, p } = setup(),
    c = w.courses![0].definition;
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'course',
        operation: 'configure',
        course: {
          ...c,
          points: [
            { x: 0, z: 0 },
            { x: 1e9, z: 0 },
          ],
        },
      }),
    /inside/,
  );
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'course',
        operation: 'configure',
        course: {
          ...c,
          points: [
            { x: 0, z: 0 },
            { x: 1, z: 0 },
          ],
        },
      }),
    /overlap/,
  );
  act(w, p.id, { type: 'roundCycle', rules: { build: 60, peace: 60, war: 60 } });
  advance(w, 180);
  act(w, p.id, { type: 'roundCycle', operation: 'disable' });
  assert.equal(w.roundArchive?.length, 1);
});

test('an arena victory remains available for the phase archive instead of resetting after fifteen seconds', () => {
  const { w, p } = setup();
  act(w, p.id, { type: 'roundCycle', rules: { build: 60, peace: 60, war: 60 } });
  advance(w, 120);
  w.combat = {
    mode: 'ctf',
    scores: [3, 0],
    round: 1,
    ends: w.time + 60,
    winner: 0,
    restart: w.time + 15,
    flags: [],
  };
  for (let i = 0; i < 20; i++) advance(w, 1);
  assert.deepEqual(w.combat.scores, [3, 0]);
  advance(w, 40);
  assert.deepEqual(w.roundArchive?.[0].scores, [3, 0]);
  assert.equal(w.combat.winner, undefined);
  assert.deepEqual(w.combat.scores, [0, 0]);
});

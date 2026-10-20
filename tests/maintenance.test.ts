// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, move, command } from '../src/shared/simulation.ts';
import { Store } from '../src/server/store.ts';
function setup() {
  const w = createWorld('maintenance', 'Maintenance', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    q = addPlayer(w, 'other', 'Other'),
    b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = p.id;
  p.x = b.x;
  p.z = b.z;
  return { w, p, q, b };
}
test('maintenance persists, rejects economic actions and freezes movement, survival and clocks', () => {
  const { w, p, q, b } = setup();
  assert.throws(() => act(w, q.id, { type: 'maintenance', paused: true }), /caretaker/);
  act(w, p.id, { type: 'maintenance', paused: true });
  assert.throws(() => command(w, p, '*resetpos'), /paused/);
  assert.throws(() => command(w, p, '*cash operator 100'), /paused/);
  assert.match(command(w, p, '*help'), /Player:/);
  const before = JSON.stringify({ time: w.time, p, stock: b.stock });
  advance(w, 86400);
  move(w, p, { throttle: 1, steer: 0, boost: false }, 1);
  assert.equal(JSON.stringify({ time: w.time, p, stock: b.stock }), before);
  assert.throws(
    () => act(w, p.id, { type: 'investment', building: b.id, amount: 1, direction: 'deposit' }),
    /paused/,
  );
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    advance(saved, 1000);
    assert.equal(saved.time, w.time);
    act(saved, saved.owner, { type: 'maintenance', paused: false });
    advance(saved, 1);
    assert.equal(saved.time, w.time + 1);
    assert.equal(saved.maintenance?.history.length, 2);
  } finally {
    store.close();
  }
});

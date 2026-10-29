// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { meanBiteWait, randomBiteWait, scheduleBite } from '../src/shared/boat-fishing';
test('dock, coastal and deep-water fishing retain their intended mean waiting rates', () => {
  const w = createWorld('test', 'Test', 'server');
  const p = addPlayer(w, 'p', 'Angler');
  w.settings.fishingMode = 5;
  p.vehicle = 5;
  assert.equal(meanBiteWait(w, p), 20);
  p.vehicle = 3;
  Object.assign(p, { x: 0, z: 170 });
  assert.equal(meanBiteWait(w, p), 65);
  Object.assign(p, { x: 0, z: 1400 });
  assert.equal(meanBiteWait(w, p), 225);
  w.time = 123;
  scheduleBite(w, p);
  assert.ok(p.fishAt! > w.time && Number.isFinite(p.fishAt));
  assert.equal(p.fishUntil, p.fishAt! + 8);
});
test('random bite waits have the expected means, quick bites and long quiet spells', () => {
  // Stratified quantiles avoid a flaky random test while checking the whole distribution.
  for (const mean of [20, 65, 225, 75]) {
    let total = 0;
    for (let i = 0; i < 10000; i++) total += randomBiteWait(mean, (i + 0.5) / 10000);
    assert.ok(Math.abs(total / 10000 - mean) < mean * 0.001);
    assert.ok(randomBiteWait(mean, 0.01) < mean * 0.02);
    assert.ok(randomBiteWait(mean, 0.99) > mean * 4);
    for (const roll of [0, 1])
      assert.ok(Number.isFinite(randomBiteWait(mean, roll)) && randomBiteWait(mean, roll) > 0);
    // Memorylessness: another quiet interval remains equally likely after waiting.
    assert.ok(Math.abs(randomBiteWait(mean, 0.75) - randomBiteWait(mean, 0.5) * 2) < 1e-8);
  }
});

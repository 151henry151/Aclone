// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hovercraftWorld } from './fixtures/hovercraft-world';
// Capture the released movement at b5bd7708, before any hovercraft production edits.
import legacy from './fixtures/hovercraft-legacy.json';
import { act, move } from '../src/shared/simulation';
import { switchVehicle } from '../src/shared/tractors';
import { LocalPrediction } from '../src/client/prediction';
import type { Player } from '../src/shared/types';

const input = { throttle: 1, steer: 1, boost: false };
function run(f: ReturnType<typeof hovercraftWorld>, ticks: number, steer = 1, throttle = 1) {
  for (let i = 0; i < ticks; i++) move(f.w, f.p, { throttle, steer, boost: false }, 0.05);
}
function slip(f: ReturnType<typeof hovercraftWorld>, steer = 0, throttle = 1) {
  const { x, z } = f.p;
  run(f, 1, steer, throttle);
  return Math.atan2(
    Math.sin(Math.atan2(f.p.x - x, f.p.z - z) - f.p.heading),
    Math.cos(Math.atan2(f.p.x - x, f.p.z - z) - f.p.heading),
  );
}
const pose = (p: Player) => ({ x: p.x, z: p.z, heading: p.heading, speed: p.speed });

test('cruise turns keep the old travel direction and sweep outside the zero-drift arc', () => {
  const drift = hovercraftWorld(),
    pivot = hovercraftWorld();
  (pivot.w.settings as any).hovercraftDriftSeconds = 0;
  run(drift, 12);
  run(pivot, 12);
  assert.ok(slip(drift, 1) < -0.3, 'nose leads travel by a noticeable angle');
  run(pivot, 1);
  assert.ok(drift.p.z > pivot.p.z + 1, 'old forward travel carries craft outside pivot arc');
  assert.ok(drift.p.x < pivot.p.x - 1, 'sideways turn does not instantly follow nose');
});

test('holding the new heading settles the slide; releasing throttle stops it', () => {
  const f = hovercraftWorld();
  run(f, 15);
  assert.ok(Math.abs(slip(f)) > 0.3);
  run(f, 160, 0);
  assert.ok(Math.abs(slip(f)) < 0.01);
  run(f, 160, 0, 0);
  assert.ok(Math.abs(f.p.speed) < 0.00001);
  const start = pose(f.p);
  run(f, 20, 0, 0);
  assert.ok(Math.hypot(f.p.x - start.x, f.p.z - start.z) < 0.00001);
});

test('low-speed yaw is weaker and reverse stays slow and aligned with the nose', () => {
  const slow = hovercraftWorld(),
    fast = hovercraftWorld();
  slow.p.speed = 1;
  run(slow, 1);
  run(fast, 1);
  assert.ok(slow.p.heading < fast.p.heading * 0.25);
  run(fast, 160, 0.5, -1);
  assert.ok(fast.p.speed < 0 && fast.p.speed >= -8);
  assert.ok(Math.abs(Math.abs(slip(fast, 0.5, -1)) - Math.PI) < 1e-8);
});

for (const trace of legacy)
  test(`zero drift exactly matches released trace for vehicle ${trace.vehicle}`, () => {
    const f = hovercraftWorld();
    f.p.vehicle = trace.vehicle;
    (f.w.settings as any).hovercraftDriftSeconds = 0;
    if (trace.vehicle === 3) f.w.settings.seaLevel = 30;
    let step = 0;
    for (const [throttle, steer, ticks] of [
      [1, 1, 20],
      [1, 0, 40],
      [0, -1, 30],
      [-1, 0.5, 60],
      [0, 0, 100],
    ]) {
      run(f, ticks, steer, throttle);
      assert.deepEqual(pose(f.p), trace.states[step++]);
    }
    if (trace.vehicle !== 4) {
      const enabled = hovercraftWorld();
      enabled.p.vehicle = trace.vehicle;
      if (trace.vehicle === 3) enabled.w.settings.seaLevel = 30;
      for (const [throttle, steer, ticks] of [
        [1, 1, 20],
        [1, 0, 40],
        [0, -1, 30],
        [-1, 0.5, 60],
        [0, 0, 100],
      ])
        run(enabled, ticks, steer, throttle);
      assert.deepEqual(pose(enabled.p), pose(f.p));
    }
  });

test('longer response keeps more drift; settings validate and survive saves and portable designs', async () => {
  const { Store } = await import('../src/server/store');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { rulesSummary } = await import('../src/shared/rulesets');
  const a = hovercraftWorld(),
    b = hovercraftWorld();
  act(a.w, a.p.id, { type: 'settings', patch: { hovercraftDriftSeconds: 0.25 } });
  act(b.w, b.p.id, { type: 'settings', patch: { hovercraftDriftSeconds: 3 } });
  run(a, 20);
  run(b, 20);
  assert.ok(Math.abs(slip(b)) > Math.abs(slip(a)) * 2);
  for (const value of [-1, 6, NaN, Infinity, '1'])
    assert.throws(() =>
      act(a.w, a.p.id, { type: 'settings', patch: { hovercraftDriftSeconds: value } }),
    );
  assert.match(rulesSummary(b.w), /Hovercraft.*3/);
  const store = new Store(':memory:');
  try {
    store.saveWorld(b.w);
    const saved = store.loadWorlds()[0].world;
    assert.equal((saved.settings as any).hovercraftDriftSeconds, 3);
    const imported = hovercraftWorld();
    imported.w.players = {};
    applyDesign(imported.w, exportDesign(b.w));
    assert.equal((imported.w.settings as any).hovercraftDriftSeconds, 3);
    const resumed = { w: saved, p: saved.players[b.p.id] };
    run(resumed, 1);
    run(b, 1);
    assert.deepEqual(pose(resumed.p), pose(b.p));
  } finally {
    store.close();
  }
  const old = hovercraftWorld(),
    current = hovercraftWorld();
  delete (old.w.settings as any).hovercraftDriftSeconds;
  run(old, 20);
  run(current, 20);
  assert.deepEqual(pose(old.p), pose(current.p));
});

test('prediction preserves the drift without mutating server state', () => {
  const f = hovercraftWorld();
  run(f, 10);
  const predictor = new LocalPrediction();
  predictor.receive(f.w, f.p, 0, 0, 0);
  const before = JSON.stringify(f.w);
  const predicted = predictor.sample(50, input)!;
  assert.equal(JSON.stringify(f.w), before);
  run(f, 1);
  assert.deepEqual(pose(predicted as Player), pose(f.p));
});

test('teleport, stopping and switching vehicles cannot carry stale drift into a fresh departure', () => {
  for (const reset of ['teleport', 'stop', 'switch']) {
    const f = hovercraftWorld();
    run(f, 20);
    if (reset === 'teleport') {
      f.p.x = 200;
      f.p.z = 200;
    }
    if (reset === 'stop') {
      f.p.speed = 0;
      run(f, 1, 0, 0);
    }
    if (reset === 'switch') {
      switchVehicle(f.p, 0, true, f.w);
      switchVehicle(f.p, 4, true, f.w);
    }
    f.p.speed = 10;
    assert.ok(Math.abs(slip(f)) < 1e-8, reset);
  }
});

test('a parked obstacle stops drift and a clear departure does not resurrect it', () => {
  const f = hovercraftWorld();
  run(f, 10);
  const p = f.p;
  f.w.parkedVehicles = {
    obstacle: {
      owner: 'other',
      slot: 0,
      x: p.x,
      z: p.z,
      y: 20,
      heading: 0,
      fuel: 0,
      condition: 100,
      parkedAt: 0,
    },
  };
  run(f, 1);
  assert.equal(p.speed, 0);
  f.w.parkedVehicles = {};
  p.speed = 5;
  assert.ok(Math.abs(slip(f)) < 1e-8);
});

test('water keeps the existing hover height and no fuel cannot drive from a stop', () => {
  const f = hovercraftWorld();
  f.w.settings.seaLevel = 30;
  f.p.y = 30.5;
  run(f, 20);
  assert.equal(f.p.y, 30.5);
  assert.ok(Math.abs(slip(f)) > 0.3);
  f.p.speed = 0;
  f.p.fuel = 0;
  const start = pose(f.p);
  run(f, 80);
  assert.equal(f.p.speed, 0);
  assert.equal(f.p.x, start.x);
  assert.equal(f.p.z, start.z);
});

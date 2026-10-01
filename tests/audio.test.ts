// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { motorRunning, productionActivity, craftingBuildings } from '../src/shared/sound-state.ts';
import { HornTracker, spatialSound, selectLoops } from '../src/client/sound-scene.ts';
import { synthesize } from '../src/client/sound-synthesis.ts';
import { prepareFrame, privatePlayer, publicBuildings } from '../src/server/snapshots.ts';

function fixture() {
  const w = createWorld('audio', 'Audio', 'owner');
  w.buildings = [];
  const p = addPlayer(w, 'pilot', 'Pilot');
  p.online = true;
  return { w, p };
}

test('public motor state follows ignition, fuel, shelter and non-motor vehicles', () => {
  const { w, p } = fixture();
  assert.equal(motorRunning(w, p), true);
  assert.equal(JSON.parse(prepareFrame(w).players[p.id]).engineRunning, true);
  p.engine = false;
  assert.equal(privatePlayer(w, p).engineRunning, false);
  p.engine = true;
  p.fuel = 0;
  assert.equal(motorRunning(w, p), false);
  p.fuel = 100;
  for (const vehicle of [5, 6]) {
    p.vehicle = vehicle;
    assert.equal(motorRunning(w, p), false);
  }
  p.vehicle = 0;
  p.atHome = true;
  assert.equal(motorRunning(w, p), false);
  p.atHome = false;
  p.online = false;
  assert.equal(motorRunning(w, p), false);
});

test('industry sound requires real production inputs, space and wages, or an active craft task', () => {
  const { w, p } = fixture();
  const b = makeBuilding('saw', 'sawmill', 0, 0);
  w.buildings = [b];
  b.government = false;
  b.stock = { logs: 10 };
  b.investment = 10000;
  b.employees = [p.id];
  p.job = b.id;
  p.activeUntil = w.time + 60;
  assert.equal(productionActivity(w, b), 1);
  assert.equal(publicBuildings(w)[0].operating, 1);
  b.stock.logs = 0;
  assert.equal(productionActivity(w, b), 0);
  b.stock.logs = 10;
  b.stock.wood = b.capacity;
  assert.equal(productionActivity(w, b), 0);
  b.stock.wood = 0;
  b.investment = 0;
  assert.equal(productionActivity(w, b), 0);
  b.investment = 10000;
  p.activeUntil = w.time - 1;
  assert.equal(productionActivity(w, b), w.settings.offlineEfficiency);
  b.construction = { wood: 1 };
  assert.equal(productionActivity(w, b), 0);
  delete b.construction;
  b.kind = 'forge';
  b.stock = {};
  p.task = { kind: 'craft', building: b.id, end: w.time + 15 };
  assert.equal(productionActivity(w, b, craftingBuildings(w)), 1);
  p.online = false;
  assert.equal(productionActivity(w, b), 0);
});

test('horn tracking plays new authoritative honks once, with no login/reconnect backlog', () => {
  const { w, p } = fixture();
  const horns = new HornTracker();
  p.lastHorn = w.time;
  assert.deepEqual(horns.receive(w), []);
  w.time += 0.4;
  p.lastHorn = w.time;
  assert.deepEqual(horns.receive(w), [p.id]);
  assert.deepEqual(horns.receive(w), []);
  w.time += 5;
  p.lastHorn += 0.4;
  assert.deepEqual(horns.receive(w), []);
  horns.clear();
  assert.deepEqual(horns.receive(w), []);
  w.id = 'elsewhere';
  p.lastHorn = w.time;
  assert.deepEqual(horns.receive(w), []);
});

test('spatial sounds fade with distance, pan with view direction and have a bounded voice budget', () => {
  const listener = { x: 0, y: 0, z: 0, heading: 0 };
  const near = spatialSound(listener, { x: -10, y: 0, z: 0 }, 100);
  assert.ok(near.pan > 0.9);
  assert.ok(
    spatialSound({ ...listener, heading: Math.PI }, { x: -10, y: 0, z: 0 }, 100).pan < -0.9,
  );
  assert.ok(spatialSound(listener, { x: -50, y: 0, z: 0 }, 100).gain < near.gain);
  assert.equal(spatialSound(listener, { x: -101, y: 0, z: 0 }, 100).gain, 0);
  const { w, p } = fixture();
  p.x = p.z = 0;
  p.engineRunning = true;
  for (let i = 0; i < 60; i++) {
    const q = addPlayer(w, `remote-${i}`, 'Neighbour');
    q.x = i + 1;
    q.z = 0;
    q.online = q.engineRunning = true;
  }
  const loops = selectLoops(w, p, listener);
  assert.ok(loops.length <= 16);
  assert.ok(loops.some((s) => s.id === `engine:${p.id}`));
  p.vehicle = 5;
  p.engineRunning = false;
  assert.ok(!selectLoops(w, p, listener).some((s) => s.id === `engine:${p.id}`));
});

test('original synthesized loops and horn contain audible, bounded, finite signals', () => {
  for (const kind of ['engine', 'saw', 'mill', 'hammer', 'furnace', 'pump', 'horn'] as const) {
    const samples = synthesize(kind, 24000);
    const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    assert.ok(rms > 0.08 && rms < 0.6, `${kind}: RMS ${rms}`);
    assert.ok(samples.every((x) => Number.isFinite(x) && Math.abs(x) <= 1));
    if (kind === 'horn') assert.ok(Math.abs(samples.at(-1)!) < 0.001);
    else assert.ok(Math.abs(samples[0] - samples.at(-1)!) < 0.08, `${kind}: loop seam`);
  }
});

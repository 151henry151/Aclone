// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalPrediction } from '../src/client/prediction.ts';
import { createWorld, addPlayer, move } from '../src/shared/simulation.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import type { Input } from '../src/shared/types.ts';
const idle: Input = { throttle: 0, steer: 0, boost: false };
const drive: Input = { throttle: 1, steer: 0.2, boost: false };
function fixture() {
  const w = createWorld('prediction', 'Prediction', 'owner');
  w.buildings = [];
  w.creator = creatorSchema.parse({ scenery: false });
  const p = addPlayer(w, 'owner', 'Driver');
  p.x = -40;
  p.z = -40;
  p.y = 0;
  const predictor = new LocalPrediction();
  predictor.receive(w, p, 0, 0, 0);
  return { w, p, predictor };
}
test('local input moves on the next frame without changing authoritative resources or position', () => {
  const { w, p, predictor } = fixture();
  const before = JSON.stringify(w);
  const visual = predictor.sample(16.7, drive)!;
  assert.ok(Math.hypot(visual.x - p.x, visual.z - p.z) > 0);
  for (let t = 34; t < 500; t += 16.7) predictor.sample(t, drive);
  assert.equal(JSON.stringify(w), before);
});
for (const rtt of [50, 150, 300]) {
  test(`reconciliation under ${rtt} ms RTT, jitter and delayed snapshots remains bounded`, () => {
    const { w, p, predictor } = fixture();
    let sequence = 0,
      ack = 0,
      elapsed = 0,
      input = idle;
    const commands: { at: number; sequence: number; input: Input }[] = [];
    const states: { at: number; p: typeof p; ack: number; elapsed: number; time: number }[] = [];
    let maximumCorrection = 0;
    for (let now = 0; now <= 10000; now += 10) {
      const selected = now < 7000 ? drive : idle;
      if (now % 100 === 0) {
        predictor.sent(++sequence, selected, now);
        commands.push({ at: now + rtt / 2 + (sequence % 3) * 10, sequence, input: selected });
      }
      while (commands[0]?.at <= now) {
        const command = commands.shift()!;
        ack = command.sequence;
        input = command.input;
        elapsed = 0;
      }
      if (now % 50 === 0) {
        move(w, p, input, 0.05);
        w.time += 0.05;
        elapsed += 0.05;
      }
      if (now % 200 === 0 && now % 1000 !== 800)
        states.push({
          at: now + rtt / 2 + (sequence % 3) * 10,
          p: structuredClone(p),
          ack,
          elapsed,
          time: w.time,
        });
      while (states[0]?.at <= now) {
        const state = states.shift()!;
        predictor.receive({ ...w, time: state.time }, state.p, state.ack, state.elapsed, now);
        maximumCorrection = Math.max(maximumCorrection, predictor.correctionMetres);
      }
      predictor.sample(now, selected);
    }
    assert.ok(maximumCorrection < 4, `correction ${maximumCorrection}m`);
    const pose = predictor.sample(10000, idle)!;
    assert.ok(Math.hypot(pose.x - p.x, pose.z - p.z) < 1);
    console.log(`prediction ${rtt}ms RTT: maximum correction ${maximumCorrection.toFixed(3)}m`);
  });
}
test('teleport, death, mode changes and reconnect reset instead of replaying old controls', () => {
  const { w, p, predictor } = fixture();
  predictor.sent(1, drive, 10);
  predictor.sample(100, drive);
  p.x = 100;
  p.z = -100;
  predictor.receive(w, p, 1, 0, 120);
  assert.equal(predictor.sample(120, idle)!.x, 100);
  p.deaths++;
  p.x = 0;
  predictor.receive(w, p, 1, 0, 130);
  assert.equal(predictor.sample(130, idle)!.x, 0);
  p.vehicle = 5;
  predictor.receive(w, p, 1, 0, 140);
  assert.equal(predictor.sample(140, idle)!.x, 0);
  predictor.reset();
  assert.equal(predictor.sample(150, drive), undefined);
});
test('prediction respects collision and tasks, and holds on a stalled connection', () => {
  const { w, p, predictor } = fixture();
  p.task = { kind: 'labour', end: 100 };
  predictor.receive(w, p, 0, 0, 10);
  assert.equal(predictor.sample(100, drive)!.z, p.z);
  delete p.task;
  predictor.receive(w, p, 0, 0, 110);
  const stopped = predictor.sample(700, drive)!;
  assert.deepEqual(predictor.sample(5000, drive), stopped);
});

test('predicted collision, slopes and fuel match shared authoritative movement', () => {
  const w = createWorld('collision', 'Collision', 'owner');
  const p = addPlayer(w, 'owner', 'Driver');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = b.x;
  p.z = b.z - 12;
  p.heading = 0;
  const predictor = new LocalPrediction();
  predictor.receive(w, p, 0, 0, 0);
  const authoritative = structuredClone(p);
  for (let now = 50; now <= 500; now += 50) {
    move(w, authoritative, drive, 0.05);
    const visual = predictor.sample(now, drive)!;
    assert.ok(Math.abs(visual.z - authoritative.z) < 1e-8);
    assert.ok(Math.abs(visual.y - authoritative.y) < 1e-8);
  }
  assert.notEqual(p.fuel, authoritative.fuel);
});

for (const frameMs of [1000 / 60, 1000 / 30])
  for (const arrivalOffset of [1, 7, 15, 31]) {
    test(`fast straight driving stays even when snapshots arrive between ${Math.round(1000 / frameMs)} FPS frames (${arrivalOffset} ms offset)`, () => {
      const { w, p } = fixture();
      w.creator = creatorSchema.parse({ scenery: false, roads: false });
      w.roads = [{ a: { x: 0, z: -110 }, b: { x: 0, z: 110 }, width: 12 }];
      w.climate = { snow: 0, wetness: 0 };
      p.x = 0;
      p.z = -60;
      p.heading = 0;
      p.vehicle = 25; // Swift Kestrel: amplifies even a small lost fraction of a frame.
      p.speed = 100;
      const straight = { throttle: 1, steer: 0, boost: false };
      move(w, p, straight, 0.05);
      const speed = p.speed;
      const predictor = new LocalPrediction();
      predictor.receive(w, p, 0, 0, 0);
      predictor.sent(1, straight, 0);
      predictor.sample(0, straight);
      let previousZ = p.z;
      let previousTime = 0;
      let snapshot = 200;
      let worst = 0;
      for (let frame = 1; frame * frameMs < 3000; frame++) {
        const now = frame * frameMs;
        while (snapshot + arrivalOffset <= now) {
          for (let step = 0; step < 4; step++) move(w, p, straight, 0.05);
          predictor.receive(w, p, 1, snapshot / 1000, snapshot + arrivalOffset);
          snapshot += 200;
        }
        const pose = predictor.sample(now, straight)!;
        const frameSpeed = (pose.z - previousZ) / ((now - previousTime) / 1000);
        worst = Math.max(worst, Math.abs(frameSpeed / speed - 1));
        previousZ = pose.z;
        previousTime = now;
      }
      assert.ok(worst < 0.02, `snapshot-induced speed variation ${(worst * 100).toFixed(1)}%`);
    });
  }

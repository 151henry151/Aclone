// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MotionClock, MotionTrack } from '../src/client/motion.ts';
const pose = (x: number, heading = 0, speed = 10) => ({ x, y: 1, z: 0, heading, speed });

test('5 Hz snapshots produce uniform travel at both 60 and 10 rendered frames per second', () => {
  for (const fps of [60, 30, 10]) {
    const track = new MotionTrack();
    const clock = new MotionClock();
    const steps: number[] = [];
    let previous = 0;
    for (let frame = 0; frame <= fps * 4; frame++) {
      const now = frame / fps;
      if (frame % (fps / 5) === 0) {
        clock.receive(now, now * 1000);
        track.receive(now, pose(now * 10));
      }
      const x = track.sample(clock.sample(now * 1000))!.x;
      if (now > 0.5) steps.push(x - previous);
      previous = x;
    }
    assert.ok(
      steps.every((step) => Math.abs(step - 10 / fps) < 1e-8),
      `uneven steps at ${fps} FPS`,
    );
  }
});
test('server timestamps absorb uneven packet arrival without a stop-start sawtooth', () => {
  const clock = new MotionClock(),
    track = new MotionTrack();
  const packets = Array.from({ length: 30 }, (_, i) => ({
    time: i * 0.2,
    delay: [0.02, 0.07, 0.04, 0.1][i % 4],
  }));
  let packet = 0,
    previous = 0;
  const steps: number[] = [];
  for (let frame = 0; frame < 300; frame++) {
    const now = frame / 60;
    while (packet < packets.length && packets[packet].time + packets[packet].delay <= now) {
      const p = packets[packet++];
      clock.receive(p.time, (p.time + p.delay) * 1000);
      track.receive(p.time, pose(p.time * 10));
    }
    const x = track.sample(clock.sample(now * 1000))?.x ?? 0;
    if (now > 0.6) steps.push(x - previous);
    previous = x;
  }
  assert.ok(steps.every((step) => step > 0.15 && step < 0.18));
});
test('headings take the short path around the wrap and vertical movement is interpolated', () => {
  const track = new MotionTrack();
  track.receive(0, pose(0, Math.PI - 0.1));
  track.receive(0.2, { ...pose(2, -Math.PI + 0.1), y: 3 });
  const middle = track.sample(0.1)!;
  assert.ok(Math.abs(middle.heading - Math.PI) < 1e-8);
  assert.equal(middle.y, 2);
});
test('a dropped connection holds the last authoritative position without extrapolating', () => {
  const track = new MotionTrack();
  track.receive(0, pose(0));
  track.receive(0.2, pose(2));
  assert.deepEqual(track.sample(20), pose(2));
});
test('teleports and long gaps reset movement instead of sweeping across the world', () => {
  const track = new MotionTrack();
  track.receive(0, pose(0));
  assert.equal(track.receive(0.2, pose(150)), true);
  assert.equal(track.sample(0.1)!.x, 150);
  assert.equal(track.receive(10, pose(155)), true);
  assert.equal(track.sample(9)!.x, 155);
});
test('same-tick corrections replace the snapshot; incoming objects cannot mutate history', () => {
  const track = new MotionTrack();
  const p = pose(0);
  track.receive(0, p);
  p.x = 99;
  assert.equal(track.sample(0)!.x, 0);
  track.receive(0, pose(3));
  assert.equal(track.sample(0)!.x, 3);
});
test('a new world or long browser pause reanchors the clock', () => {
  const clock = new MotionClock();
  clock.receive(100, 1000);
  assert.equal(clock.receive(1, 1100), true);
  assert.ok(Math.abs(clock.sample(1100) - 0.7) < 1e-8);
  assert.equal(clock.receive(10, 10100), true);
  assert.ok(Math.abs(clock.sample(10100) - 9.7) < 1e-8);
});

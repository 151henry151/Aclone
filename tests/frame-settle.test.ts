import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameSettle } from '../src/client/frame-settle';

const run = (settle: FrameSettle, intervals: number[], start = 0) => {
  let now = start;
  for (const [i, interval] of intervals.entries()) {
    now += interval;
    if (settle.observe(now, interval, 50)) return i;
  }
  return -1;
};

test('settles once enough consecutive frames fit the budget', () => {
  assert.equal(run(new FrameSettle(5, 6000, 0), [20, 20, 20, 20, 20, 20]), 4);
});

test('a hitch restarts the smooth run', () => {
  assert.equal(run(new FrameSettle(3, 6000, 0), [20, 20, 400, 20, 20, 20]), 5);
});

test('waits a minimum time even when every frame is smooth', () => {
  assert.equal(run(new FrameSettle(2, 6000, 100), Array(10).fill(20)), 5);
});

test('gives up waiting after the maximum time on a slow machine', () => {
  assert.equal(run(new FrameSettle(5, 1000, 0), Array(20).fill(120)), 9);
});

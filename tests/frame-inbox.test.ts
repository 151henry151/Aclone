// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameInbox } from '../src/client/frame-inbox';
test('background and queued snapshots resume at the latest state without replaying history', () => {
  const frames = new Map<number, () => void>(),
    shown: number[] = [];
  let id = 0;
  const inbox = new FrameInbox<number>(
    (v) => shown.push(v),
    (fn) => {
      frames.set(++id, fn);
      return id;
    },
    (n) => {
      frames.delete(n);
    },
  );
  const paint = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((fn) => fn());
  };
  inbox.push(1);
  inbox.push(2);
  assert.equal(frames.size, 1);
  paint();
  assert.deepEqual(shown, [2]);
  inbox.push(3);
  inbox.setActive(false);
  for (let i = 4; i < 100; i++) inbox.push(i);
  assert.equal(frames.size, 0);
  assert.deepEqual(shown, [2]);
  inbox.setActive(true);
  inbox.push(100);
  paint();
  assert.deepEqual(shown, [2, 100]);
  inbox.push(101);
  inbox.clear();
  paint();
  assert.deepEqual(shown, [2, 100]);
});

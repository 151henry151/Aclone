// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import { GpuFrameQueue } from '../src/client/gpu-frame-queue';

function context() {
  let next = 0;
  const states = new Map<WebGLSync, number>();
  const deleted: WebGLSync[] = [],
    waits: number[][] = [];
  let flushes = 0,
    lost = false,
    failFence = false;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 0x9117 as const,
    ALREADY_SIGNALED: 2,
    CONDITION_SATISFIED: 3,
    TIMEOUT_EXPIRED: 0x911b as const,
    WAIT_FAILED: 5,
    fenceSync(condition: number, flags: number) {
      assert.equal(condition, 0x9117);
      assert.equal(flags, 0);
      if (failFence) return null;
      const sync = { id: ++next } as unknown as WebGLSync;
      states.set(sync, 0x911b);
      return sync;
    },
    clientWaitSync(sync: WebGLSync, flags: number, timeout: number) {
      waits.push([flags, timeout]);
      return states.get(sync)!;
    },
    deleteSync(sync: WebGLSync) {
      deleted.push(sync);
      states.delete(sync);
    },
    flush() {
      flushes++;
    },
    isContextLost() {
      return lost;
    },
  };
  return {
    gl,
    states,
    deleted,
    waits,
    flushes: () => flushes,
    lose: () => {
      lost = true;
    },
    restore: () => {
      lost = false;
    },
    fail: () => {
      failFence = true;
    },
  };
}

test('bounds incomplete frames and polls without waiting or flushing a full queue', () => {
  const c = context(),
    queue = new GpuFrameQueue(c.gl);
  for (let i = 0; i < 2; i++) {
    assert.equal(queue.canSubmit(), true);
    queue.submitted();
  }
  for (let i = 0; i < 120; i++) assert.equal(queue.canSubmit(), false);
  assert.equal(c.states.size, 2);
  assert.equal(c.flushes(), 2);
  assert.ok(c.waits.every(([flags, timeout]) => flags === 0 && timeout === 0));
  const first = [...c.states.keys()][0];
  c.states.set(first, c.gl.CONDITION_SATISFIED);
  assert.equal(queue.canSubmit(), true);
  assert.deepEqual(c.deleted, [first]);
  queue.submitted();
  assert.equal(queue.canSubmit(), false);
  assert.equal(c.states.size, 2);
});

test('completed frames are released and a fast GPU continues at the normal frame cap', () => {
  const c = context(),
    queue = new GpuFrameQueue(c.gl);
  for (let i = 0; i < 100; i++) {
    for (const sync of c.states.keys()) c.states.set(sync, c.gl.ALREADY_SIGNALED);
    assert.equal(queue.canSubmit(), true);
    queue.submitted();
  }
  assert.equal(c.deleted.length, 99);
  queue.reset();
  assert.equal(c.deleted.length, 100);
  assert.equal(c.states.size, 0);
});

test('context loss, invalidated syncs and failed fence creation cannot deadlock rendering', () => {
  const c = context(),
    queue = new GpuFrameQueue(c.gl);
  queue.submitted();
  queue.submitted();
  c.lose();
  assert.equal(queue.canSubmit(), false);
  assert.equal(c.states.size, 0);
  c.restore();
  assert.equal(queue.canSubmit(), true);
  queue.submitted();
  for (const sync of c.states.keys()) c.states.set(sync, c.gl.WAIT_FAILED);
  assert.equal(queue.canSubmit(), true);
  assert.equal(c.states.size, 0);
  c.fail();
  queue.submitted();
  assert.equal(queue.canSubmit(), true);
  assert.equal(c.states.size, 0);
});

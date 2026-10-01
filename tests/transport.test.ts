// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotWindow } from '../src/server/snapshot-window.ts';
import { InputStream } from '../src/client/input-stream.ts';
import { serializeFields, diffFields, applyFields } from '../src/shared/state-patch.ts';

test('field patches preserve null, remove absent/undefined properties and leave the baseline immutable', () => {
  const before = { task: { end: 1 }, nullable: 3, inventory: { bread: 4 } };
  const after = { nullable: null, task: undefined, inventory: {} };
  const patch = diffFields(serializeFields(before), serializeFields(after))!;
  assert.deepEqual(applyFields(before, patch), { nullable: null, inventory: {} });
  assert.deepEqual(before.task, { end: 1 });
});
test('snapshot flow control bounds in-flight states and rejects stale or invented acknowledgements', () => {
  const flow = new SnapshotWindow();
  assert.equal(flow.ready, true);
  assert.equal(flow.next(), 1);
  flow.next();
  flow.next();
  assert.equal(flow.ready, false);
  flow.ack(999);
  flow.ack(-1);
  flow.ack(1.5);
  assert.equal(flow.ready, false);
  flow.ack(2);
  assert.equal(flow.ready, true);
  flow.next();
  flow.next();
  flow.ack(1);
  assert.equal(flow.ready, false);
  flow.reset(); // Switching worlds discards the old world's baseline, not sequence identity.
  assert.equal(flow.next(), 6);
  flow.next();
  flow.next();
  flow.ack(3);
  assert.equal(flow.ready, false);
});
test('unchanged input costs 1 Hz parked or 10 Hz driving; changes and release stay responsive', () => {
  const input = new InputStream(),
    idle = { throttle: 0, steer: 0, boost: false };
  let parked = 0,
    moving = 0;
  for (let ms = 0; ms < 2000; ms += 50) if (input.encode(idle, ms, 0)) parked++;
  for (let ms = 2000; ms < 4000; ms += 50)
    if (input.encode({ ...idle, throttle: 1 }, ms, 0)) moving++;
  assert.equal(parked, 2);
  assert.equal(moving, 20);
  assert.ok(input.encode(idle, 4000, 0));
  assert.ok(input.encode({ ...idle, steer: 1 }, 4050, 0));
  assert.equal(input.encode({ ...idle, throttle: -1 }, 4100, 20), undefined);
  assert.equal(input.encode({ ...idle, throttle: 1 }, 4150, 20), undefined);
  assert.deepEqual(JSON.parse(input.encode(idle, 4200, 0)!).input, idle);
});

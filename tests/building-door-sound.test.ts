// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesize } from '../src/client/sound-synthesis';
import { soundKinds } from '../src/client/sound-bank';
import { spatialSound } from '../src/client/sound-scene';
test('door roll and sliding effects have bounded original audio and cannot reach beyond 40m', () => {
  for (const kind of ['door-roll', 'door-slide'] as const) {
    assert.ok((soundKinds as string[]).includes(kind));
    const samples = synthesize(kind as any, 12000);
    assert.equal(samples.length, 60000);
    assert.ok(samples.every(Number.isFinite));
    assert.ok(samples.some((s) => Math.abs(s) > 0.01));
    assert.ok(samples.every((s) => Math.abs(s) <= 0.9));
  }
  const at = { x: 0, y: 0, z: 0, heading: 0 };
  assert.ok(spatialSound(at, { x: 10, y: 0, z: 0 }, 40).gain > 0);
  assert.equal(spatialSound(at, { x: 41, y: 0, z: 0 }, 40).gain, 0);
});

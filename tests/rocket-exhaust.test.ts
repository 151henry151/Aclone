// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rocketExhaust, groundPuff } from '../src/client/rocket-exhaust';
import { spaceportFlight } from '../src/shared/spaceport-flight';
const cloud = (t: number) => Array.from({ length: 120 }, (_, i) => groundPuff(t, i));
test('no cloud on high approach; plume strikes pad before dust begins', () => {
  for (const t of [250, 260, 275, 285]) {
    assert.equal(rocketExhaust(t).contact, 0);
    assert.ok(cloud(t).every((p) => p.opacity === 0));
  }
  assert.ok(rocketExhaust(292).contact > 0);
  assert.ok(cloud(295).some((p) => p.opacity > 0.1));
});
test('pad clouds travel outward, persist after engine cutoff then dissipate', () => {
  const puff = cloud(300).findIndex((p) => p.opacity > 0.5);
  assert.ok(puff >= 0);
  const a = groundPuff(300, puff),
    b = groundPuff(301, puff);
  assert.ok(b.size > a.size);
  assert.ok(b.y > a.y);
  assert.ok(Math.hypot(b.x, b.z) > Math.hypot(a.x, a.z));
  assert.equal(rocketExhaust(313).thrust, 0);
  assert.ok(cloud(313).some((p) => p.opacity > 0));
  assert.ok(cloud(337).every((p) => p.opacity === 0));
  assert.ok(cloud(5).some((p) => p.opacity > 0));
  assert.ok(cloud(90).every((p) => p.opacity === 0));
});
test('old-world/reconnect effects use a bounded deterministic clock without frame history', () => {
  const launch = spaceportFlight('puddlewick', 2611787).launch;
  for (let t = 250; t < 338; t += 0.25) {
    const f = spaceportFlight('puddlewick', launch + t);
    assert.equal(f.elapsed, t);
    assert.deepEqual(cloud(f.elapsed), cloud(t));
    for (const p of cloud(t)) assert.ok(Object.values(p).every(Number.isFinite));
  }
});

test('launch has a long heavy-lift plume and a broad rolling cloud; landing stays restrained', () => {
  assert.equal(rocketExhaust(35).length, 320);
  assert.ok(rocketExhaust(295).length < 60);
  const puffs = cloud(20).filter((p) => p.opacity > 0.2);
  assert.ok(puffs.some((p) => p.size > 100));
  assert.ok(puffs.some((p) => Math.hypot(p.x, p.z) > 150));
});

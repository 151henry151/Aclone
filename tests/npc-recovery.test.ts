// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  failStep,
  blockedStep,
  allowSpeech,
  madeProgress,
  type Recovery,
} from '../src/server/npc/recovery.ts';
import type { Step } from '../src/server/npc/decision.ts';
const step: Step = { kind: 'travel', destination: 'b6' };

test('repeated failures back off and a recently failed step stays blocked through restart and incidental actions', () => {
  const r: Recovery = {};
  failStep(r, 10, step, 'No route');
  assert.ok(
    blockedStep(r, step, 11),
    'An unreachable route must cool down after the first failure',
  );
  failStep(r, 20, step, 'No route');
  assert.ok(r.retryAt! > 20);
  assert.ok(blockedStep(r, step, 21));
  const restored: Recovery = JSON.parse(JSON.stringify(r));
  assert.ok(blockedStep(restored, step, 22));
  madeProgress(restored);
  assert.equal(restored.retryAt, 0);
  assert.ok(
    blockedStep(restored, step, 22),
    'a different success does not erase this failed route',
  );
  assert.equal(blockedStep(restored, { kind: 'travel', destination: 'school' }, 22), undefined);
  assert.equal(blockedStep(restored, step, 1000), undefined);
});

test('changing failed waypoint coordinates slightly cannot evade suppression; history is bounded', () => {
  const r: Recovery = {};
  failStep(r, 10, { kind: 'move', x: 44, z: 104 }, 'No route');
  failStep(r, 20, { kind: 'move', x: 45, z: 105 }, 'No route');
  assert.ok(blockedStep(r, { kind: 'move', x: 46, z: 106 }, 21));
  for (let i = 0; i < 100; i++)
    failStep(r, 30 + i, { kind: 'travel', destination: 'bad-' + i }, 'No route');
  assert.ok(r.failures!.length <= 16);
  assert.ok(r.retryAt! - 129 <= 600);
});

test('autonomous duplicate speech is quiet but direct questions and different private recipients can be answered', () => {
  const r: Recovery = {};
  assert.equal(
    allowSpeech(r, 'I will walk to the mill and make flour.', undefined, 0, false),
    true,
  );
  assert.equal(
    allowSpeech(r, 'I will walk to the mill and make flour!', undefined, 10, false),
    false,
  );
  assert.equal(allowSpeech(r, 'I will walk to the mill and make flour.', 'alice', 11, false), true);
  assert.equal(allowSpeech(r, 'I will walk to the mill and make flour.', 'alice', 12, true), true);
  failStep(r, 15, step, 'No route');
  failStep(r, 20, step, 'No route');
  assert.equal(
    allowSpeech(r, 'Another announcement of the same broken plan.', undefined, 21, false),
    false,
  );
  assert.equal(allowSpeech(r, 'I am stuck and need another route.', 'alice', 22, true), true);
  madeProgress(r);
  assert.equal(allowSpeech(r, 'The mill has now produced flour.', undefined, 30, false), true);
});

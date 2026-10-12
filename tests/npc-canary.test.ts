// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CanaryClock, CanarySpend } from '../src/server/npc/canary.ts';
import type { Brain, BrainResult } from '../src/server/npc/decision.ts';
const result: BrainResult = {
  decision: {
    intent: 'Wait',
    notebook: '',
    speech: null,
    plan: [{ kind: 'wait', seconds: 10 }],
    repeat: 1,
    reconsiderSeconds: 10,
  },
  inputTokens: 10,
  outputTokens: 0,
};
const rates = { inputUsdPerMillion: 1, outputUsdPerMillion: 0 };
const request = { instructions: '', observation: {}, preparedBody: '{}' };

test('test-wide reservations bound concurrent calls and survive restoring a world', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-canary-'));
  try {
    const file = join(dir, 'spend.sqlite');
    let calls = 0;
    const inner: Brain = {
      decide: async () => {
        calls++;
        throw Error('connection lost');
      },
    };
    const s = new CanarySpend(file, 0.003, 0),
      b = s.wrap('mabel', inner, rates);
    await Promise.allSettled([
      b.decide(request, new AbortController().signal),
      b.decide(request, new AbortController().signal),
    ]);
    assert.equal(calls, 1);
    assert.equal(s.usage().usd, 0.00205);
    s.db.close();
    const resumed = new CanarySpend(file, 0.003, 0);
    await assert.rejects(
      resumed.wrap('mabel', inner, rates).decide(request, new AbortController().signal),
      /ceiling/,
    );
    assert.equal(calls, 1);
    resumed.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('completed usage replaces reservations; pre-dispatch cancellation costs nothing', async () => {
  const s = new CanarySpend(':memory:', 0.01, 0),
    b = s.wrap('mabel', { decide: async () => result }, rates);
  await b.decide(request, new AbortController().signal);
  assert.equal(s.usage().usd, 0.00001);
  const c = new AbortController();
  c.abort();
  await assert.rejects(b.decide(request, c.signal));
  assert.equal(s.usage().usd, 0.00001);
  s.db.close();
});
test('a result cannot arrive until its measured real latency has elapsed in simulation', async () => {
  let now = 1000,
    finish!: (r: BrainResult) => void,
    received = false;
  const clock = new CanaryClock(() => now),
    b = clock.wrap({ decide: () => new Promise((r) => (finish = r)) });
  const pending = b.decide(request, new AbortController().signal).then(() => (received = true));
  await new Promise((r) => setTimeout(r, 20));
  finish(result);
  await clock.synchronize();
  assert.equal(received, false);
  now += 100;
  await clock.synchronize();
  await pending;
  assert.equal(received, true);
  assert.equal(clock.pending, 0);
});
test('authentication and rate-limit failures stop additional paid attempts', async () => {
  const s = new CanarySpend(':memory:', 1, 0);
  let calls = 0;
  const b = s.wrap(
    'mabel',
    {
      decide: async () => {
        calls++;
        throw Error('AI provider HTTP 429');
      },
    },
    rates,
  );
  await assert.rejects(b.decide(request, new AbortController().signal));
  await assert.rejects(b.decide(request, new AbortController().signal));
  assert.equal(calls, 1);
  s.db.close();
});

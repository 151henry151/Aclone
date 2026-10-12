// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import { inventHypotheses } from '../src/server/npc/hypotheses.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';
test('large earned investment returns produce a schema-valid bounded collection', () => {
  const w = createWorld('test', 'Test', 'server'),
    p = addPlayer(w, 'investor', 'Investor');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.owner = 'someone';
  b.investment = 100000;
  b.watermark = 30000;
  b.stakes = [{ investor: p.id, principal: 25000, claim: 27000, paid: 0, opened: w.time }];
  const choices = inventHypotheses(w, p, { plan: [], index: 0 } as unknown as ResidentState);
  const c = choices.find((c) => c.description.includes('earned return'));
  assert.ok(c);
  assert.doesNotThrow(() =>
    new JevBrain('fake', 'test').prepare({ instructions: 'test', observation: { choices } }),
  );
  p.x = b.x;
  p.z = b.z;
  const cash = p.cash;
  for (const s of c.plan) if (s.kind === 'act') act(w, p.id, s.action);
  assert.equal(p.cash, cash + 27000);
  assert.equal(b.investment, 73000);
  assert.deepEqual(b.stakes, [], 'fully paid claim is retired in one transfer');
});
test('one malformed candidate cannot prevent a valid choice from reaching the planner', () => {
  const brain = new JevBrain('fake', 'test');
  const valid = { id: 'rest', description: 'Wait briefly', plan: [{ kind: 'wait', seconds: 30 }] };
  const malformed = {
    id: 'bad',
    description: 'Private player detail',
    plan: [{ kind: 'wait', seconds: 0 }],
  };
  const prepared = brain.prepare({
    instructions: 'test',
    observation: { choices: [malformed, valid] },
  });
  const o = prepared.observation as Record<string, unknown>;
  assert.deepEqual(o.choices, [valid]);
  assert.ok((o.planningWarnings as string[]).length);
  assert.ok(!JSON.stringify(o.planningWarnings).includes('Private'));
  assert.deepEqual(Object.keys(JSON.parse(prepared.preparedBody!).questions.next_action.criteria), [
    'rest',
  ]);
});

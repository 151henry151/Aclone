// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { businessHealth } from '../src/shared/business-health.ts';
import { accounts, recordMoney, cashFlow } from '../src/shared/reports.ts';
import { economyChoices } from '../src/server/npc/economy-choices.ts';
import type { Step } from '../src/server/npc/decision.ts';

test('financing and investor withdrawals are not operating losses or sales', () => {
  const w = createWorld('health', 'Health', 'server'),
    b = w.buildings.find((b) => b.kind === 'bank')!;
  for (const [from, to, reason, amount] of [
    ['player', b.id, 'investment', 10000],
    [b.id, 'player', 'investor return', 500],
    [b.id, 'player', 'loan disbursement', 5000],
    ['player', b.id, 'loan repayment', 5500],
  ] as const)
    recordMoney(w, { id: 1, kind: 'transfer', time: w.time, from, to, reason, amount });
  const a = accounts(w, b);
  assert.equal(cashFlow(a), 0);
  assert.equal(a.financingIn, 5500);
  assert.equal(a.financingOut, 5000);
  assert.equal(a.capitalOut, 500);
});
for (const population of [2, 5, 19])
  test(`${population} residents: unfunded jobs and congested inputs cannot bypass reserves`, () => {
    const w = createWorld('health', 'Health', 'server');
    const residents = Array.from({ length: population }, (_, i) =>
      addPlayer(w, `p${i}`, `Player ${i}`),
    );
    const b = w.buildings.find((b) => b.kind === 'mill')!;
    b.owner = residents[0].id;
    b.investment = 0;
    b.stock = { wheat: 0, flour: b.capacity };
    b.accounts = accounts(w, b);
    b.accounts.since = 0;
    w.time = 7200;
    const health = businessHealth(w, b);
    assert.equal(health.outputRoom, 0);
    assert.ok(health.messages.some((m) => m.includes('no output sales')));
    for (const p of residents) {
      p.skills = ['miller'];
      p.cash = 100;
      p.inventory = {};
      const plans: Step[][] = [];
      economyChoices(
        w,
        p,
        [b],
        (_, plan) => plans.push(plan),
        (_, steps) => steps,
      );
      assert.ok(
        !plans
          .flat()
          .some((s) => s.kind === 'act' && ['job', 'work', 'investment'].includes(s.action.type)),
      );
    }
  });

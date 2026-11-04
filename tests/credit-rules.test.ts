// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';
import { creditProfile, loanQuote, LOAN_MONTH, type Loan } from '../src/shared/loans';
import { Store } from '../src/server/store';
const defaults = {
  creditScoreMinimum: 300,
  creditScoreMaximum: 850,
  creditScoreInitial: 550,
  creditHistoryMonthlyPoints: 3,
  creditHistoryMaximum: 60,
  creditOnTimePoints: 6,
  creditOnTimeMaximum: 120,
  creditEmploymentPoints: 60,
  creditAssetUnit: 50000,
  creditAssetMaximum: 35,
  creditLatePoints: 25,
  creditDefaultPoints: 100,
  creditPenaltyMaximum: 220,
  creditDebtPoints: 100,
  creditDebtMaximum: 100,
  creditDebtDenominatorMinimum: 10000,
};
function setup() {
  const w = createWorld('credit', 'Credit', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    bank = makeBuilding('bank', 'bank', 0, 0),
    home = makeBuilding('home', 'home', 30, 0);
  home.owner = p.id;
  home.condition = 100;
  bank.investment = 1000000;
  w.buildings = [bank, home];
  w.time = 4 * LOAN_MONTH;
  Object.assign(p, {
    cash: 20000,
    bank: 0,
    x: 0,
    z: 0,
    credit: {
      since: 0,
      observedSeconds: 100,
      employedSeconds: 50,
      onTime: 2,
      late: 1,
      defaults: 0,
      income: [],
    },
    loans: [
      {
        id: 'old',
        bank: bank.id,
        original: 10000,
        principal: 10000,
        interest: 0,
        fraction: 0,
        apr: 0.1,
        payment: 1000,
        months: 12,
        issued: 0,
        lastInterest: w.time,
        nextDue: w.time + LOAN_MONTH,
        billed: 0,
        due: 0,
        autoPay: false,
        status: 'active',
      } satisfies Loan,
    ],
  });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  return { w, p, bank, home, edit, score: () => creditProfile(w, p).score };
}
test('credit defaults and missing keys preserve the exact historical score table', () => {
  const { w, p, score } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  assert.equal(score(), 570); // 550+12+12+30+1-25-10
  const before = creditProfile(w, p);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.deepEqual(creditProfile(w, p), before);
});
test('each configurable score component and cap contributes without rewriting history', () => {
  const { w, p, edit, score } = setup(),
    record = structuredClone(p.credit),
    loan = structuredClone(p.loans);
  edit({
    creditScoreMinimum: 100,
    creditScoreMaximum: 900,
    creditScoreInitial: 600,
    creditHistoryMonthlyPoints: 5,
    creditHistoryMaximum: 17,
    creditOnTimePoints: 10,
    creditOnTimeMaximum: 15,
    creditEmploymentPoints: 80,
    creditAssetUnit: 20000,
    creditAssetMaximum: 3,
    creditLatePoints: 7,
    creditDefaultPoints: 40,
    creditPenaltyMaximum: 30,
    creditDebtPoints: 50,
    creditDebtMaximum: 8,
    creditDebtDenominatorMinimum: 200000,
  });
  assert.equal(score(), 665); // 600+17+15+40+3-7-3
  assert.deepEqual(p.credit, record);
  assert.deepEqual(p.loans, loan);
  p.credit!.defaults = 1;
  assert.equal(score(), 642); // combined penalty capped at 30
  edit({ creditPenaltyMaximum: 100 });
  assert.equal(score(), 625); // 7+40 penalty
  p.loans![0].principal = 100000;
  assert.equal(score(), 620); // debt penalty capped at 8
  edit({ creditDebtMaximum: 100 });
  assert.equal(score(), 603); // uncapped debt penalty 25
  edit({ creditDebtDenominatorMinimum: 1 });
  assert.equal(score(), 578); // ratio against actual 100,000 assets+cash
  edit({ creditAssetMaximum: 100 });
  assert.equal(score(), 579); // four asset points
  edit({ creditHistoryMaximum: 100, creditOnTimeMaximum: 100 });
  assert.equal(score(), 587); // +3 history,+5 on-time
});
test('zero weights disable contributions, bounds clamp scores and rate distance follows maximum', () => {
  const { w, p, bank, edit, score } = setup();
  edit({
    creditHistoryMonthlyPoints: 0,
    creditOnTimePoints: 0,
    creditEmploymentPoints: 0,
    creditAssetMaximum: 0,
    creditLatePoints: 0,
    creditDefaultPoints: 0,
    creditDebtPoints: 0,
  });
  assert.equal(score(), 550);
  edit({ creditScoreMaximum: 600, creditScoreInitial: 600 });
  assert.equal(score(), 600);
  assert.equal(loanQuote(w, p, bank, 1000, 12).apr, 0.1);
  edit({ creditOnTimePoints: 1000 });
  assert.equal(score(), 600);
  edit({
    creditScoreMinimum: 400,
    creditLatePoints: 1000,
    creditPenaltyMaximum: 1000,
    creditOnTimePoints: 0,
  });
  assert.equal(score(), 400);
  assert.match(creditProfile(w, p).explanation, /400–600/);
});
test('score edits validate combined bounds and integer divisors atomically', () => {
  const { w, edit } = setup();
  for (const patch of [
    { creditScoreMinimum: 551 },
    { creditScoreMaximum: 549 },
    { creditScoreInitial: 851 },
    { creditHistoryMonthlyPoints: 1.5 },
    { creditOnTimeMaximum: -1 },
    { creditDebtPoints: 1001 },
    { creditAssetUnit: 0 },
    { creditDebtDenominatorMinimum: 100000001 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({
    creditScoreMinimum: 50,
    creditScoreInitial: 100,
    creditScoreMaximum: 150,
    creditAssetUnit: 100000000,
  });
});
test('credit rules appear in editor, summary, design, bank UI and saved state', async () => {
  const { w, p, bank, edit } = setup();
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { bankLoans } = await import('../src/client/bank'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  edit({ creditScoreMinimum: 100, creditScoreMaximum: 900, creditScoreInitial: 700 });
  assert.match(rulesSummary(w), /100–900/);
  assert.match(bankLoans(w, p, bank), /720 \/ 900/);
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const k of Object.keys(defaults)) {
      assert.equal((loaded.settings as any)[k], (w.settings as any)[k]);
      assert.equal((dest.settings as any)[k], (w.settings as any)[k]);
    }
    assert.deepEqual(creditProfile(loaded, loaded.players[p.id]), creditProfile(w, p));
    assert.deepEqual(loaded.players[p.id].loans, p.loans);
  } finally {
    store.close();
  }
});

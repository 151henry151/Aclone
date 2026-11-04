// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { loanQuote } from '../src/shared/loans';
import { businessEstimate, enterpriseChoices } from '../src/server/npc/enterprise';
import { productionBudget } from '../src/server/npc/business-policy';
import { Store } from '../src/server/store';
const defaults = {
  loanLiquidityReserve: 20000,
  loanIncomePaymentShare: 0.35,
  loanLiquidPaymentDivisor: 2,
  loanPersonalLimit: 100000,
  loanIncomeBorrowingMonths: 6,
  loanLiquidBorrowingShare: 0.5,
  loanMinimumAmount: 1000,
  loanMaximumAmount: 10000000,
  npcLoanMinimumShortfall: 1000,
  npcLoanMaximumShortfall: 10000,
  npcLoanPaymentBuffer: 3,
  npcLoanProfitBatches: 20,
};
function setup() {
  const w = createWorld('finance', 'Finance', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  Object.assign(p, { cash: 0, bank: 200000, hunger: 0, thirst: 0, fuel: 100 });
  const b = w.buildings.find((b) => b.kind === 'mill')!,
    bank = w.buildings.find((b) => b.kind === 'bank')!;
  b.owner = p.id;
  b.stock = { wheat: 20 };
  b.wage = 2200;
  b.investment = productionBudget(w, b)!.reserve - 5000;
  bank.investment = 250000;
  Object.assign(p, { x: bank.x, z: bank.z });
  return {
    w,
    p,
    b,
    bank,
    edit: (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch }),
    plan: () => enterpriseChoices(w, p).find((c) => c.description.startsWith('Finance my')),
  };
}
test('loan affordability defaults and absent keys retain exact quotes and resident finance plans', () => {
  const { w, p, b, bank, plan } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v, k);
  const q = loanQuote(w, p, bank, 5000, 12),
    choice = plan();
  assert.ok(q.approved, q.reasons.join(' '));
  assert.ok(choice);
  assert.equal(q.capacity, 7500);
  assert.equal(q.limit, 90000);
  assert.ok(businessEstimate(w, b)!.margin > 0);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.deepEqual(loanQuote(w, p, bank, 5000, 12), q);
  assert.deepEqual(plan(), choice);
});
test('liquidity income and unsecured policies change the actual quote formulas independently', () => {
  const { w, p, bank, edit } = setup();
  p.credit = {
    since: w.time,
    observedSeconds: 0,
    employedSeconds: 0,
    onTime: 0,
    late: 0,
    defaults: 0,
    income: [{ month: 0, amount: 20000 }],
  };
  w.time = 0;
  edit({
    loanLiquidityReserve: 100000,
    loanIncomePaymentShare: 0.2,
    loanLiquidPaymentDivisor: 4,
    loanIncomeBorrowingMonths: 2,
    loanLiquidBorrowingShare: 0.1,
    loanPersonalLimit: 1000000,
  });
  const q = loanQuote(w, p, bank, 5000, 12);
  assert.equal(q.monthlyIncome, 10000);
  assert.equal(q.capacity, 4083);
  assert.equal(q.limit, 30000);
  edit({ loanPersonalLimit: 7000 });
  assert.equal(loanQuote(w, p, bank, 5000, 12).limit, 7000);
  edit({
    loanIncomePaymentShare: 0,
    loanLiquidBorrowingShare: 0,
    loanIncomeBorrowingMonths: 0,
    loanLiquidityReserve: 200000,
  });
  const empty = loanQuote(w, p, bank, 5000, 12);
  assert.equal(empty.capacity, 0);
  assert.equal(empty.limit, 0);
  assert.equal(empty.approved, false);
});
test('amount bounds govern bank input and refusal while zero personal limit preserves signed repayment', async () => {
  const { w, p, bank, edit } = setup();
  edit({ loanMinimumAmount: 2000, loanMaximumAmount: 8000 });
  const { bankLoans } = await import('../src/client/bank');
  assert.match(bankLoans(w, p, bank), /min="20" max="80"[^>]*value="80"/);
  assert.match(loanQuote(w, p, bank, 1000, 12).reasons.join(' '), /20d.*80d/);
  assert.equal(loanQuote(w, p, bank, 8001, 12).approved, false);
  const q = loanQuote(w, p, bank, 5000, 12);
  assert.ok(q.approved);
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'borrow',
    amount: 5000,
    months: 12,
    apr: q.apr,
    payment: q.payment,
    accepted: true,
  });
  const signed = structuredClone(p.loans![0]);
  edit({ loanPersonalLimit: 0, loanMinimumAmount: 1, loanMaximumAmount: 1 });
  assert.deepEqual(p.loans![0], signed);
  const before = JSON.stringify(w);
  assert.throws(() =>
    act(w, p.id, {
      type: 'loan',
      building: bank.id,
      operation: 'borrow',
      amount: 5000,
      months: 12,
      apr: q.apr,
      payment: q.payment,
      accepted: true,
    }),
  );
  assert.equal(JSON.stringify(w), before);
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'repay',
    loan: signed.id,
    amount: 5000,
  });
  assert.equal(p.loans![0].status, 'paid');
});
test('resident finance uses shortfall bounds and a strict configurable payment to profit test', () => {
  const { w, p, b, bank, edit, plan } = setup();
  assert.ok(plan());
  edit({ npcLoanMinimumShortfall: 5001 });
  assert.equal(plan(), undefined);
  edit({ npcLoanMinimumShortfall: 0, npcLoanMaximumShortfall: 4999 });
  assert.equal(plan(), undefined);
  edit({ npcLoanMaximumShortfall: 5000, npcLoanProfitBatches: 1 });
  const q = loanQuote(w, p, bank, 5000, 12),
    margin = businessEstimate(w, b)!.margin;
  assert.ok(margin / q.payment >= 1 && margin / q.payment < 1000);
  edit({ npcLoanPaymentBuffer: margin / q.payment });
  assert.equal(plan(), undefined, 'equality is not affordable');
  edit({ npcLoanPaymentBuffer: 1 });
  assert.ok(plan());
  edit({ npcLoanProfitBatches: 0 });
  assert.equal(plan(), undefined);
  edit({ npcLoanProfitBatches: 20, npcLoanMaximumShortfall: 0 });
  assert.equal(plan(), undefined);
  edit({ npcLoanMaximumShortfall: 10000 });
  b.investment = productionBudget(w, b)!.reserve;
  assert.equal(plan(), undefined, 'never propose a zero-value loan');
});
test('resident financing still needs approval funding and a permissible deposit', () => {
  const { w, p, bank, edit, plan } = setup();
  assert.ok(plan());
  edit({ cashTransferLimit: 4999 });
  assert.equal(plan(), undefined, 'planned deposit must be executable');
  edit({ cashTransferLimit: 100000000, loanPersonalLimit: 0 });
  assert.equal(plan(), undefined);
  edit({ loanPersonalLimit: 100000 });
  bank.investment = 0;
  assert.equal(plan(), undefined);
  bank.investment = 250000;
  const q = loanQuote(w, p, bank, 5000, 12);
  act(w, p.id, {
    type: 'loan',
    building: bank.id,
    operation: 'borrow',
    amount: 5000,
    months: 12,
    apr: q.apr,
    payment: q.payment,
    accepted: true,
  });
  p.cash = 0;
  assert.equal(plan(), undefined, 'do not stack resident finance loans');
});
test('finance fields validate jointly and survive summaries observations designs and reload', async () => {
  const { w, p, edit } = setup();
  for (const patch of [
    { loanMinimumAmount: 10000001 },
    { loanMaximumAmount: 999 },
    { loanLiquidPaymentDivisor: 0 },
    { loanIncomePaymentShare: 1.01 },
    { loanPersonalLimit: -1 },
    { npcLoanMinimumShortfall: 10001 },
    { npcLoanProfitBatches: -1 },
    { npcLoanPaymentBuffer: 0 },
    { npcLoanMaximumShortfall: 0.5 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  const patch = {
    loanLiquidityReserve: 12345,
    loanIncomePaymentShare: 0.27,
    loanLiquidPaymentDivisor: 7,
    loanPersonalLimit: 23456,
    loanIncomeBorrowingMonths: 9,
    loanLiquidBorrowingShare: 0.37,
    loanMinimumAmount: 111,
    loanMaximumAmount: 2222222,
    npcLoanMinimumShortfall: 222,
    npcLoanMaximumShortfall: 33333,
    npcLoanPaymentBuffer: 4,
    npcLoanProfitBatches: 31,
  };
  edit(patch);
  const { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { observe } = await import('../src/server/npc/observation'),
    { NpcMemory } = await import('../src/server/npc/memory');
  const summary = rulesSummary(w),
    html = settingsFields(),
    dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const observation = observe(
      w,
      p,
      {
        playerId: p.id,
        world: w.id,
        name: p.name,
        personality: 'Helpful',
        notebook: '',
        intent: '',
        cursor: 0,
        nextAt: 0,
        plan: [],
        index: 0,
        repeats: 0,
        until: 0,
        waitUntil: 0,
        status: 'Ready',
        errors: 0,
      },
      new NpcMemory(store),
      'resident',
    );
    for (const [key, value] of Object.entries(patch)) {
      assert.ok(html.includes(`name="${key}"`), key);
      assert.ok(summary.includes(String(value)), key);
      assert.equal((dest.settings as any)[key], value);
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((observation.worldRules as any)[key], value);
    }
  } finally {
    store.close();
  }
});

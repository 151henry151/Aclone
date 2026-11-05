// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import {
  loanQuote,
  creditProfile,
  recordCreditIncome,
  advanceLoans,
  LOAN_MONTH,
} from '../src/shared/loans';
import { propertyQuote, PROPERTY_YEAR } from '../src/shared/property';
import { DAY_SECONDS } from '../src/shared/environment';
import { Store } from '../src/server/store';
const custom = {
  calendarYearDays: 120,
  calendarSpringDay: 10,
  calendarSpringDays: 30,
  calendarSummerDays: 40,
  calendarAutumnDays: 30,
};
function setup() {
  const w = createWorld('calendar-finance', 'Calendar finance', 'owner');
  w.script = '';
  const p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1000000;
  p.bank = 200000;
  const bank = w.buildings.find((b) => b.kind === 'bank')!;
  bank.investment = 2000000;
  p.x = bank.x;
  p.z = bank.z;
  return { w, p, bank };
}
const patch = (w: ReturnType<typeof setup>['w'], values: Record<string, number>) =>
  act(w, 'owner', { type: 'settings', patch: values });
function borrow({ w, p, bank }: ReturnType<typeof setup>, periodSeconds: number) {
  const q = loanQuote(w, p, bank, 10000, 12);
  assert.ok(q.approved, q.reasons.join(' '));
  act(w, p.id, {
    type: 'loan',
    operation: 'borrow',
    building: bank.id,
    amount: 10000,
    months: 12,
    apr: q.apr,
    payment: q.payment,
    periodSeconds,
    accepted: true,
    autoPay: false,
  });
  return p.loans!.at(-1)!;
}

test('estate annual discounts and new bank quotes use the configured year', () => {
  const f = setup(),
    { w, p, bank } = f;
  patch(w, custom);
  const estate = w.buildings.find((b) => b.kind === 'mill')!;
  delete estate.owner;
  estate.estate = { since: 0, base: 100000 };
  estate.stock = {};
  estate.investment = 0;
  w.settings.estateAnnualDiscount = 0.1;
  w.settings.estateEquityShare = 0;
  w.time = 120 * DAY_SECONDS;
  assert.equal(propertyQuote(w, estate).years, 1);
  assert.equal(propertyQuote(w, estate).total, 90000);
  const q = loanQuote(w, p, bank, 10000, 12);
  assert.equal(q.periodSeconds, 6000);
  const loan = borrow(f, 6000);
  assert.equal(loan.periodSeconds, 6000);
  assert.equal(loan.nextDue, w.time + 6000);
  assert.equal(PROPERTY_YEAR, 365 * DAY_SECONDS);
  assert.equal(LOAN_MONTH, PROPERTY_YEAR / 12);
});

test('stale period quotes fail atomically and old signed/legacy loans keep their timing', () => {
  const f = setup(),
    { w, p, bank } = f;
  const old = borrow(f, LOAN_MONTH);
  delete old.periodSeconds;
  const quote = loanQuote(w, p, bank, 10000, 12),
    oldState = structuredClone(old);
  patch(w, custom);
  assert.deepEqual(old, oldState);
  const before = structuredClone(w);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'loan',
        operation: 'borrow',
        building: bank.id,
        amount: 10000,
        months: 12,
        apr: quote.apr,
        payment: quote.payment,
        periodSeconds: LOAN_MONTH,
        accepted: true,
      }),
    /terms|quote|period/i,
  );
  assert.deepEqual(w, before);
  const recent = borrow(f, 6000);
  const recentState = structuredClone(recent);
  patch(w, { calendarYearDays: 240 });
  assert.deepEqual(recent, recentState);
  advanceLoans(w, p, 0, 6000);
  w.time = 6000;
  assert.equal(old.billed, 0);
  assert.equal(old.nextDue, LOAN_MONTH);
  assert.equal(recent.billed, 1);
  assert.equal(recent.nextDue, 12000);
  assert.equal(recent.interest, Math.floor((recent.original * recent.apr) / 12));
  assert.equal(old.interest, Math.floor((old.original * old.apr * 6000) / PROPERTY_YEAR));
  advanceLoans(w, p, 6000, 9000);
  w.time = 9000;
  assert.equal(recent.lateReported, true);
  assert.equal(old.lateReported, undefined);
  advanceLoans(w, p, 9000, 24000);
  w.time = 24000;
  assert.equal(recent.status, 'default');
  assert.equal(old.status, 'active');
});

test('credit buckets retain their cadence and mixed-period obligations normalize to the new quote month', () => {
  const f = setup(),
    { w, p } = f;
  recordCreditIncome(w, p.id, 20000, 'wage');
  const old = borrow(f, LOAN_MONTH);
  const originalIncome = structuredClone(p.credit!.income),
    originalProfile = creditProfile(w, p);
  patch(w, custom);
  const next = creditProfile(w, p);
  assert.deepEqual(p.credit!.income, originalIncome);
  assert.equal(next.monthlyIncome, Math.floor((originalProfile.monthlyIncome * 6000) / LOAN_MONTH));
  assert.equal(next.payments, Math.ceil((old.payment * 6000) / LOAN_MONTH));
  assert.equal(next.score, originalProfile.score);
  const recent = borrow(f, 6000);
  assert.equal(
    creditProfile(w, p).payments,
    Math.ceil((old.payment * 6000) / LOAN_MONTH + recent.payment),
  );
  w.time = 6000;
  recordCreditIncome(w, p.id, 10000, 'wage');
  assert.equal(p.credit!.income.length, 1, 'old bucket has not ended');
  assert.equal(p.credit!.income[0].amount, 30000);
  const newcomer = addPlayer(w, 'new', 'New');
  recordCreditIncome(w, newcomer.id, 100, 'wage');
  assert.equal(newcomer.credit!.periodSeconds, 6000);
});

test('signed periods persist through save/reload and are shown in bank offers and debt status', async () => {
  const f = setup(),
    { w, p, bank } = f;
  patch(w, custom);
  const loan = borrow(f, 6000);
  patch(w, { calendarYearDays: 240 });
  const { bankLoans, bankQuote } = await import('../src/client/bank'),
    { loanStatusHtml } = await import('../src/client/debt-status');
  assert.match(bankLoans(w, p, bank), /3\.33 real hours/);
  assert.match(bankQuote(w, p, bank, 10000, 12), /name="periodSeconds" value="12000"/);
  assert.match(loanStatusHtml(w, p, loan), /1\.67 real hours/);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    assert.equal(restored.players[p.id].loans![0].periodSeconds, 6000);
    const copy = restored.players[p.id];
    advanceLoans(restored, copy, 0, 6000);
    assert.equal(copy.loans![0].billed, 1);
    assert.equal(copy.loans![0].nextDue, 12000);
  } finally {
    store.close();
  }
});

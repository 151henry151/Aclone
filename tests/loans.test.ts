// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, log } from '../src/shared/simulation.ts';
import { loanQuote, creditProfile, LOAN_MONTH, amortizedPayment } from '../src/shared/loans.ts';
import { businessEstimate, enterpriseChoices } from '../src/server/npc/enterprise.ts';
import { operation } from '../src/server/npc/player-operations.ts';
import { propertyQuote } from '../src/shared/property.ts';
function setup() {
  const w = createWorld('puddlewick', 'Town', 'server');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'borrower', 'Borrower');
  p.cash = 1000000;
  p.bank = 200000;
  const b = w.buildings.find((b) => b.kind === 'bank')!;
  b.investment = 2000000;
  p.x = b.x;
  p.z = b.z;
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  const borrow = (amount = 100000, months = 12, collateral?: string, autoPay = true) => {
    const q = loanQuote(w, p, b, amount, months, collateral);
    assert.equal(q.approved, true, q.reasons.join(' '));
    act(w, p.id, {
      type: 'loan',
      building: b.id,
      operation: 'borrow',
      amount,
      months,
      collateral,
      apr: q.apr,
      payment: q.payment,
      accepted: true,
      autoPay,
    });
    return p.loans!.at(-1)!;
  };
  return { w, p, b, home, borrow };
}
test('quotes use amortization, affordability, fixed terms, collateral and finite bank capital', () => {
  assert.equal(amortizedPayment(100000, 0.12, 12), 8885);
  const { w, p, b, home } = setup();
  const unsecured = loanQuote(w, p, b, 100000, 12),
    mortgage = loanQuote(w, p, b, 10000, 12, home.id);
  assert.ok(mortgage.apr < unsecured.apr);
  assert.ok(mortgage.approved);
  assert.equal(loanQuote(w, p, b, home.price, 12, home.id).approved, false, '75% LTV cap');
  b.investment = 0;
  assert.equal(loanQuote(w, p, b, 10000, 12).approved, false);
  const before = JSON.stringify(w);
  assert.throws(() =>
    act(w, p.id, {
      type: 'loan',
      building: b.id,
      operation: 'borrow',
      amount: 10000,
      months: 12,
      accepted: true,
      apr: 0.01,
      payment: 1,
    }),
  );
  assert.equal(JSON.stringify(w), before);
});
test('automatic savings payments amortize to zero, conserve money and persist credit history', () => {
  const { w, p, b, borrow } = setup();
  const total = p.cash + p.bank + b.investment;
  const l = borrow();
  assert.equal(p.cash + p.bank + b.investment, total);
  p.online = false;
  for (let month = 0; month < 12; month++) advance(w, LOAN_MONTH);
  assert.equal(l.status, 'paid');
  assert.equal(l.principal, 0);
  assert.equal(l.interest, 0);
  assert.equal(p.cash + p.bank + b.investment, total);
  assert.equal(p.credit!.onTime, 12);
  assert.ok(creditProfile(w, p).score > 550);
  assert.equal(p.deaths, 0);
});
test('early repayment charges elapsed interest, releases collateral and does not reward payment spam', () => {
  const { w, p, b, home, borrow } = setup();
  const l = borrow(10000, 12, home.id);
  assert.ok(home.lien);
  assert.throws(() => {
    p.x = home.x;
    p.z = home.z;
    act(w, p.id, { type: 'listProperty', building: home.id, price: 10000 });
  }, /mortgage/);
  assert.throws(() => act(w, p.id, { type: 'demolish', building: home.id }), /mortgage/);
  p.x = b.x;
  p.z = b.z;
  advance(w, LOAN_MONTH / 2);
  assert.ok(l.interest > 0);
  act(w, p.id, { type: 'loan', building: b.id, operation: 'repay', loan: l.id, amount: 100000 });
  assert.equal(l.status, 'paid');
  assert.equal(home.lien, undefined);
  assert.equal(p.credit!.onTime, 0);
});
test('late payments have a grace period; foreclosure sale repays bank and returns surplus', () => {
  const { w, p, b, home, borrow } = setup();
  const l = borrow(10000, 12, home.id, false);
  advance(w, LOAN_MONTH);
  assert.equal(p.credit!.late, 0);
  assert.ok(l.due > 0);
  assert.equal(home.owner, p.id);
  advance(w, LOAN_MONTH / 2);
  assert.equal(p.credit!.late, 1);
  assert.equal(l.status, 'active');
  advance(w, LOAN_MONTH * 2.5);
  assert.equal(l.status, 'foreclosed');
  assert.equal(home.owner, undefined);
  assert.equal(p.credit!.defaults, 1);
  const buyer = addPlayer(w, 'buyer', 'Buyer');
  buyer.cash = 1000000;
  buyer.x = home.x;
  buyer.z = home.z;
  const price = propertyQuote(w, home).total,
    balance = l.principal + l.interest,
    oldCash = p.cash,
    capital = b.investment;
  act(w, buyer.id, { type: 'buyBuilding', building: home.id });
  assert.equal(l.status, 'paid');
  assert.equal(b.investment, capital + balance);
  assert.equal(p.cash, oldCash + price - balance);
  assert.equal(home.owner, buyer.id);
  assert.equal(home.lien, undefined);
});
test('death cannot erase debt or pledged stores, and personal credit remains private in public snapshots', async () => {
  const { w, p, home, borrow } = setup();
  const l = borrow(10000, 12, home.id, false);
  home.stock = { bread: 2 };
  home.investment = 5000;
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
  assert.equal(l.status, 'foreclosed');
  assert.equal(home.stock.bread, 2);
  assert.equal(home.investment, 5000);
  assert.ok(home.lien);
  assert.equal(p.deaths, 1);
  const { prepareFrame, privatePlayer } = await import('../src/server/snapshots.ts');
  p.online = true;
  const visible = JSON.parse(prepareFrame(w).players[p.id]);
  assert.equal(visible.credit, undefined);
  assert.equal(visible.loans, undefined);
  assert.equal(privatePlayer(w, p).loans![0].id, l.id);
});
test('credit rewards observed employment and verified income, not cash transfers or new loans', () => {
  const { w, p } = setup();
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.job = b.id;
  b.employees = [p.id];
  p.activeUntil = w.time + LOAN_MONTH;
  const before = creditProfile(w, p).score;
  advance(w, 1000);
  assert.equal(creditProfile(w, p).employment, 1);
  assert.ok(creditProfile(w, p).score > before);
  log(w, 'transfer', 10000, 'friend', p.id, 'gift');
  assert.equal(creditProfile(w, p).monthlyIncome, 0);
  log(w, 'transfer', 10000, b.id, p.id, 'wage');
  assert.equal(creditProfile(w, p).monthlyIncome, 5000);
});
test('loan balances catch up identically in one long step or many short ones', () => {
  const a = setup(),
    b = setup();
  a.borrow();
  b.borrow();
  advance(a.w, LOAN_MONTH * 2);
  for (let i = 0; i < 120; i++) advance(b.w, LOAN_MONTH / 60);
  assert.equal(a.p.loans![0].principal, b.p.loans![0].principal);
  assert.equal(a.p.loans![0].interest, b.p.loans![0].interest);
  assert.equal(a.p.bank, b.p.bank);
});

test('foreclosure dating is independent of restart catch-up step size', () => {
  const a = setup(),
    b = setup();
  a.borrow(10000, 12, a.home.id, false);
  b.borrow(10000, 12, b.home.id, false);
  advance(a.w, LOAN_MONTH * 6);
  for (let i = 0; i < 12; i++) advance(b.w, LOAN_MONTH / 2);
  assert.equal(a.home.estate!.since, b.home.estate!.since);
  assert.equal(a.p.loans![0].principal, b.p.loans![0].principal);
  assert.equal(a.p.loans![0].interest, b.p.loans![0].interest);
});

test('an owner short of working capital can be offered a bank loan without crashing the planner', () => {
  const w = createWorld('loan-plan', 'Town', 'owner');
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'npc', 'Owner');
  p.cash = 20000;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  mill.stock = { wheat: 20 };
  mill.wage = 2200;
  const estimate = businessEstimate(w, mill)!;
  assert.ok(estimate.margin > 0);
  mill.investment = Math.max(0, estimate.reserve - 5000);
  const bank = w.buildings.find((b) => b.kind === 'bank')!;
  bank.investment = 250000;
  assert.doesNotThrow(() =>
    operation('loan', { building: bank.id, operation: 'repay', loan: 'l1', amount: 1000 }),
  );
  assert.doesNotThrow(() =>
    operation('loan', {
      building: bank.id,
      operation: 'borrow',
      amount: 5000,
      months: 12,
      apr: 0.12,
      payment: 444,
      accepted: true,
      autoPay: true,
    }),
  );
  assert.doesNotThrow(() => enterpriseChoices(w, p));
});

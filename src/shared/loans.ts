// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog.ts';
import { PROPERTY_YEAR, releaseEstate } from './property.ts';
import { log } from './simulation.ts';
import { say } from './messages.ts';
import type { World, Player, Building, Action } from './types.ts';
export const LOAN_MONTH = PROPERTY_YEAR / 12;
export interface CreditRecord {
  since: number;
  observedSeconds: number;
  employedSeconds: number;
  onTime: number;
  late: number;
  defaults: number;
  income: { month: number; amount: number }[];
}
export interface Loan {
  id: string;
  bank: string;
  original: number;
  principal: number;
  interest: number;
  fraction: number;
  apr: number;
  payment: number;
  months: number;
  issued: number;
  lastInterest: number;
  nextDue: number;
  billed: number;
  due: number;
  lateSince?: number;
  lateReported?: boolean;
  autoPay: boolean;
  collateral?: string;
  status: 'active' | 'default' | 'foreclosed' | 'paid';
}
const check = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
export function creditRecord(w: World, p: Player): CreditRecord {
  return (p.credit ??= {
    since: w.time,
    observedSeconds: 0,
    employedSeconds: 0,
    onTime: 0,
    late: 0,
    defaults: 0,
    income: [],
  });
}
export function recordCreditIncome(w: World, id: string, amount: number, reason: string) {
  const p = w.players[id];
  if (!p || !(reason === 'wage' || reason === 'labour task' || reason === 'harvest wage')) return;
  const c = creditRecord(w, p),
    month = Math.floor(w.time / LOAN_MONTH);
  c.income = c.income.filter((v) => v.month >= month - 2);
  const entry = c.income.find((v) => v.month === month);
  if (entry) entry.amount += amount;
  else c.income.push({ month, amount });
}
export function creditProfile(w: World, p: Player) {
  const c = p.credit;
  const loans = (p.loans ?? []).filter((l) => l.status !== 'paid');
  const debt = loans.reduce((n, l) => n + l.principal + l.interest, 0);
  const assets = w.buildings
    .filter((b) => b.owner === p.id && !b.government && !b.construction)
    .reduce((n, b) => n + ((buildings[b.kind]?.price ?? 0) * Math.max(0, b.condition)) / 100, 0);
  const employment = c?.observedSeconds ? Math.min(1, c.employedSeconds / c.observedSeconds) : 0;
  const history = c ? Math.min(60, Math.floor((w.time - c.since) / LOAN_MONTH) * 3) : 0;
  const punctual = Math.min(120, (c?.onTime ?? 0) * 6);
  const stability = Math.round(employment * 60) + Math.min(35, Math.floor(assets / 50000));
  const penalties =
    Math.min(220, (c?.late ?? 0) * 25 + (c?.defaults ?? 0) * 100) +
    Math.min(100, Math.round((debt / Math.max(10000, assets + p.cash + p.bank)) * 100));
  const score = Math.max(300, Math.min(850, 550 + history + punctual + stability - penalties));
  const month = Math.floor(w.time / LOAN_MONTH);
  const income =
    (c?.income ?? []).filter((i) => i.month >= month - 1).reduce((n, i) => n + i.amount, 0) / 2;
  const payments = loans.filter((l) => l.status === 'active').reduce((n, l) => n + l.payment, 0);
  return {
    score,
    employment,
    assets,
    debt,
    monthlyIncome: Math.floor(income),
    payments,
    onTime: c?.onTime ?? 0,
    late: c?.late ?? 0,
    defaults: c?.defaults ?? 0,
    explanation:
      'Game score (300–850): repayment history, debt burden, observed employment and owned buildings. It is not a real-world credit score. New histories build from this upgrade; no past employment is invented.',
  };
}
export function amortizedPayment(principal: number, apr: number, months: number) {
  const r = apr / 12;
  return Math.ceil(r ? (principal * r) / (1 - Math.pow(1 + r, -months)) : principal / months);
}
export function loanQuote(
  w: World,
  p: Player,
  b: Building,
  amount: number,
  months: number,
  collateral?: string,
) {
  const profile = creditProfile(w, p);
  const property = collateral ? w.buildings.find((v) => v.id === collateral) : undefined;
  const secured = !!collateral;
  const apr =
    Math.round(
      (secured
        ? 0.06 + ((850 - profile.score) / 350) * 0.08
        : 0.1 + ((850 - profile.score) / 350) * 0.18) * 10000,
    ) / 10000;
  const payment = amortizedPayment(amount, apr, months);
  const value = property
    ? ((buildings[property.kind]?.price ?? 0) * Math.max(0, property.condition)) / 100
    : 0;
  const liquid = Math.max(0, p.cash + p.bank - profile.debt - 20000);
  const capacity = Math.max(
    0,
    Math.floor(profile.monthlyIncome * 0.35 + liquid / (Math.max(1, months) * 2)) -
      profile.payments,
  );
  const limit = secured
    ? Math.floor(value * 0.75)
    : Math.min(100000, Math.floor(profile.monthlyIncome * 6 + liquid * 0.5));
  const reasons: string[] = [];
  if (b.kind !== 'bank' || b.construction) reasons.push('Visit an operating bank.');
  if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 10000000)
    reasons.push('Borrow 10d–100,000d.');
  if (![6, 12, 24, 36, 60].includes(months)) reasons.push('Choose 6, 12, 24, 36 or 60 payments.');
  if (profile.score < (secured ? 500 : 540))
    reasons.push('Improve repayment history and reduce debts first.');
  if ((p.loans ?? []).some((l) => l.status === 'default' || l.status === 'foreclosed' || l.due > 0))
    reasons.push('Bring existing debt current before borrowing.');
  if ((p.loans ?? []).filter((l) => l.status === 'active').length >= 3)
    reasons.push('At most three active loans.');
  if (
    secured &&
    (!property ||
      property.owner !== p.id ||
      property.government ||
      property.construction ||
      property.lien ||
      property.forSale)
  )
    reasons.push('Collateral must be your finished, unlisted, unencumbered building.');
  if (amount > limit) reasons.push(`Current borrowing limit is ${(limit / 100).toFixed(2)}d.`);
  if (payment > capacity) reasons.push('Payments exceed verified income and available reserves.');
  if (amount > b.investment) reasons.push('The bank lacks lending capital.');
  return {
    ...profile,
    apr,
    payment,
    months,
    amount,
    limit,
    capacity,
    total: payment * months,
    interest: payment * months - amount,
    collateral,
    approved: !reasons.length,
    reasons,
  };
}
function accrue(l: Loan, at: number) {
  if (l.status !== 'active' || at <= l.lastInterest) return;
  const n = l.fraction + (l.principal * l.apr * (at - l.lastInterest)) / PROPERTY_YEAR;
  const whole = Math.floor(n + 1e-9);
  l.interest += whole;
  l.fraction = Math.max(0, n - whole);
  l.lastInterest = at;
}
function repay(w: World, p: Player, l: Loan, amount: number, fromBank: boolean, at: number) {
  const b = w.buildings.find((b) => b.id === l.bank);
  check(b, 'Lending bank unavailable');
  accrue(l, at);
  const n = Math.min(amount, l.principal + l.interest);
  check(n > 0, 'No balance to repay');
  check((fromBank ? p.bank : p.cash) >= n, 'Insufficient funds for repayment');
  if (fromBank) p.bank -= n;
  else p.cash -= n;
  const interest = Math.min(n, l.interest);
  l.interest -= interest;
  l.principal -= n - interest;
  b!.investment += n;
  const hadDue = l.due > 0;
  l.due = Math.max(0, l.due - n);
  log(w, 'transfer', n, fromBank ? p.id + ':bank' : p.id, b!.id, 'loan repayment');
  if (hadDue && !l.due) {
    if (!l.lateReported) creditRecord(w, p).onTime++;
    delete l.lateSince;
    delete l.lateReported;
  }
  if (l.principal + l.interest === 0) {
    l.status = 'paid';
    l.due = 0;
    l.fraction = 0;
    const property = w.buildings.find((b) => b.lien?.loan === l.id && b.lien.borrower === p.id);
    if (property) delete property.lien;
    say(
      w,
      'Bank',
      'Loan repaid in full. Any remaining collateral lien is released.',
      'system',
      p.id,
    );
  }
  return n;
}
export function foreclose(w: World, p: Player, l: Loan, at = w.time) {
  if (l.status !== 'active') return;
  const c = creditRecord(w, p);
  c.defaults++;
  const b = l.collateral
    ? w.buildings.find((b) => b.id === l.collateral && b.owner === p.id)
    : undefined;
  l.status = b ? 'foreclosed' : 'default';
  if (b) {
    releaseEstate(w, b);
    b.estate!.since = at;
    if (p.home === b.id) p.atHome = false;
    if (b.lodging) b.lodging.open = false;
    say(
      w,
      'Bank',
      `${b.name} has been foreclosed after default. Its sale proceeds repay the bank; any surplus is returned to you. Any shortfall remains your debt.`,
      'system',
      p.id,
    );
  } else
    say(
      w,
      'Bank',
      'Your loan is in default. Repay the outstanding balance before seeking new credit.',
      'system',
      p.id,
    );
}
/** Existing mortgages survive death; collateral cannot be wiped to evade the debt. */
export function forecloseEstate(w: World, p: Player) {
  for (const l of p.loans ?? []) if (l.status === 'active' && l.collateral) foreclose(w, p, l);
}
/** Settle a foreclosed property's sale before assigning its new owner. */
export function settleForeclosure(w: World, b: Building, buyer: Player, price: number) {
  if (!b.lien) return false;
  const former = w.players[b.lien.borrower];
  const l = former?.loans?.find((l) => l.id === b.lien!.loan);
  check(former && l?.status === 'foreclosed', 'Mortgaged property cannot be transferred');
  const bank = w.buildings.find((v) => v.id === l!.bank);
  check(bank, 'Lending bank unavailable');
  const recovery = Math.min(price, l!.principal + l!.interest),
    surplus = price - recovery;
  buyer.cash -= price;
  bank!.investment += recovery;
  former!.cash += surplus;
  const interest = Math.min(recovery, l!.interest);
  l!.interest -= interest;
  l!.principal -= recovery - interest;
  l!.due = Math.max(0, l!.due - recovery);
  l!.status = l!.principal + l!.interest ? 'default' : 'paid';
  log(w, 'transfer', recovery, buyer.id, bank!.id, 'foreclosure recovery');
  log(w, 'transfer', surplus, buyer.id, former!.id, 'foreclosure surplus');
  delete b.lien;
  return true;
}
export function loanAction(w: World, p: Player, b: Building, a: Action) {
  check(b.kind === 'bank' && !b.construction, 'Visit an operating bank');
  if (a.operation === 'borrow') {
    const amount = Number(a.amount),
      months = Number(a.months);
    const collateral = typeof a.collateral === 'string' && a.collateral ? a.collateral : undefined;
    const q = loanQuote(w, p, b, amount, months, collateral);
    check(q.approved, q.reasons.join(' '));
    check(a.accepted === true, 'Review and accept the repayment terms first');
    // A stale quote must not silently authorize a changed rate or payment.
    check(a.apr === q.apr && a.payment === q.payment, 'Loan terms changed; request a fresh quote');
    const id = `loan-${p.id}-${(p.loanSequence ?? 0) + 1}`;
    p.loanSequence = (p.loanSequence ?? 0) + 1;
    const l: Loan = {
      id,
      bank: b.id,
      original: amount,
      principal: amount,
      interest: 0,
      fraction: 0,
      apr: q.apr,
      payment: q.payment,
      months,
      issued: w.time,
      lastInterest: w.time,
      nextDue: w.time + LOAN_MONTH,
      billed: 0,
      due: 0,
      autoPay: a.autoPay === true,
      collateral,
      status: 'active',
    };
    // Keep a bounded account history; cumulative credit history lives separately.
    p.loans = [
      ...(p.loans ?? [])
        .filter((l) => l.status !== 'paid')
        .concat((p.loans ?? []).filter((l) => l.status === 'paid').slice(-16)),
      l,
    ];
    if (collateral)
      w.buildings.find((v) => v.id === collateral)!.lien = { borrower: p.id, loan: id };
    b.investment -= amount;
    p.cash += amount;
    creditRecord(w, p);
    log(w, 'transfer', amount, b.id, p.id, 'loan disbursement');
    return `Loan opened. ${(q.payment / 100).toFixed(2)}d due every ${(LOAN_MONTH / 3600).toFixed(2)} real hours; keep bank savings funded for automatic payments.`;
  }
  const l = p.loans?.find((l) => l.id === a.loan && l.bank === b.id);
  check(l, 'Loan not found at this bank');
  if (a.operation === 'autopay') {
    check(typeof a.enabled === 'boolean', 'Choose automatic payments on or off');
    l!.autoPay = a.enabled === true;
    return 'Automatic payments updated.';
  }
  check(a.operation === 'repay', 'Choose borrow, repay or autopay');
  const amount = Number(a.amount);
  check(
    Number.isSafeInteger(amount) && amount > 0 && amount <= 100000000,
    'Enter a valid repayment amount',
  );
  repay(w, p, l!, amount, false, w.time);
  return 'Repayment received.';
}
export function advanceLoans(w: World, p: Player, start: number, end: number) {
  const c = creditRecord(w, p);
  c.observedSeconds += end - start;
  if (
    p.job &&
    w.buildings.some((b) => b.id === p.job && b.owner !== p.id && b.employees.includes(p.id))
  )
    c.employedSeconds += end - start;
  for (const l of p.loans ?? []) {
    if (l.status !== 'active') continue;
    // Catch up at scheduled boundaries, never a new bill on reconnect.
    while (l.nextDue <= end && l.status === 'active') {
      const at = l.nextDue;
      accrue(l, at);
      l.billed++;
      l.due = Math.min(
        l.principal + l.interest,
        l.due + (l.billed >= l.months ? l.principal + l.interest : l.payment),
      );
      l.nextDue += LOAN_MONTH;
      if (l.due > 0) l.lateSince ??= at;
      if (l.autoPay && p.bank >= l.due && l.due > 0) repay(w, p, l, l.due, true, at);
      else if (l.due > 0)
        say(
          w,
          'Bank',
          `Payment due: ${(l.due / 100).toFixed(2)}d. A half-month grace period applies. Three months in arrears leads to default${l.collateral ? ' and foreclosure' : ''}.`,
          'system',
          p.id,
        );
      checkLate(w, p, l, at);
    }
    if (l.status !== 'active') continue;
    accrue(l, end);
    checkLate(w, p, l, end);
    if (l.status === 'active' && l.due > 0 && l.autoPay && p.bank >= l.due)
      repay(w, p, l, l.due, true, end);
  }
}
function checkLate(w: World, p: Player, l: Loan, at: number) {
  if (l.lateSince === undefined || l.due <= 0 || l.status !== 'active') return;
  if (at >= l.lateSince + LOAN_MONTH / 2 && !l.lateReported) {
    l.lateReported = true;
    creditRecord(w, p).late++;
    say(
      w,
      'Bank',
      'Your payment is past the grace period. Your credit record has been affected. Pay the arrears to stop default proceedings.',
      'system',
      p.id,
    );
  }
  if (at >= l.lateSince + LOAN_MONTH * 3) foreclose(w, p, l, at);
}

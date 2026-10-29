// SPDX-License-Identifier: GPL-3.0-or-later
import { automaticFunds, LOAN_MONTH, type Loan, type PaymentSource } from '../shared/loans';
import { money } from '../shared/simulation';
import type { World, Player } from '../shared/types';
const esc = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const paymentSourceNames: Record<PaymentSource, string> = {
  savings: 'Bank savings only',
  cash: 'Cash in hand only',
  savingsThenCash: 'Savings first, then cash in hand',
};
export function paymentSourceSelect(source: PaymentSource = 'savings', combined = true) {
  return `<label>Payment source<select name="paymentSource">${Object.entries(paymentSourceNames)
    .filter(([id]) => combined || id !== 'savingsThenCash')
    .map(
      ([id, name]) => `<option value="${id}" ${id === source ? 'selected' : ''}>${name}</option>`,
    )
    .join('')}</select></label>`;
}
const remaining = (seconds: number) => `${Math.max(0, Math.ceil(seconds / 60))} real minutes`;
export function loanStatusHtml(w: World, p: Player, l: Loan) {
  const m = (v: number) => money(v, w.settings.denariiPerSheckle);
  const property = w.buildings.find((b) => b.id === l.collateral);
  const deadline = l.lateSince === undefined ? undefined : l.lateSince + 3 * LOAN_MONTH;
  const due = l.due > 0;
  const funds = automaticFunds(p, l);
  return `<article class="notice" data-loan-status="${esc(l.id)}"><h4>${l.collateral ? `Mortgage: ${esc(property?.name ?? 'pledged property')}` : 'Personal loan'} · ${esc(l.status)}</h4><p>Lender: ${esc(w.buildings.find((b) => b.id === l.bank)?.name ?? 'Bank')}. Balance ${m(l.principal + l.interest)} · ${(l.apr * 100).toFixed(2)}% APR · instalment ${m(l.payment)}. ${due ? `Due now: ${m(l.due)}.` : l.status === 'active' ? `Next payment in ${remaining(l.nextDue - w.time)}.` : ''}</p><p>${l.autoPay ? `Automatic payments: ${paymentSourceNames[l.paymentSource ?? 'savings']}. Available ${m(funds)}.${l.status === 'active' && funds < (l.due || Math.min(l.payment, l.principal + l.interest)) ? ' Not enough to cover the next payment; fund this source or change it at the bank.' : ''}` : 'Automatic payments are OFF. Pay at the bank.'} Business working capital is never used.</p>${due && l.status === 'active' && deadline !== undefined ? `<p><strong>${l.collateral ? 'Foreclosure' : 'Default'} in ${remaining(deadline - w.time)} unless arrears are cleared.</strong> ${w.time < l.lateSince! + LOAN_MONTH / 2 ? `Late-report grace remaining: ${remaining(l.lateSince! + LOAN_MONTH / 2 - w.time)}.` : 'The grace period has ended.'}</p>` : ''}${l.status === 'foreclosed' ? '<p>This property has been repossessed. Its sale repays the bank first; surplus returns to you. Repaying debt does not automatically return repossessed property.</p>' : ''}</article>`;
}
export function debtStatusHtml(w: World, p: Player) {
  const loans = (p.loans ?? []).filter((l) => l.status !== 'paid');
  return `<div data-debt-status><p>Cash in hand: ${money(p.cash, w.settings.denariiPerSheckle)} · bank savings: ${money(p.bank, w.settings.denariiPerSheckle)}. These warnings come from your saved loans and remain available after chat scrolls away or you reconnect. Deadlines continue offline while this world runs.</p>${loans.map((l) => loanStatusHtml(w, p, l)).join('') || '<p>No outstanding loans.</p>'}<p>Visit the lending bank to repay or change automatic payment settings. Manual repayments default to cash in hand; choose savings if preferred.</p></div>`;
}
export function debtNotice(p: Player) {
  const loans = (p.loans ?? []).filter((l) => l.status !== 'paid');
  return !loans.length
    ? ''
    : loans.some((l) => l.due > 0 || l.status !== 'active')
      ? 'Loan payment overdue · review'
      : loans.some(
            (l) =>
              !l.autoPay || automaticFunds(p, l) < Math.min(l.payment, l.principal + l.interest),
          )
        ? 'Loan payment needs funding · review'
        : `Loans: ${loans.length} · review`;
}

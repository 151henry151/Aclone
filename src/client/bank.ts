// SPDX-License-Identifier: GPL-3.0-or-later
import { creditProfile, loanQuote, LOAN_MONTH } from '../shared/loans';
import { money } from '../shared/simulation';
import type { World, Player, Building } from '../shared/types';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (n: string, v: unknown) => `<input type="hidden" name="${n}" value="${esc(v)}">`;
export function bankLoans(w: World, p: Player, b: Building) {
  const c = creditProfile(w, p);
  const collateral = w.buildings.filter(
    (v) => v.owner === p.id && !v.government && !v.construction && !v.lien && !v.forSale,
  );
  return `<hr><h3>Loans & credit</h3><p data-credit-score>Credit score: <b>${c.score} / 850</b> · debt ${money(c.debt)} · verified income ${money(c.monthlyIncome)} per bank month.</p>
  <p class="note">${Math.round(c.employment * 100)}% of observed life employed · ${c.onTime} on-time repayments · ${c.late} late episodes · ${c.defaults} defaults. Employment and buildings help; repayment history and debt matter most. History starts when recorded, not retroactively.</p>
  <p>Fixed annual rates, equal monthly instalments, no origination or early-repayment fees. One bank month is ${(LOAN_MONTH / 3600).toFixed(2)} real hours (30.42 game days). Rates are fictional game terms. Automatic payments use bank savings only, including offline. A half-month grace period precedes a late report; three months in arrears leads to default and foreclosure of pledged property. Debt survives death.</p>
  <form id="loan-quote-form">${hidden('building', b.id)}<label>Loan amount in denarii<input name="denarii" type="number" min="10" max="100000" step="0.01" value="100" required></label>
  <label>Number of monthly payments<select name="months">${[6, 12, 24, 36, 60].map((n) => `<option value="${n}" ${n === 12 ? 'selected' : ''}>${n} payments</option>`).join('')}</select></label>
  <label>Security<select name="collateral"><option value="">Unsecured personal loan</option>${collateral.map((v) => `<option value="${esc(v.id)}">Mortgage ${esc(v.name)}</option>`).join('')}</select></label><button>Get loan quote</button></form><div id="loan-quote-result" aria-live="polite"></div>
  ${(p.loans ?? [])
    .filter((l) => l.status !== 'paid' && l.bank === b.id)
    .map(
      (
        l,
      ) => `<article class="notice"><h4>${l.collateral ? 'Mortgage' : 'Personal loan'} · ${esc(l.status)}</h4><p>Balance ${money(l.principal + l.interest)} (${money(l.principal)} principal, ${money(l.interest)} accrued interest) · ${(l.apr * 100).toFixed(2)}% APR · instalment ${money(l.payment)}. ${l.due ? `Due now: ${money(l.due)}.` : `Next due in ${Math.max(0, Math.ceil((l.nextDue - w.time) / 60))} minutes.`}</p>
  <form data-action="loan">${hidden('building', b.id)}${hidden('operation', 'repay')}${hidden('loan', l.id)}<label>Repayment in denarii<input name="denarii" type="number" min="0.01" step="0.01" value="${(l.due || l.payment) / 100}"></label><button>Repay loan</button></form>
  <form data-action="loan">${hidden('building', b.id)}${hidden('operation', 'autopay')}${hidden('loan', l.id)}${hidden('enabled', !l.autoPay)}<button>${l.autoPay ? 'Disable' : 'Enable'} automatic payments from savings</button></form></article>`,
    )
    .join('')}`;
}
export function bankQuote(
  w: World,
  p: Player,
  b: Building,
  amount: number,
  months: number,
  collateral?: string,
) {
  const q = loanQuote(w, p, b, amount, months, collateral);
  if (!q.approved) return `<p class="notice">Loan unavailable: ${q.reasons.map(esc).join(' ')}</p>`;
  return `<div class="notice"><h4>Your loan offer</h4><p>Borrow ${money(amount)} at <b>${(q.apr * 100).toFixed(2)}% APR</b> for ${months} bank months. Pay <b>${money(q.payment)}</b> each month. Scheduled total ${money(q.total)} including ${money(q.interest)} interest; final payment may be slightly lower after rounding. First payment in ${(LOAN_MONTH / 3600).toFixed(2)} real hours.</p>
  <p>${collateral ? 'The selected property is pledged and cannot be sold or demolished until repaid. Default can cost you this property.' : 'Unsecured debt still affects your credit and future borrowing.'}</p>
  <form data-action="loan">${hidden('building', b.id)}${hidden('operation', 'borrow')}${hidden('amount', amount)}${hidden('months', months)}${hidden('collateral', collateral ?? '')}${hidden('apr', q.apr)}${hidden('payment', q.payment)}
  <label class="check"><input type="checkbox" name="autoPay" value="true" checked>Pay automatically from bank savings</label>
  <label class="check"><input type="checkbox" name="accepted" value="true" required>I accept this payment schedule and default terms</label><button>Accept loan</button></form></div>`;
}

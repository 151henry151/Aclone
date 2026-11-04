// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const loanRuleFields = {
  loanLiquidityReserve: {
    label: 'Protected liquidity before loan assessment (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  loanIncomePaymentShare: {
    label: 'Income available for payments (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  loanLiquidPaymentDivisor: {
    label: 'Liquid payment capacity divisor',
    min: 1,
    max: 1000,
    step: 0.1,
  },
  loanPersonalLimit: {
    label: 'Unsecured borrowing ceiling (hundredths; 0 closes personal lending)',
    min: 0,
    max: 10000000,
    step: 1,
  },
  loanIncomeBorrowingMonths: {
    label: 'Income months counted toward borrowing limit',
    min: 0,
    max: 120,
    step: 0.1,
  },
  loanLiquidBorrowingShare: {
    label: 'Liquid funds counted toward borrowing limit (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  loanMinimumAmount: { label: 'Minimum loan amount (hundredths)', min: 1, max: 10000000, step: 1 },
  loanMaximumAmount: { label: 'Maximum loan amount (hundredths)', min: 1, max: 10000000, step: 1 },
  loanPersonalBaseApr: { label: 'Personal loan base APR (%)', min: 0, max: 100, step: 0.01 },
  loanPersonalAprSpread: {
    label: 'Personal loan score spread (percentage points)',
    min: 0,
    max: 100,
    step: 0.01,
  },
  loanMortgageBaseApr: { label: 'Mortgage base APR (%)', min: 0, max: 100, step: 0.01 },
  loanMortgageAprSpread: {
    label: 'Mortgage score spread (percentage points)',
    min: 0,
    max: 100,
    step: 0.01,
  },
  loanRateScoreSpan: { label: 'Loan rate score span', min: 1, max: 1000, step: 1 },
  loanPersonalMinimumScore: { label: 'Minimum personal loan score', min: 300, max: 850, step: 1 },
  loanMortgageMinimumScore: { label: 'Minimum mortgage score', min: 300, max: 850, step: 1 },
  loanMaximumActive: {
    label: 'Maximum active loans per borrower (0 closes new lending)',
    min: 0,
    max: 100,
    step: 1,
  },
  loanMortgageLtv: {
    label: 'Mortgage structural loan-to-value (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
} as const;
export type LoanRules = Pick<typeof defaults, keyof typeof loanRuleFields | 'loanTerms'>;
export function loanRules(settings: Partial<LoanRules> = {}): LoanRules {
  return Object.fromEntries(
    [...Object.keys(loanRuleFields), 'loanTerms'].map((key) => [
      key,
      settings[key as keyof LoanRules] ?? defaults[key as keyof LoanRules],
    ]),
  ) as LoanRules;
}
export function loanTerms(settings: Partial<LoanRules> = {}) {
  return loanRules(settings).loanTerms.split(',').map(Number);
}
export function validLoanTerms(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 479 || !/^\d+(,\d+)*$/.test(value)) return false;
  const terms = value.split(',').map(Number);
  return (
    terms.length <= 120 &&
    terms.every((n, i) => Number.isSafeInteger(n) && n >= 1 && n <= 120 && (!i || n > terms[i - 1]))
  );
}
/** Retain the usual one-year preference where offered, otherwise use the nearest term. */
export function preferredLoanTerm(settings: Partial<LoanRules> = {}) {
  return loanTerms(settings).reduce((best, n) =>
    Math.abs(n - 12) < Math.abs(best - 12) ? n : best,
  );
}

export function loanRulesError(settings: Partial<LoanRules>) {
  const r = loanRules(settings);
  if (r.loanMinimumAmount > r.loanMaximumAmount)
    return 'Minimum loan amount must not exceed its maximum';
}

// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const creditRuleFields = {
  creditScoreMinimum: { label: 'Minimum credit score', min: 0, max: 1000, step: 1 },
  creditScoreMaximum: { label: 'Maximum credit score', min: 0, max: 1000, step: 1 },
  creditScoreInitial: { label: 'Starting credit score', min: 0, max: 1000, step: 1 },
  creditHistoryMonthlyPoints: {
    label: 'Credit history points per bank month',
    min: 0,
    max: 1000,
    step: 1,
  },
  creditHistoryMaximum: { label: 'Maximum history points', min: 0, max: 1000, step: 1 },
  creditOnTimePoints: { label: 'Points per on-time repayment', min: 0, max: 1000, step: 1 },
  creditOnTimeMaximum: { label: 'Maximum on-time points', min: 0, max: 1000, step: 1 },
  creditEmploymentPoints: { label: 'Full observed employment points', min: 0, max: 1000, step: 1 },
  creditAssetUnit: {
    label: 'Structural assets per credit point (hundredths)',
    min: 1,
    max: 100000000,
    step: 1,
  },
  creditAssetMaximum: { label: 'Maximum asset points', min: 0, max: 1000, step: 1 },
  creditLatePoints: { label: 'Penalty per late episode', min: 0, max: 1000, step: 1 },
  creditDefaultPoints: { label: 'Penalty per default', min: 0, max: 1000, step: 1 },
  creditPenaltyMaximum: {
    label: 'Maximum combined late/default penalty',
    min: 0,
    max: 1000,
    step: 1,
  },
  creditDebtPoints: { label: 'Debt ratio points multiplier', min: 0, max: 1000, step: 1 },
  creditDebtMaximum: { label: 'Maximum debt-ratio penalty', min: 0, max: 1000, step: 1 },
  creditDebtDenominatorMinimum: {
    label: 'Debt-ratio assets/cash denominator floor (hundredths)',
    min: 1,
    max: 100000000,
    step: 1,
  },
} as const;
export type CreditRules = Pick<typeof defaults, keyof typeof creditRuleFields>;
export function creditRules(settings: Partial<CreditRules> = {}): CreditRules {
  return Object.fromEntries(
    Object.keys(creditRuleFields).map((key) => [
      key,
      settings[key as keyof CreditRules] ?? defaults[key as keyof CreditRules],
    ]),
  ) as CreditRules;
}
export function creditRulesError(settings: Partial<CreditRules>) {
  const r = creditRules(settings);
  if (r.creditScoreMinimum > r.creditScoreInitial || r.creditScoreInitial > r.creditScoreMaximum)
    return 'Credit score must have minimum ≤ starting ≤ maximum';
}

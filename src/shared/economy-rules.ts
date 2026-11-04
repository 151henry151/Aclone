// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const economyRuleFields = {
  minimumBuyPrice: {
    label: 'Minimum building purchase bid (hundredths of a denarius)',
    min: 1,
    max: 1000000,
    step: 1,
  },
  transactionItemLimit: { label: 'Maximum items per transaction', min: 1, max: 100000, step: 1 },
} as const;
export type EconomyRules = Pick<typeof defaults, keyof typeof economyRuleFields>;
export function economyRules(settings: Partial<EconomyRules> = {}): EconomyRules {
  return Object.fromEntries(
    Object.keys(economyRuleFields).map((key) => [
      key,
      settings[key as keyof EconomyRules] ?? defaults[key as keyof EconomyRules],
    ]),
  ) as EconomyRules;
}

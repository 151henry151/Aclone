// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const farmYieldRuleFields = {
  farmCompostYieldBonus: { label: 'Compost yield bonus (fraction)', min: 0, max: 5, step: 0.01 },
  farmRotationYieldPenalty: {
    label: 'Repeated crop-family penalty (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
} as const;
export type FarmYieldRules = Pick<typeof defaults, keyof typeof farmYieldRuleFields>;
export function farmYieldRules(settings: Partial<FarmYieldRules> = {}): FarmYieldRules {
  return Object.fromEntries(
    Object.keys(farmYieldRuleFields).map((key) => [
      key,
      settings[key as keyof FarmYieldRules] ?? defaults[key as keyof FarmYieldRules],
    ]),
  ) as FarmYieldRules;
}

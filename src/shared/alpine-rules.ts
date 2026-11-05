// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const alpineRuleFields = {
  alpineSnowStart: {
    label: 'Permanent snow starts (m above sea datum)',
    min: 0,
    max: 10000,
    step: 1,
  },
  alpineSnowFull: { label: 'Full permanent snow (m above sea datum)', min: 0, max: 10000, step: 1 },
  alpinePermanentSnow: { label: 'Permanent summit snow' },
  alpineSnowBase: { label: 'Alpine rain-to-snow base (m/day)', min: 0, max: 10, step: 0.001 },
  alpineSnowIntensity: {
    label: 'Alpine rain-to-snow per intensity (m/day)',
    min: 0,
    max: 10,
    step: 0.001,
  },
} as const;
export type AlpineRules = Pick<typeof defaults, keyof typeof alpineRuleFields>;
export function alpineRules(settings: Partial<AlpineRules> = {}): AlpineRules {
  return Object.fromEntries(
    Object.keys(alpineRuleFields).map((key) => [
      key,
      settings[key as keyof AlpineRules] ?? defaults[key as keyof AlpineRules],
    ]),
  ) as AlpineRules;
}
export function alpineRulesError(settings: Partial<AlpineRules>) {
  const rules = alpineRules(settings);
  if (rules.alpineSnowFull <= rules.alpineSnowStart)
    return 'Full snow coverage must be above the snow-line start';
}

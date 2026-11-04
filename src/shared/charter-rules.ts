// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const charterRuleFields = {
  charterDefaultFare: {
    label: 'Default charter fare (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  charterMaximumFare: {
    label: 'Maximum charter fare (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  charterDefaultMinutes: {
    label: 'Default charter trip (real minutes)',
    min: 1,
    max: 1440,
    step: 1,
  },
  charterMinimumMinutes: {
    label: 'Minimum charter trip (real minutes)',
    min: 1,
    max: 1440,
    step: 1,
  },
  charterMaximumMinutes: {
    label: 'Maximum charter trip (real minutes)',
    min: 1,
    max: 1440,
    step: 1,
  },
  charterMaximumOffers: {
    label: 'Maximum outstanding invitations per captain',
    min: 0,
    max: 100,
    step: 1,
  },
  charterReturnCooldown: {
    label: 'Return-request cooldown (real seconds)',
    min: 0,
    max: 3600,
    step: 1,
  },
} as const;
export type CharterRules = Pick<typeof defaults, keyof typeof charterRuleFields>;
export function charterRules(settings: Partial<CharterRules> = {}): CharterRules {
  return Object.fromEntries(
    Object.keys(charterRuleFields).map((key) => [
      key,
      settings[key as keyof CharterRules] ?? defaults[key as keyof CharterRules],
    ]),
  ) as CharterRules;
}
export function charterRulesError(settings: Partial<CharterRules>) {
  const r = charterRules(settings);
  if (r.charterDefaultFare > r.charterMaximumFare)
    return 'Default charter fare must not exceed the maximum';
  if (
    r.charterMinimumMinutes > r.charterDefaultMinutes ||
    r.charterDefaultMinutes > r.charterMaximumMinutes
  )
    return 'Charter duration must have minimum ≤ default ≤ maximum';
}

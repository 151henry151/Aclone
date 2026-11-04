// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const towingRuleFields = {
  towDefaultFee: { label: 'Default rescue fee (hundredths)', min: 0, max: 100000000, step: 1 },
  towMaximumFee: { label: 'Maximum rescue fee (hundredths)', min: 0, max: 100000000, step: 1 },
  towOfferSeconds: { label: 'Rescue offer lifetime (real seconds)', min: 1, max: 86400, step: 1 },
} as const;
export type TowingRules = Pick<typeof defaults, keyof typeof towingRuleFields>;
export function towingRules(settings: Partial<TowingRules> = {}): TowingRules {
  return Object.fromEntries(
    Object.keys(towingRuleFields).map((key) => [
      key,
      settings[key as keyof TowingRules] ?? defaults[key as keyof TowingRules],
    ]),
  ) as TowingRules;
}
export function towingRulesError(settings: Partial<TowingRules>) {
  const r = towingRules(settings);
  if (r.towDefaultFee > r.towMaximumFee) return 'Default rescue fee must not exceed the maximum';
}
/** Legacy posted offers keep their original lifetime, independent of later world edits. */
export function towOfferExpires(job: { created: number; expires?: number }) {
  return job.expires ?? job.created + defaults.towOfferSeconds;
}

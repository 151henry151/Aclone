// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const ROWBOAT = 36;
export const rowboatRuleFields = {
  motorboatRowingSpeed: {
    label: 'Empty-tank motorboat rowing speed (metres/second)',
    min: 0.2,
    max: 5,
    step: 0.1,
  },
  motorboatRowingAcceleration: {
    label: 'Empty-tank motorboat rowing acceleration (metres/second²)',
    min: 0.1,
    max: 5,
    step: 0.05,
  },
  rowboatsEnabled: { label: 'Allow new rowboat purchases' },
  rowboatPublicPickup: { label: 'Allow others to take beached rowboats' },
  rowboatMinDepth: { label: 'Rowboat minimum hull depth (metres)', min: 0.01, max: 2, step: 0.01 },
  rowboatStepOutDepth: {
    label: 'Rowboat maximum step-out depth (metres)',
    min: 0.05,
    max: 3,
    step: 0.05,
  },
  rowboatBankRange: { label: 'Rowboat bank access range (metres)', min: 1, max: 10, step: 0.5 },
  rowboatBankRise: { label: 'Rowboat maximum bank rise (metres)', min: 0.1, max: 3, step: 0.1 },
  rowboatShoreSpeed: {
    label: 'Rowboat gentle shore contact speed (metres/second)',
    min: 0.2,
    max: 10,
    step: 0.1,
  },
} as const;
export type RowboatRules = Pick<typeof defaults, keyof typeof rowboatRuleFields>;
export function rowboatRules(settings: Partial<RowboatRules> = {}): RowboatRules {
  return Object.fromEntries(
    Object.keys(rowboatRuleFields).map((key) => [
      key,
      settings[key as keyof RowboatRules] ?? defaults[key as keyof RowboatRules],
    ]),
  ) as RowboatRules;
}

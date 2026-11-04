// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const gatheringRuleFields = {
  gatheringBaseYield: {
    label: 'Untrained load (items)',
    min: 1,
    max: 1000,
    step: 1,
  },
  gatheringSkilledYield: {
    label: 'Skilled load (items)',
    min: 1,
    max: 1000,
    step: 1,
  },
  gatheringBaseSeconds: {
    label: 'Untrained gathering time (seconds)',
    min: 1,
    max: 600,
    step: 1,
  },
  gatheringSkilledSeconds: {
    label: 'Skilled gathering time (seconds)',
    min: 1,
    max: 600,
    step: 1,
  },
} as const;
export type GatheringRules = Pick<typeof defaults, keyof typeof gatheringRuleFields>;
export function gatheringRules(settings: Partial<GatheringRules> = {}): GatheringRules {
  return Object.fromEntries(
    Object.keys(gatheringRuleFields).map((key) => [
      key,
      settings[key as keyof GatheringRules] ?? defaults[key as keyof GatheringRules],
    ]),
  ) as GatheringRules;
}

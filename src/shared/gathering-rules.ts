// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const gatheringRuleFields = {
  resourceLogsCapacity: { label: 'Woodland capacity (logs)', min: 1, max: 10000, step: 1 },
  resourceOtherCapacity: { label: 'Mineral/topsoil capacity (items)', min: 1, max: 10000, step: 1 },
  resourceLogsRegrowthSeconds: {
    label: 'Woodland recovery interval (seconds before multiplier)',
    min: 10,
    max: 86400,
    step: 1,
  },
  resourceOtherRegrowthSeconds: {
    label: 'Mineral/topsoil recovery interval (seconds before multiplier)',
    min: 10,
    max: 86400,
    step: 1,
  },
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

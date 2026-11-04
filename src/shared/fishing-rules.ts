// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const fishingRuleFields = {
  fishingDeepDepth: {
    label: 'Deep-fishing minimum depth (metres)',
    min: 0.1,
    max: 1000,
    step: 0.1,
  },
  fishingShoreDistance: {
    label: 'Offshore clearance (metres; zero removes buffer)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  fishingShoreWaitSeconds: {
    label: 'Ordinary shore mean bite wait (seconds)',
    min: 1,
    max: 3600,
    step: 0.1,
  },
  fishingAnywhereWaitSeconds: {
    label: 'Anywhere-mode shore mean bite wait (seconds)',
    min: 1,
    max: 3600,
    step: 0.1,
  },
  fishingCoastalWaitSeconds: {
    label: 'Coastal boat mean bite wait (seconds)',
    min: 1,
    max: 3600,
    step: 0.1,
  },
  fishingDeepWaitSeconds: {
    label: 'Deep-water boat mean bite wait (seconds)',
    min: 1,
    max: 3600,
    step: 0.1,
  },
} as const;
export type FishingRules = Pick<typeof defaults, keyof typeof fishingRuleFields>;
export function fishingRules(settings: Partial<FishingRules> = {}): FishingRules {
  return Object.fromEntries(
    Object.keys(fishingRuleFields).map((key) => [
      key,
      settings[key as keyof FishingRules] ?? defaults[key as keyof FishingRules],
    ]),
  ) as FishingRules;
}

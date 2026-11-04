// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const fishingRuleFields = {
  trawlSpeed: { label: 'Default towing speed (metres/second)', min: 1, max: 8, step: 0.1 },
  trawlNetCapacity: { label: 'Default net capacity (weight)', min: 10, max: 5000, step: 1 },
  trawlShoalMeanSeconds: {
    label: 'Mean shoal interval (paid towing seconds)',
    min: 1,
    max: 86400,
    step: 1,
  },
  trawlFuelPerMinute: {
    label: 'Default towing fuel (units/minute)',
    min: 0.06,
    max: 60,
    step: 0.01,
  },
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

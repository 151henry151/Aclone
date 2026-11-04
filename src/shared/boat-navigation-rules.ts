// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const boatNavigationRuleFields = {
  boatShoreImpactLoss: {
    label: 'Shore-impact condition loss (0 = no damage)',
    min: 0,
    max: 100,
    step: 0.1,
  },
  boatHouseArrivalRadius: {
    label: 'Afloat boathouse arrival radius (metres)',
    min: 0.1,
    max: 100,
    step: 0.1,
  },
  boatLandingArrivalRadius: {
    label: 'Afloat pier/river landing radius (metres)',
    min: 0.1,
    max: 100,
    step: 0.1,
  },
  boatLandingShoreRadius: {
    label: 'Pier/river shore boarding radius (metres)',
    min: 0.1,
    max: 100,
    step: 0.1,
  },
} as const;
export type BoatNavigationRules = Pick<typeof defaults, keyof typeof boatNavigationRuleFields>;
export function boatNavigationRules(
  settings: Partial<BoatNavigationRules> = {},
): BoatNavigationRules {
  return Object.fromEntries(
    Object.keys(boatNavigationRuleFields).map((key) => [
      key,
      settings[key as keyof BoatNavigationRules] ?? defaults[key as keyof BoatNavigationRules],
    ]),
  ) as BoatNavigationRules;
}

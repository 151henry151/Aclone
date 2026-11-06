// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const boatNavigationRuleFields = {
  boatBerthSearchDistance: {
    label: 'Extra seaward berth search (metres; 0 disables)',
    min: 0,
    max: 100,
    step: 1,
  },
  quayMaxLength: {
    label: 'Freight quay maximum vessel length (metres)',
    min: 1,
    max: 60,
    step: 0.1,
  },
  quayMaxBeam: { label: 'Freight quay maximum vessel beam (metres)', min: 0.5, max: 20, step: 0.1 },
  quayDraft: { label: 'Freight quay minimum berth depth (metres)', min: 0.1, max: 20, step: 0.1 },
  freightTransferRate: {
    label: 'Freight transfer rate (weight per second)',
    min: 0.1,
    max: 10000,
    step: 0.1,
  },
  freightShopRange: {
    label: 'Freight shop reach from shore entrance (metres)',
    min: 1,
    max: 200,
    step: 1,
  },
  riverDockDraft: { label: 'River dock required depth (metres)', min: 0.1, max: 20, step: 0.1 },
  riverDockMaxLength: {
    label: 'River dock maximum vessel length (metres)',
    min: 0.1,
    max: 50,
    step: 0.1,
  },
  riverDockMaxBeam: {
    label: 'River dock maximum vessel beam (metres)',
    min: 0.1,
    max: 20,
    step: 0.1,
  },
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

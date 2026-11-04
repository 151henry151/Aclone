// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const constructionRuleFields = {
  pastureParcelSize: { label: 'New pasture parcel side (m)', min: 8, max: 64, step: 1 },
  maximumFarmPlots: { label: 'Maximum farm plots', min: 4, max: 64, step: 4 },
  expandedConstructionCostMultiplier: {
    label: 'Expanded construction cost multiplier',
    min: 1,
    max: 10,
    step: 0.01,
  },
  largeConstructionCostMultiplier: {
    label: 'Large construction cost multiplier',
    min: 1,
    max: 10,
    step: 0.01,
  },
  constructionMinimumSpacing: {
    label: 'Minimum building centre spacing (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  constructionPlacementReach: {
    label: 'Shoreline placement reach (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  spawnClearance: {
    label: 'Respawn clearance (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  townCentreClearance: {
    label: 'Town centre clearance (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  constructionRefundShare: {
    label: 'Construction refund share',
    min: 0,
    max: 1,
    step: 0.01,
  },
} as const;
export type ConstructionRules = Pick<typeof defaults, keyof typeof constructionRuleFields>;
export function constructionRules(settings: Partial<ConstructionRules> = {}): ConstructionRules {
  return Object.fromEntries(
    Object.keys(constructionRuleFields).map((key) => [
      key,
      settings[key as keyof ConstructionRules] ?? defaults[key as keyof ConstructionRules],
    ]),
  ) as ConstructionRules;
}

/** Display the share without binary floating-point tails; calculations retain full precision. */
export function constructionRefundPercentage(settings: Partial<ConstructionRules> = {}) {
  return constructionRules(settings).constructionRefundShare.toLocaleString('en-GB', {
    style: 'percent',
    maximumFractionDigits: 10,
  });
}

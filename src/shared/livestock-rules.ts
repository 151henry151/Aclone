// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const livestockRuleFields = {
  livestockYoungVisualScale: {
    label: 'Young animal size relative to adults',
    min: 0.2,
    max: 1,
    step: 0.05,
  },
  calfMaturityDays: {
    label: 'Calf maturity (game days)',
    min: 0.1,
    max: 3650,
    step: 0.1,
  },
  lambMaturityDays: {
    label: 'Lamb maturity (game days)',
    min: 0.1,
    max: 3650,
    step: 0.1,
  },
  pigletMaturityDays: {
    label: 'Piglet maturity (game days)',
    min: 0.1,
    max: 3650,
    step: 0.1,
  },
  chickMaturityDays: {
    label: 'Chick maturity (game days)',
    min: 0.1,
    max: 3650,
    step: 0.1,
  },
  livestockGrowthMultiplier: {
    label: 'Healthy growth speed multiplier',
    min: 0,
    max: 100,
    step: 0.1,
  },
  livestockBreedingMultiplier: {
    label: 'Breeding speed multiplier',
    min: 0.1,
    max: 100,
    step: 0.1,
  },
  livestockYoungRationShare: {
    label: 'Young ration share of an adult',
    min: 0,
    max: 1,
    step: 0.05,
  },
  livestockYoungPastureShare: {
    label: 'Young pasture share of an adult',
    min: 0.05,
    max: 1,
    step: 0.05,
  },
  livestockGrowthCondition: {
    label: 'Minimum condition for growth (%)',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockYoungLossCondition: {
    label: 'Lose young below this condition (%)',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockBreedingCondition: {
    label: 'Minimum condition to breed (%)',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockBirthCondition: {
    label: 'Minimum condition for a successful birth (%)',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockBreedingFeed: {
    label: 'Feed or hay per breeding',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockBreedingWater: {
    label: 'Water per breeding',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockHealthyGain: {
    label: 'Condition gain with feed and staff',
    min: 0,
    max: 100,
    step: 0.1,
  },
  livestockUnstaffedLoss: {
    label: 'Condition loss without qualified care',
    min: 0,
    max: 100,
    step: 0.1,
  },
  livestockHungryLoss: {
    label: 'Condition loss without rations',
    min: 0,
    max: 100,
    step: 0.1,
  },
  livestockDeathResetCondition: {
    label: 'Condition after a neglected adult loss',
    min: 0,
    max: 100,
    step: 1,
  },
  livestockContinuousAllowed: {
    label: 'Allow continuous breeding',
  },
  cowBreedingMinimum: {
    label: 'Cow: Minimum adult breeding stock',
    min: 1,
    max: 100,
    step: 1,
  },
  cowFeedRation: {
    label: 'Cow: Feed per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  cowWaterRation: {
    label: 'Cow: Water per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  cowBreedingSeconds: {
    label: 'Cow: Breeding duration (seconds)',
    min: 1,
    max: 604800,
    step: 1,
  },
  cowBreedingFee: {
    label: 'Cow: Breeding fee (internal currency units)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  sheepBreedingMinimum: {
    label: 'Sheep: Minimum adult breeding stock',
    min: 1,
    max: 100,
    step: 1,
  },
  sheepFeedRation: {
    label: 'Sheep: Feed per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  sheepWaterRation: {
    label: 'Sheep: Water per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  sheepBreedingSeconds: {
    label: 'Sheep: Breeding duration (seconds)',
    min: 1,
    max: 604800,
    step: 1,
  },
  sheepBreedingFee: {
    label: 'Sheep: Breeding fee (internal currency units)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  pigBreedingMinimum: {
    label: 'Pig: Minimum adult breeding stock',
    min: 1,
    max: 100,
    step: 1,
  },
  pigFeedRation: {
    label: 'Pig: Feed per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  pigWaterRation: {
    label: 'Pig: Water per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  pigBreedingSeconds: {
    label: 'Pig: Breeding duration (seconds)',
    min: 1,
    max: 604800,
    step: 1,
  },
  pigBreedingFee: {
    label: 'Pig: Breeding fee (internal currency units)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  chickenBreedingMinimum: {
    label: 'Chicken: Minimum adult breeding stock',
    min: 1,
    max: 100,
    step: 1,
  },
  chickenFeedRation: {
    label: 'Chicken: Feed per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  chickenWaterRation: {
    label: 'Chicken: Water per adult care cycle',
    min: 0,
    max: 100,
    step: 0.1,
  },
  chickenBreedingSeconds: {
    label: 'Chicken: Breeding duration (seconds)',
    min: 1,
    max: 604800,
    step: 1,
  },
  chickenBreedingFee: {
    label: 'Chicken: Breeding fee (internal currency units)',
    min: 0,
    max: 1000000,
    step: 1,
  },
} as const;
export type LivestockRules = Pick<typeof defaults, keyof typeof livestockRuleFields>;
export function livestockRules(settings: Partial<LivestockRules> = {}): LivestockRules {
  return Object.fromEntries(
    Object.keys(livestockRuleFields).map((key) => [
      key,
      settings[key as keyof LivestockRules] ?? defaults[key as keyof LivestockRules],
    ]),
  ) as LivestockRules;
}

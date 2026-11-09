// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import type { World, Player } from './types';
export const survivalRuleFields = {
  needsAutoFeedThreshold: { label: 'Automatic meal threshold', min: 1000, max: 1000000, step: 1 },
  needsDamageThreshold: {
    label: 'Starvation / dehydration threshold',
    min: 10000,
    max: 1000000,
    step: 1,
  },
  baseMaximumHealth: { label: 'Base maximum health', min: 10000, max: 1000000, step: 1 },
  nutritionAdjustmentLimit: {
    label: 'Nutrition adjustment limit (plus or minus)',
    min: 0,
    max: 999999,
    step: 1,
  },
  repeatServingFrom: { label: 'Apply repeat penalty from serving', min: 1, max: 100, step: 1 },
  repeatServingMultiplier: {
    label: 'Repeated serving food/drink multiplier',
    min: 0,
    max: 1,
    step: 0.05,
  },
  energyRegeneration: {
    label: 'Energy regeneration per second online',
    min: 0,
    max: 65000,
    step: 1,
  },
  schoolFirstPrice: {
    label: 'First lesson tuition (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  schoolLaterPrice: {
    label: 'Later lesson tuition (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  schoolFirstSeconds: { label: 'First lesson duration (seconds)', min: 1, max: 86400, step: 1 },
  schoolLaterSeconds: { label: 'Later lesson duration (seconds)', min: 1, max: 86400, step: 1 },
  licencesCountSkills: {
    label: 'Count driver, pilot and captain licences against the skill limit',
  },
  labourReliefPay: {
    label: 'Public labour relief (hundredths of a denarius)',
    min: 1,
    max: 1000000,
    step: 1,
  },
  labourReliefMeans: {
    label: 'Relief cash plus bank threshold (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  labourReliefCooldown: { label: 'Relief cooldown (seconds)', min: 0, max: 604800, step: 1 },
  labourShiftSeconds: {
    label: 'Public labour shift duration (seconds)',
    min: 1,
    max: 3600,
    step: 1,
  },
} as const;
export type SurvivalRules = Pick<typeof defaults, keyof typeof survivalRuleFields>;
export function survivalRules(settings: Partial<SurvivalRules> = {}): SurvivalRules {
  return Object.fromEntries(
    Object.keys(survivalRuleFields).map((key) => [
      key,
      settings[key as keyof SurvivalRules] ?? defaults[key as keyof SurvivalRules],
    ]),
  ) as SurvivalRules;
}
const licences = new Set(['driver', 'pilot', 'captain', 'plant operator']);
export function skillCounts(w: Pick<World, 'settings'>, id: string) {
  return survivalRules(w.settings).licencesCountSkills || !licences.has(id);
}
export function skillSlotsUsed(w: Pick<World, 'settings'>, p: Pick<Player, 'skills'>) {
  return p.skills.filter((id) => skillCounts(w, id)).length;
}
export function skillFits(w: Pick<World, 'settings'>, p: Pick<Player, 'skills'>, id: string) {
  return !skillCounts(w, id) || skillSlotsUsed(w, p) < w.settings.maxSkills;
}

/** Consecutive serving numbers start at one; Player.repeats starts at zero. */
export function servingMultiplier(settings: Partial<SurvivalRules> | undefined, serving: number) {
  const rules = survivalRules(settings);
  return serving >= rules.repeatServingFrom ? rules.repeatServingMultiplier : 1;
}
export function survivalRulesError(settings: Partial<SurvivalRules>) {
  const r = survivalRules(settings);
  if (r.needsAutoFeedThreshold >= r.needsDamageThreshold)
    return 'Automatic meal threshold must be below starvation / dehydration threshold';
  if (r.nutritionAdjustmentLimit >= r.baseMaximumHealth)
    return 'Nutrition adjustment limit must be below base maximum health';
}

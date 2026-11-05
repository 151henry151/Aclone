// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const climateRuleFields = {
  climateSpringWetChance: { label: 'Spring wet-event chance', min: 0, max: 1, step: 0.01 },
  climateSummerWetChance: { label: 'Summer wet-event chance', min: 0, max: 1, step: 0.01 },
  climateAutumnWetChance: { label: 'Autumn wet-event chance', min: 0, max: 1, step: 0.01 },
  climateWinterWetMin: { label: 'Winter wet-event chance minimum', min: 0, max: 1, step: 0.01 },
  climateWinterWetMax: { label: 'Winter wet-event chance maximum', min: 0, max: 1, step: 0.01 },
  climateStormThreshold: { label: 'Storm strength threshold', min: 0, max: 10, step: 0.01 },
  climateBlizzardChance: { label: 'Blizzard chance on snowy events', min: 0, max: 1, step: 0.001 },
  climateSnowPerStrength: {
    label: 'Natural snowfall per strength (m/day)',
    min: 0,
    max: 10,
    step: 0.001,
  },
  climateBlizzardSnow: { label: 'Extra blizzard snowfall (m/day)', min: 0, max: 10, step: 0.001 },
  climateForcedSnow: { label: 'Forced snow (m/day)', min: 0, max: 10, step: 0.001 },
  climateForcedSnowstorm: { label: 'Forced snowstorm (m/day)', min: 0, max: 10, step: 0.001 },
} as const;
export type ClimateRules = Pick<typeof defaults, keyof typeof climateRuleFields>;
export function climateRules(settings: Partial<ClimateRules> = {}): ClimateRules {
  return Object.fromEntries(
    Object.keys(climateRuleFields).map((key) => [
      key,
      settings[key as keyof ClimateRules] ?? defaults[key as keyof ClimateRules],
    ]),
  ) as ClimateRules;
}
export function climateRulesError(settings: Partial<ClimateRules>) {
  const rules = climateRules(settings);
  if (rules.climateWinterWetMin > rules.climateWinterWetMax)
    return 'Winter wet-event minimum must not exceed its maximum';
}

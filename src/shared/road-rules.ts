// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const roadRuleFields = {
  roadGrowthPerDay: {
    label: 'Dirt-road growth (metres/game day; 0 pauses)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  roadWidth: { label: 'New dirt-road width (metres)', min: 2, max: 20, step: 0.5 },
  roadFords: { label: 'Allow dirt roads through usable fords' },
  groundWaterDepth: {
    label: 'Ground vehicle and ford depth limit (metres)',
    min: 0,
    max: 2,
    step: 0.05,
  },
  roadMaxGrade: { label: 'Maximum road grade (rise/run)', min: 0.01, max: 0.5, step: 0.01 },
} as const;
export type RoadRules = Pick<typeof defaults, keyof typeof roadRuleFields>;
export function roadRules(settings: Partial<RoadRules> = {}): RoadRules {
  return Object.fromEntries(
    Object.keys(roadRuleFields).map((key) => [
      key,
      settings[key as keyof RoadRules] ?? defaults[key as keyof RoadRules],
    ]),
  ) as RoadRules;
}

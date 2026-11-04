// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';

export const walkingRuleFields = {
  walkingSnow: { label: 'Slow walking in snow' },
  walkingSnowScale: { label: 'Walking field snow strength', min: 0, max: 2 },
} as const;
export type WalkingRules = Pick<typeof defaults, keyof typeof walkingRuleFields>;
export function walkingRules(settings: Partial<WalkingRules> = {}): WalkingRules {
  return {
    walkingSnow: settings.walkingSnow ?? defaults.walkingSnow,
    walkingSnowScale: settings.walkingSnowScale ?? defaults.walkingSnowScale,
  };
}

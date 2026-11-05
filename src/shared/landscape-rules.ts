// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const landscapeRuleFields = {
  terrainStampLimit: { label: 'Terrain stamps', min: 0, max: 512, step: 1 },
  landscapePathLimit: { label: 'Paths', min: 0, max: 64, step: 1 },
  landscapeBarrierLimit: { label: 'Barriers', min: 0, max: 64, step: 1 },
  landscapeSurfaceLimit: { label: 'Surface brushes', min: 0, max: 256, step: 1 },
  landscapeScatterGroupLimit: { label: 'Scatter groups', min: 0, max: 64, step: 1 },
  landscapeScatterPerGroupLimit: {
    label: 'Instances per scatter group',
    min: 0,
    max: 128,
    step: 1,
  },
  landscapeScatterLimit: { label: 'Scattered instances per world', min: 0, max: 512, step: 1 },
  landscapeLinePointLimit: { label: 'Points per path or barrier', min: 2, max: 32, step: 1 },
  landscapePointLimit: { label: 'Path and barrier points per world', min: 0, max: 512, step: 1 },
  landscapeBarrierLengthLimit: { label: 'Total barrier length (m)', min: 0, max: 4800, step: 1 },
} as const;
export type LandscapeRules = Pick<typeof defaults, keyof typeof landscapeRuleFields>;
export function landscapeRules(settings: Partial<LandscapeRules> = {}): LandscapeRules {
  return Object.fromEntries(
    Object.keys(landscapeRuleFields).map((key) => [
      key,
      settings[key as keyof LandscapeRules] ?? defaults[key as keyof LandscapeRules],
    ]),
  ) as LandscapeRules;
}
/** Parsing ceiling for saved designs; local capacities are checked after their settings. */
export const landscapeRuleCeilings = Object.fromEntries(
  Object.entries(landscapeRuleFields).map(([key, field]) => [key, field.max]),
) as LandscapeRules;

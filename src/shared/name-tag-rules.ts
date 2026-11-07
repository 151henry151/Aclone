// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const nameTagFields = {
  pilotNameTags: { label: 'Show pilot name tags' },
  pilotNameTagRange: { label: 'Name-tag visibility range (metres)', min: 1, max: 1000, step: 1 },
  pilotNameTagFadeStart: { label: 'Name-tag fade starts (metres)', min: 0, max: 1000, step: 1 },
  pilotNameTagScale: { label: 'Name-tag model scale', min: 0.1, max: 2, step: 0.05 },
  pilotNameTagOpacity: { label: 'Name-tag opacity', min: 0, max: 1, step: 0.05 },
  pilotNameTagMaxPixels: { label: 'Maximum name-tag height (pixels)', min: 8, max: 64, step: 1 },
} as const;
export type NameTagRules = Pick<typeof defaults, keyof typeof nameTagFields>;
export function nameTagRules(settings: Partial<NameTagRules> = {}): NameTagRules {
  return Object.fromEntries(
    Object.keys(nameTagFields).map((key) => [
      key,
      settings[key as keyof NameTagRules] ?? defaults[key as keyof NameTagRules],
    ]),
  ) as NameTagRules;
}

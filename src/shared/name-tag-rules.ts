// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const nameTagFields = {
  worldNameTags: { label: 'Show building and parked vehicle names' },
  worldNameTagRange: { label: 'Building/vehicle name range (metres)', min: 1, max: 1000, step: 1 },
  worldNameTagFadeStart: {
    label: 'Building/vehicle name fade starts (metres)',
    min: 0,
    max: 1000,
    step: 1,
  },
  worldNameTagMaxPixels: { label: 'Context name height cap (pixels)', min: 8, max: 64, step: 1 },
  worldNameTagOpacity: { label: 'Building/vehicle name opacity', min: 0, max: 1, step: 0.05 },
  focusNameTags: { label: 'Show names only near the viewing direction' },
  nameTagFocusRadius: {
    label: 'Name focus radius (fraction of screen height)',
    min: 0.05,
    max: 2,
    step: 0.05,
  },
  nameTagMaxVisible: { label: 'Maximum visible contextual names', min: 1, max: 30, step: 1 },
  nameTagOverlapPadding: { label: 'Space between names (pixels)', min: 0, max: 32, step: 1 },
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

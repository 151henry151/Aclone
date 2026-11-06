// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const meatRuleFields = {
  butchersEnabled: { label: 'Allow butchers and slaughter' },
  slaughterFeeFraction: {
    label: 'Default slaughter fee / animal value',
    min: 0,
    max: 10,
    step: 0.01,
  },
  slaughterSeconds: { label: 'Slaughter service seconds per animal', min: 1, max: 86400, step: 1 },
  slaughterWalkingWeight: {
    label: 'Maximum weight of a single walked animal',
    min: 0,
    max: 100,
    step: 0.1,
  },
  slaughterRange: { label: 'Slaughter ramp service reach (metres)', min: 1, max: 30, step: 0.5 },
  slaughterStoppedSpeed: {
    label: 'Slaughter maximum stopped speed (m/s)',
    min: 0,
    max: 2,
    step: 0.1,
  },
  beefYield: { label: 'Raw beef per cow', min: 1, max: 1000, step: 1 },
  porkYield: { label: 'Raw pork per pig', min: 1, max: 1000, step: 1 },
  muttonYield: { label: 'Raw mutton per sheep', min: 1, max: 1000, step: 1 },
  poultryYield: { label: 'Raw poultry per chicken', min: 1, max: 1000, step: 1 },
  slaughterCompostYield: {
    label: 'Compost by-product per slaughtered animal',
    min: 0,
    max: 1000,
    step: 1,
  },
  rawMeatSpoilageDays: {
    label: 'Unchilled raw-meat lifetime (game days; 0 disables)',
    min: 0,
    max: 3650,
    step: 0.1,
  },
  rawMeatEdible: { label: 'Allow eating raw meat' },
  rawMeatFood: { label: 'Raw-meat hunger relief when edible', min: 0, max: 100000, step: 1 },
  rawMeatDrink: { label: 'Raw-meat thirst relief when edible', min: 0, max: 100000, step: 1 },
  rawMeatHealth: { label: 'Raw-meat health relief when edible', min: 0, max: 100000, step: 1 },
  homeCookingEnabled: { label: 'Allow home cooking' },
  homeCookingSeconds: { label: 'Home cooking seconds per batch', min: 1, max: 86400, step: 1 },
  homeCookingYield: { label: 'Home cooking meals per batch', min: 1, max: 1000, step: 1 },
  meatMealYield: { label: 'Business meat meals per batch', min: 1, max: 1000, step: 1 },
  cookedSteakYield: {
    label: 'Cooked Steak portions per business batch',
    min: 1,
    max: 1000,
    step: 1,
  },
} as const;
export type MeatRules = Pick<typeof defaults, keyof typeof meatRuleFields>;
export function meatRules(settings: Partial<MeatRules> = {}): MeatRules {
  return Object.fromEntries(
    Object.keys(meatRuleFields).map((key) => [
      key,
      settings[key as keyof MeatRules] ?? defaults[key as keyof MeatRules],
    ]),
  ) as MeatRules;
}

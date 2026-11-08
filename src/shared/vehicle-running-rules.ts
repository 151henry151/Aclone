// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const vehicleRunningRuleFields = {
  tractorReverseLights: { label: 'Automatic tractor reversing lights' },
  tractorReverseLightIntensity: {
    label: 'Reversing light intensity (0 = off)',
    min: 0,
    max: 1000,
    step: 1,
  },
  tractorReverseLightRange: { label: 'Reversing light reach (metres)', min: 1, max: 100, step: 1 },
  vehicleWearPerMetre: {
    label: 'Condition loss per metre (0 = no distance wear)',
    min: 0,
    max: 1,
    step: 0.0001,
  },
  trailerSpeedBase: { label: 'Trailer speed denominator base', min: 1, max: 10, step: 0.01 },
  trailerFuelBase: { label: 'Trailer fuel multiplier base', min: 1, max: 10, step: 0.01 },
  trailerLoadSpeedPenalty: { label: 'Trailer speed load coefficient', min: 0, max: 10, step: 0.01 },
  trailerLoadFuelPenalty: { label: 'Trailer fuel load coefficient', min: 0, max: 10, step: 0.01 },
} as const;
export type VehicleRunningRules = Pick<typeof defaults, keyof typeof vehicleRunningRuleFields>;
export function vehicleRunningRules(
  settings: Partial<VehicleRunningRules> = {},
): VehicleRunningRules {
  return Object.fromEntries(
    Object.keys(vehicleRunningRuleFields).map((key) => [
      key,
      settings[key as keyof VehicleRunningRules] ?? defaults[key as keyof VehicleRunningRules],
    ]),
  ) as VehicleRunningRules;
}

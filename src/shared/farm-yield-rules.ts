// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const farmYieldRuleFields = {
  farmRipeQualitySeconds: {
    label: 'Full ripe-quality window (real seconds)',
    min: 0,
    max: 604800,
    step: 1,
  },
  farmLateMaximumLoss: {
    label: 'Maximum late-harvest loss (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  farmLateLossPerDay: {
    label: 'Late-harvest loss per game day (fraction)',
    min: 0,
    max: 1,
    step: 0.001,
  },
  farmIrrigationBaseline: { label: 'Baseline moisture', min: 0, max: 5, step: 0.01 },
  farmIrrigationRain: { label: 'Rain contribution', min: 0, max: 5, step: 0.01 },
  farmIrrigationTreatment: { label: 'Moisture per watering', min: 0, max: 5, step: 0.01 },
  farmIrrigationCap: { label: 'Moisture cap', min: 0, max: 1, step: 0.01 },
  farmIrrigationDryYield: { label: 'Dry yield multiplier', min: 0, max: 5, step: 0.01 },
  farmIrrigationMoistureYield: {
    label: 'Yield multiplier per moisture unit',
    min: 0,
    max: 5,
    step: 0.01,
  },
  farmIrrigationWaterCost: {
    label: 'Water per treatment (zero is free)',
    min: 0,
    max: 1000,
    step: 1,
  },
  farmIrrigationTreatments: {
    label: 'Maximum watering treatments (zero disables)',
    min: 0,
    max: 100,
    step: 1,
  },
  farmWheatThirst: { label: 'Wheat thirst', min: 0.01, max: 10, step: 0.01 },
  farmPotatoesThirst: { label: 'Potatoes thirst', min: 0.01, max: 10, step: 0.01 },
  farmHopsThirst: { label: 'Hops thirst', min: 0.01, max: 10, step: 0.01 },
  farmGrapesThirst: { label: 'Grapes thirst', min: 0.01, max: 10, step: 0.01 },
  farmTeaThirst: { label: 'Tea thirst', min: 0.01, max: 10, step: 0.01 },
  farmCoffeeThirst: { label: 'Coffee thirst', min: 0.01, max: 10, step: 0.01 },
  farmHayThirst: { label: 'Hay thirst', min: 0.01, max: 10, step: 0.01 },

  farmCompostYieldBonus: { label: 'Compost yield bonus (fraction)', min: 0, max: 5, step: 0.01 },
  farmRotationYieldPenalty: {
    label: 'Repeated crop-family penalty (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
} as const;
export type FarmYieldRules = Pick<typeof defaults, keyof typeof farmYieldRuleFields>;
export function farmYieldRules(settings: Partial<FarmYieldRules> = {}): FarmYieldRules {
  return Object.fromEntries(
    Object.keys(farmYieldRuleFields).map((key) => [
      key,
      settings[key as keyof FarmYieldRules] ?? defaults[key as keyof FarmYieldRules],
    ]),
  ) as FarmYieldRules;
}

export const cropThirstKeys = {
  wheat: 'farmWheatThirst',
  potatoes: 'farmPotatoesThirst',
  hops: 'farmHopsThirst',
  grapes: 'farmGrapesThirst',
  tea: 'farmTeaThirst',
  coffee: 'farmCoffeeThirst',
  hay: 'farmHayThirst',
} as const;

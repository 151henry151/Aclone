// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const waterSourceRuleFields = {
  springsEnabled: { label: 'Enable springs' },
  springTargetCount: { label: 'Target spring count for new surveys', min: 0, max: 500, step: 1 },
  springMinimumElevation: {
    label: 'Minimum ordinary spring elevation above sea (m)',
    min: 0,
    max: 3000,
    step: 1,
  },
  springLowElevation: { label: 'Lower elevation curve point (m)', min: 0, max: 3000, step: 1 },
  springHighElevation: { label: 'Upper elevation curve point (m)', min: 1, max: 5000, step: 1 },
  springLowChance: { label: 'Candidate chance at lower elevation', min: 0, max: 1, step: 0.01 },
  springHighChance: { label: 'Candidate chance at upper elevation', min: 0, max: 1, step: 0.01 },
  springSpacing: { label: 'Minimum ordinary spring spacing (m)', min: 10, max: 2000, step: 1 },
  springWaterClearance: {
    label: 'Ordinary spring clearance from other water (m)',
    min: 0,
    max: 500,
    step: 1,
  },
  springMinimumNormalY: {
    label: 'Minimum spring slope normal Y (1 is flat)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  springHeadwaters: { label: 'Guarantee a spring at each river head' },
  springMinimumFlow: {
    label: 'Minimum ordinary spring flow multiplier',
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  springMaximumFlow: {
    label: 'Maximum ordinary spring flow multiplier',
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  springHeadwaterFlow: { label: 'Headwater spring flow multiplier', min: 0.1, max: 5, step: 0.1 },
  springBasinDiameter: { label: 'Spring basin diameter (m)', min: 1, max: 12, step: 0.5 },
  springDampDiameter: { label: 'Damp ground diameter (m)', min: 2, max: 24, step: 0.5 },
  springTrickleLength: { label: 'Downhill trickle length (m)', min: 1, max: 12, step: 0.5 },
  springDrinkingEnabled: { label: 'Allow free drinking from springs' },
  springDrinkRange: { label: 'Spring drinking reach (m)', min: 0.5, max: 10, step: 0.5 },
  springDrinkCooldown: { label: 'Spring drinking cooldown (seconds)', min: 0, max: 3600, step: 1 },
  pumpFuelPerBatch: { label: 'Pump-house fuel per batch', min: 0, max: 100, step: 1 },
  pumpWaterPerBatch: { label: 'Pump-house water per batch', min: 1, max: 1000, step: 1 },
  pumpGravityEnabled: { label: 'Allow fuel-free gravity-fed spring pumps' },
  pumpGravityWaterPerBatch: { label: 'Gravity-fed water per batch', min: 1, max: 1000, step: 1 },
  pumpFlowScaling: { label: 'Scale spring pump output with source flow' },
  pumpIntakeDepth: { label: 'Minimum fresh intake depth (m)', min: 0.05, max: 10, step: 0.05 },
  pumpFreeboard: {
    label: 'Pump foundation clearance above fresh water (m)',
    min: 0,
    max: 3,
    step: 0.1,
  },
  pumpIntakeMinReach: { label: 'Minimum rear intake reach (m)', min: 1, max: 20, step: 1 },
  pumpIntakeMaxReach: { label: 'Maximum rear intake reach (m)', min: 1, max: 30, step: 1 },
  pumpSpringSnapRange: { label: 'Spring intake snapping reach (m)', min: 0, max: 20, step: 0.5 },
  pumpRiverSpacing: {
    label: 'Pump-house spacing on the same river (m)',
    min: 0,
    max: 1000,
    step: 1,
  },
  desalinationRequiresOcean: { label: 'Require true ocean for new desalination plants' },
  desalinationIntakeDepth: {
    label: 'Minimum sea-water intake depth (m)',
    min: 0.05,
    max: 10,
    step: 0.05,
  },
  desalinationFreeboard: {
    label: 'Desalination foundation clearance above sea (m)',
    min: 0,
    max: 3,
    step: 0.1,
  },
  desalinationIntakeMinReach: {
    label: 'Minimum desalination rear intake reach (m)',
    min: 1,
    max: 20,
    step: 1,
  },
  desalinationIntakeMaxReach: {
    label: 'Maximum desalination rear intake reach (m)',
    min: 1,
    max: 30,
    step: 1,
  },
} as const;
export type WaterSourceRules = Pick<typeof defaults, keyof typeof waterSourceRuleFields>;
export function waterSourceRules(settings: Partial<WaterSourceRules> = {}): WaterSourceRules {
  return Object.fromEntries(
    Object.keys(waterSourceRuleFields).map((key) => [
      key,
      settings[key as keyof WaterSourceRules] ?? defaults[key as keyof WaterSourceRules],
    ]),
  ) as WaterSourceRules;
}

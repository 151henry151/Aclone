// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const stormRuleFields = {
  capsizeEnabled: { label: 'Enable storm capsizing' },
  capsizeCadence: { label: 'Capsize evaluation interval (seconds)', min: 1, max: 60, step: 1 },
  capsizeSmallRate: {
    label: 'Small craft base capsize probability per minute',
    min: 0,
    max: 1,
    step: 0.01,
  },
  capsizeCoastalRate: {
    label: 'Coastal craft base capsize probability per minute',
    min: 0,
    max: 1,
    step: 0.01,
  },
  capsizeDistanceScale: {
    label: 'Shore distance risk scale (metres)',
    min: 1,
    max: 10000,
    step: 1,
  },
  capsizeDistanceMultiplier: {
    label: 'Maximum distance risk multiplier',
    min: 1,
    max: 10,
    step: 0.1,
  },
  capsizeWaveReference: {
    label: 'Reference storm amplitude (metres)',
    min: 0.1,
    max: 10,
    step: 0.1,
  },
  capsizeShoreShelter: {
    label: 'Small craft sheltered shore band (metres)',
    min: 0,
    max: 1000,
    step: 1,
  },
  capsizeOceanDepth: {
    label: 'Coastal craft ocean danger depth (metres)',
    min: 1,
    max: 2000,
    step: 1,
  },
  capsizeOceanShore: {
    label: 'Coastal craft ocean danger shore clearance (metres)',
    min: 1,
    max: 10000,
    step: 1,
  },
  capsizeLargeWave: {
    label: 'Coastal craft large-storm amplitude (metres)',
    min: 0.1,
    max: 10,
    step: 0.1,
  },
  capsizeForecastSeconds: {
    label: 'Storm warning look-ahead (seconds)',
    min: 0,
    max: 3600,
    step: 1,
  },
  capsizeGraceSeconds: {
    label: 'Minimum guaranteed escape time (seconds)',
    min: 0,
    max: 7200,
    step: 1,
  },
  capsizeEscapeMultiplier: {
    label: 'Calculated return-time safety multiplier',
    min: 0,
    max: 10,
    step: 0.1,
  },
  capsizeTurnSeconds: {
    label: 'Extra escape turning allowance (seconds)',
    min: 0,
    max: 600,
    step: 1,
  },
  capsizeRampSeconds: {
    label: 'Risk ramp after escape time (seconds)',
    min: 0,
    max: 7200,
    step: 1,
  },
} as const;
export type StormRules = Pick<typeof defaults, keyof typeof stormRuleFields>;
export function stormRules(settings: Partial<StormRules> = {}): StormRules {
  return Object.fromEntries(
    Object.keys(stormRuleFields).map((key) => [
      key,
      settings[key as keyof StormRules] ?? defaults[key as keyof StormRules],
    ]),
  ) as StormRules;
}

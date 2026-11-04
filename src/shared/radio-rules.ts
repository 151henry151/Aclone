// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const radioRuleFields = {
  radioEnabled: { label: 'Enable vehicle CB radios' },
  radioChannelCount: { label: 'Number of channels', min: 1, max: 80, step: 1 },
  radioDefaultChannel: { label: 'Default road channel', min: 1, max: 80, step: 1 },
  radioEmergencyChannel: { label: 'Emergency channel', min: 1, max: 80, step: 1 },
  radioRange: { label: 'Ground radio range (metres)', min: 100, max: 50000, step: 100 },
  radioWaterRange: { label: 'Over-water range multiplier', min: 1, max: 5, step: 0.1 },
  radioGroundAntenna: { label: 'Ground antenna height (metres)', min: 0.1, max: 20, step: 0.1 },
  radioBoatAntenna: { label: 'Boat antenna height (metres)', min: 0.1, max: 30, step: 0.1 },
  radioAircraftAntenna: { label: 'Aircraft antenna height (metres)', min: 0.1, max: 20, step: 0.1 },
  radioHeightScale: { label: 'Height for additional range (metres)', min: 10, max: 1000, step: 10 },
  radioTerrainAttenuation: {
    label: 'Signal loss per obstructing metre',
    min: 0,
    max: 1,
    step: 0.01,
  },
  radioTerrainSamples: { label: 'Terrain samples per radio path', min: 3, max: 32, step: 1 },
  radioCharsPerSecond: { label: 'Spoken characters per second', min: 1, max: 60, step: 1 },
  radioMinDuration: {
    label: 'Minimum transmission duration (seconds)',
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  radioSimultaneousWindow: {
    label: 'Simultaneous-key interval (seconds)',
    min: 0.01,
    max: 0.5,
    step: 0.01,
  },
  radioMaxLength: { label: 'Transmission character limit', min: 1, max: 1200, step: 1 },
  radioHandleLength: { label: 'Call-sign character limit', min: 1, max: 80, step: 1 },
  radioClearSignal: { label: 'Clear reception signal threshold', min: 0.1, max: 1, step: 0.01 },
  radioStaticSignal: { label: 'Static signal threshold', min: 0, max: 0.9, step: 0.01 },
  radioDefaultSquelch: { label: 'Default squelch', min: 0, max: 1, step: 0.01 },
  radioLogLimit: { label: 'Received transmissions retained', min: 1, max: 100, step: 1 },
  radioRescuePrompts: { label: 'Show emergency-channel rescue prompts' },
  radioRescueRange: { label: 'Rescue prompt range (metres)', min: 100, max: 50000, step: 100 },
  radioModeration: { label: 'Apply public chat mute and lock rules' },
  radioResidents: { label: 'Allow resident radio use' },
} as const;
export type RadioRules = Pick<typeof defaults, keyof typeof radioRuleFields>;
export function radioRules(settings: Partial<RadioRules> = {}): RadioRules {
  return Object.fromEntries(
    Object.keys(radioRuleFields).map((key) => [
      key,
      settings[key as keyof RadioRules] ?? defaults[key as keyof RadioRules],
    ]),
  ) as RadioRules;
}

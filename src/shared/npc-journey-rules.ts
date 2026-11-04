// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcJourneyRuleFields = {
  npcJourneyDistanceMultiplier: {
    label: 'Journey distance multiplier',
    min: 1,
    max: 10,
    step: 0.1,
  },
  npcJourneySpeedFraction: {
    label: 'Journey speed estimate fraction',
    min: 0.01,
    max: 1,
    step: 0.01,
  },
  npcJourneyFuelFallbackPrice: {
    label: 'Unquoted Fuel allowance (hundredths per item)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcEquipmentPaybackLoads: {
    label: 'Gathering equipment payback allowance (loads)',
    min: 0,
    max: 1000,
    step: 0.25,
  },
  npcDriveFuelThreshold: {
    label: 'Optional refuelling threshold (tank units)',
    min: 0,
    max: 1000000,
    step: 0.5,
  },
} as const;
export type NpcJourneyRules = Pick<typeof defaults, keyof typeof npcJourneyRuleFields>;
export function npcJourneyRules(settings: Partial<NpcJourneyRules> = {}): NpcJourneyRules {
  return Object.fromEntries(
    Object.keys(npcJourneyRuleFields).map((key) => [
      key,
      settings[key as keyof NpcJourneyRules] ?? defaults[key as keyof NpcJourneyRules],
    ]),
  ) as NpcJourneyRules;
}

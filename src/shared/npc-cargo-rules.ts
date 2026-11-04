// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcCargoRuleFields = {
  npcGeneralSupplyTarget: {
    label: 'General supply target / free-source allowance (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcConstructionLoadLimit: {
    label: 'Construction / general purchase ceiling (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcParishSupplyLoadLimit: {
    label: 'Parish order supplier load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcGeneralTradeLoadLimit: { label: 'General trading load (items)', min: 0, max: 10000, step: 1 },
  npcStorageDepositLoadLimit: {
    label: 'Owned stockroom deposit load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcStorageWithdrawalLoadLimit: {
    label: 'Owned stockroom withdrawal load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcRoomStorageLoadLimit: {
    label: 'Room pantry transfer load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcCareerTradeLoadLimit: { label: 'Trading career load (items)', min: 0, max: 10000, step: 1 },
} as const;
export type NpcCargoRules = Pick<typeof defaults, keyof typeof npcCargoRuleFields>;
export function npcCargoRules(settings: Partial<NpcCargoRules> = {}): NpcCargoRules {
  return Object.fromEntries(
    Object.keys(npcCargoRuleFields).map((key) => [
      key,
      settings[key as keyof NpcCargoRules] ?? defaults[key as keyof NpcCargoRules],
    ]),
  ) as NpcCargoRules;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcReserveRuleFields = {
  npcCareCashFloor: {
    label: 'Emergency cash reserve floor (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcBankCashFloor: {
    label: 'Banking cash reserve floor (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcBankDepositShare: {
    label: 'Share of surplus cash deposited (fraction)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  npcBankMinimumDeposit: {
    label: 'Minimum planned bank deposit (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcPortableWater: { label: 'Portable Water reserve (items)', min: 0, max: 100, step: 1 },
  npcPortableBread: { label: 'Portable Bread reserve (items)', min: 0, max: 100, step: 1 },
  npcPortableMinimum: {
    label: 'Minimum other food/drink reserve (items)',
    min: 0,
    max: 100,
    step: 1,
  },
  npcPortableMaximum: {
    label: 'Maximum other food/drink reserve (items)',
    min: 0,
    max: 100,
    step: 1,
  },
  npcPortableNutrition: {
    label: 'Other portable food/drink nutrition target',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcPortableEquipment: {
    label: 'Portable tools/tackle/Fuel reserve (each)',
    min: 0,
    max: 100,
    step: 1,
  },
  npcFishingSurplus: {
    label: 'Fish allowed above the portable reserve',
    min: 0,
    max: 100,
    step: 1,
  },
  npcTradeFoodReserve: {
    label: 'Food retained by opportunistic trades (items)',
    min: 0,
    max: 100,
    step: 1,
  },
  npcTradeDrinkReserve: {
    label: 'Drink retained by opportunistic trades (items)',
    min: 0,
    max: 100,
    step: 1,
  },
} as const;
export type NpcReserveRules = Pick<typeof defaults, keyof typeof npcReserveRuleFields>;
export function npcReserveRules(settings: Partial<NpcReserveRules> = {}): NpcReserveRules {
  return Object.fromEntries(
    Object.keys(npcReserveRuleFields).map((key) => [
      key,
      settings[key as keyof NpcReserveRules] ?? defaults[key as keyof NpcReserveRules],
    ]),
  ) as NpcReserveRules;
}
export function npcReserveRulesError(settings: Partial<NpcReserveRules>) {
  const r = npcReserveRules(settings);
  if (r.npcPortableMinimum > r.npcPortableMaximum)
    return 'Portable reserve minimum must not exceed its maximum';
}

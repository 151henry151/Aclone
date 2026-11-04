// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcHouseholdRuleFields = {
  npcAdviceCashFloor: {
    label: 'Living advice minimum cash (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcAdviceMealItems: {
    label: 'Living advice meal allowance (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcAdviceDrinkItems: {
    label: 'Living advice drink allowance (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcShoppingFuelTarget: {
    label: 'Portable shopping Fuel target (items; 0 disables)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcShoppingDrinkTarget: {
    label: 'Portable shopping drink target (total items; 0 disables)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcShoppingFoodTarget: {
    label: 'Portable shopping food target (total items; 0 disables)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcPantryNeedAllowance: {
    label: 'Pantry forecast need allowance',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcUnhousedProvisionItems: {
    label: 'Provision target without a home (items)',
    min: 0,
    max: 100,
    step: 1,
  },
  npcProvisionDrinkCashReserve: {
    label: 'Drink cash protected when buying food (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcProvisionBatchLimit: {
    label: 'Maximum pantry shopping batch (items; 0 stops shopping)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcLodgingBufferSeconds: {
    label: 'Extra lodging booking time (real seconds)',
    min: 0,
    max: 86400,
    step: 1,
  },
  npcLodgingCashReserve: {
    label: 'Cash retained after a room booking (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcStrategicSeconds: {
    label: 'Strategic household reserve horizon (real seconds)',
    min: 60,
    max: 604800,
    step: 1,
  },
  npcPantryBufferSeconds: {
    label: 'Extra pantry coverage (real seconds)',
    min: 0,
    max: 86400,
    step: 1,
  },
  npcHouseholdSeconds: {
    label: 'Household forecast horizon (real seconds)',
    min: 60,
    max: 604800,
    step: 1,
  },
  npcBudgetNeedAllowance: {
    label: 'Household forecast need allowance',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcBudgetCarriedShare: {
    label: 'Carried nutrition credited in household budget (fraction)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  npcBudgetFuelThreshold: {
    label: 'Tank level below which to reserve a Fuel purchase',
    min: 0,
    max: 1000000,
    step: 0.5,
  },
} as const;
export type NpcHouseholdRules = Pick<typeof defaults, keyof typeof npcHouseholdRuleFields>;
export function npcHouseholdRules(settings: Partial<NpcHouseholdRules> = {}): NpcHouseholdRules {
  return Object.fromEntries(
    Object.keys(npcHouseholdRuleFields).map((key) => [
      key,
      settings[key as keyof NpcHouseholdRules] ?? defaults[key as keyof NpcHouseholdRules],
    ]),
  ) as NpcHouseholdRules;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcHouseholdRuleFields = {
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

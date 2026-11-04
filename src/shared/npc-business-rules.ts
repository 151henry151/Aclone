// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcBusinessRuleFields = {
  npcPayrollReserveBatches: {
    label: 'Production payroll reserve (cycles)',
    min: 0,
    max: 1000,
    step: 1,
  },
  npcMinimumPayrolls: { label: 'Minimum funded payrolls', min: 0, max: 1000, step: 1 },
  npcBusinessCashFloor: {
    label: 'Business cash reserve floor (hundredths)',
    min: 0,
    max: 100000000,
    step: 1,
  },
  npcStartupBatches: {
    label: 'Construction startup operating batches',
    min: 0,
    max: 1000,
    step: 1,
  },
  npcStartupMaterialMultiplier: {
    label: 'Construction material budget multiplier',
    min: 1,
    max: 10,
    step: 0.05,
  },
  npcHayReserveItems: { label: 'Hay merchant stock reserve (bales)', min: 0, max: 10000, step: 1 },
  npcHayCustomerStockLimit: {
    label: 'Hay customer stock cutoff (bales)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcHayCustomerFundedItems: {
    label: 'Hay customer funded purchase minimum (bales)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcInputReserveBatches: { label: 'Minimum input reserve (batches)', min: 0, max: 1000, step: 1 },
  npcInputMaximumBatches: {
    label: 'Maximum sales-driven input reserve (batches)',
    min: 0,
    max: 1000,
    step: 1,
  },
  npcInputSalesHours: {
    label: 'Observed sales covered by input reserve (hours)',
    min: 0,
    max: 168,
    step: 0.5,
  },
  npcOutputCapacityShare: { label: 'Output backlog capacity fraction', min: 0, max: 1, step: 0.05 },
  npcOutputMinimumBatches: {
    label: 'Minimum output backlog threshold (batches)',
    min: 0,
    max: 1000,
    step: 1,
  },
  npcOutputBufferMultiplier: {
    label: 'Output backlog multiple of input batches',
    min: 0,
    max: 10,
    step: 0.5,
  },
} as const;
export type NpcBusinessRules = Pick<typeof defaults, keyof typeof npcBusinessRuleFields>;
export function npcBusinessRules(settings: Partial<NpcBusinessRules> = {}): NpcBusinessRules {
  return Object.fromEntries(
    Object.keys(npcBusinessRuleFields).map((key) => [
      key,
      settings[key as keyof NpcBusinessRules] ?? defaults[key as keyof NpcBusinessRules],
    ]),
  ) as NpcBusinessRules;
}
export function npcBusinessRulesError(settings: Partial<NpcBusinessRules>) {
  const r = npcBusinessRules(settings);
  if (r.npcInputReserveBatches > r.npcInputMaximumBatches)
    return 'Input reserve minimum must not exceed its maximum';
}

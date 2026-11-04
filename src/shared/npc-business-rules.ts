// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcBusinessRuleFields = {
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

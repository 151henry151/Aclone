// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcBusinessLoadRuleFields = {
  npcRoutineSupplyBatches: {
    label: 'Fallback input purchase target (batches)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcRoutineDepositBatches: {
    label: 'Fallback carried input target (batches)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcCropDemandBatches: {
    label: 'Crop demand forecast (buyer batches)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcBusinessCollectionLoad: {
    label: 'Business output collection (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcSmallInputPurchaseLoad: {
    label: 'Small input purchase load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcSmallInputPurchaseBatches: {
    label: 'Small input restock threshold (batches)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcCarriedSurplusSaleLoad: {
    label: 'Carried surplus sale load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcFarmCollectionLoad: { label: 'Farm crop collection (items)', min: 0, max: 10000, step: 1 },
  npcOwnedSourceReserveBatches: {
    label: 'Owned supplier input reserve (batches)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcBusinessOutputSaleLoad: {
    label: 'Business output sale load (items)',
    min: 0,
    max: 10000,
    step: 1,
  },
  npcFarmOutputSaleLoad: { label: 'Farm output sale load (items)', min: 0, max: 10000, step: 1 },
} as const;
export type NpcBusinessLoadRules = Pick<typeof defaults, keyof typeof npcBusinessLoadRuleFields>;
export function npcBusinessLoadRules(
  settings: Partial<NpcBusinessLoadRules> = {},
): NpcBusinessLoadRules {
  return Object.fromEntries(
    Object.keys(npcBusinessLoadRuleFields).map((key) => [
      key,
      settings[key as keyof NpcBusinessLoadRules] ?? defaults[key as keyof NpcBusinessLoadRules],
    ]),
  ) as NpcBusinessLoadRules;
}

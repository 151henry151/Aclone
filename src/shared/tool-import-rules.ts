// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import { catalogueItemId } from './world-catalogue';

export const toolImportFields = {
  toolImports: { label: 'Occasional scarce-tool imports' },
  toolImportItems: { label: 'Eligible item IDs (comma-separated)' },
  toolImportInterval: {
    label: 'Delivery check interval (world seconds)',
    min: 60,
    max: 86400,
    step: 1,
  },
  toolImportChance: { label: 'Chance per check (0–1)', min: 0, max: 1, step: 0.01 },
  toolImportQuantity: { label: 'Units per successful delivery', min: 1, max: 100, step: 1 },
  toolImportStockCap: { label: 'Import shelf cap per item', min: 1, max: 1000, step: 1 },
  toolImportScarcity: {
    label: 'Supply only below this total shop stock',
    min: 1,
    max: 1000,
    step: 1,
  },
  toolImportPremium: {
    label: 'Minimum retail premium above item value (%)',
    min: 0,
    max: 500,
    step: 1,
  },
  toolImportCostShare: { label: 'Import cost share of retail', min: 0.01, max: 1, step: 0.01 },
  toolImportBidMargin: {
    label: 'Minimum margin above public bids (hundredths of a denarius)',
    min: 1,
    max: 1000000,
    step: 1,
  },
} as const;
export type ToolImportRules = Pick<typeof defaults, keyof typeof toolImportFields>;
export function toolImportRules(settings: Partial<ToolImportRules> = {}): ToolImportRules {
  return Object.fromEntries(
    Object.keys(toolImportFields).map((key) => [
      key,
      settings[key as keyof ToolImportRules] ?? defaults[key as keyof ToolImportRules],
    ]),
  ) as ToolImportRules;
}
export function toolImportPool(value: string) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}
export function validToolImportPool(value: unknown) {
  if (typeof value !== 'string' || value.length > 1024) return false;
  const ids = value.split(',').map((s) => s.trim());
  return (
    ids.length <= 32 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => catalogueItemId.safeParse(id).success)
  );
}

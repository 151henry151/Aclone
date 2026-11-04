// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const fuelRuleFields = {
  fuelUnitsPerItem: { label: 'Tank units per Fuel item', min: 1, max: 10000, step: 1 },
  fuelTankerSales: { label: 'Allow roadside tanker sales' },
  fuelTankerOfflineSales: { label: 'Sell while tanker owner is offline' },
  fuelTankerTransactionLimit: {
    label: 'Maximum Fuel per transaction',
    min: 1,
    max: 10000,
    step: 1,
  },
  fuelTankerPriceCeiling: {
    label: 'Shop price multiplier ceiling (0 = off)',
    min: 0,
    max: 100,
    step: 0.05,
  },
  fuelTankerNpcPurchasing: { label: 'Allow residents to buy roadside Fuel' },
  fuelTankerNpcPriceFactor: {
    label: 'Resident reasonable-price multiplier',
    min: 0,
    max: 100,
    step: 0.05,
  },
  refuelRange: { label: 'Refuelling distance (metres)', min: 1, max: 100, step: 0.5 },
  refuelHeight: {
    label: 'Maximum refuelling height difference (metres)',
    min: 0,
    max: 20,
    step: 0.5,
  },
  refuelSpeed: { label: 'Maximum refuelling speed (metres/second)', min: 0, max: 5, step: 0.1 },
} as const;
export type FuelRules = Pick<typeof defaults, keyof typeof fuelRuleFields>;
export function fuelRules(settings: Partial<FuelRules> = {}): FuelRules {
  return Object.fromEntries(
    Object.keys(fuelRuleFields).map((key) => [
      key,
      settings[key as keyof FuelRules] ?? defaults[key as keyof FuelRules],
    ]),
  ) as FuelRules;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const economyRuleFields = {
  exportShipmentInterval: {
    label: 'Public export shipment interval (real seconds)',
    min: 60,
    max: 86400,
    step: 1,
  },
  parishOrderPeriod: {
    label: 'Parish supply-order round (real seconds)',
    min: 60,
    max: 86400,
    step: 1,
  },
  parishOrderShare: {
    label: 'Early supply-order share per supplier (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  parishOrderShareWindow: {
    label: 'Supply-order share window (fraction of round)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  maximumMoneyGift: {
    label: 'Maximum money gift (hundredths of a denarius)',
    min: 1,
    max: 1000000000,
    step: 1,
  },
  cashTransferLimit: {
    label: 'Maximum bank/investment transfer (hundredths of a denarius)',
    min: 1,
    max: 1000000000,
    step: 1,
  },
  vehicleServiceFee: {
    label: 'Vehicle service labour (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  vehicleServiceSteel: { label: 'Steel per vehicle service', min: 0, max: 100, step: 1 },
  mapPrintPrice: {
    label: 'Printed map price (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  ammunitionRefitPrice: {
    label: 'Ammunition refit price (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  outsideReturnPercent: {
    label: 'Outside investment return above principal (%)',
    min: 0,
    max: 100,
    step: 0.1,
  },
  outsideOperatingReserve: {
    label: 'Minimum operating reserve (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  minimumBuyPrice: {
    label: 'Minimum building purchase bid (hundredths of a denarius)',
    min: 1,
    max: 1000000,
    step: 1,
  },
  transactionItemLimit: { label: 'Maximum items per transaction', min: 1, max: 100000, step: 1 },
} as const;
export type EconomyRules = Pick<typeof defaults, keyof typeof economyRuleFields>;
export function economyRules(settings: Partial<EconomyRules> = {}): EconomyRules {
  return Object.fromEntries(
    Object.keys(economyRuleFields).map((key) => [
      key,
      settings[key as keyof EconomyRules] ?? defaults[key as keyof EconomyRules],
    ]),
  ) as EconomyRules;
}

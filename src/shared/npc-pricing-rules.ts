// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const npcPricingRuleFields = {
  npcHaulageMargin: { label: 'Haulage price spread (fraction)', min: 0, max: 1, step: 0.01 },
  npcTravelTimeValue: {
    label: 'Haulage time value (hundredths per second)',
    min: 0,
    max: 10000,
    step: 0.5,
  },
  npcInputMinimumAllowance: {
    label: 'Minimum input delivery allowance (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcMaximumInputBid: {
    label: 'Maximum planned input bid (hundredths)',
    min: 0,
    max: 10000000,
    step: 1,
  },
  npcBidReopenFraction: {
    label: 'Reopen bids below input target fraction',
    min: 0,
    max: 1,
    step: 0.05,
  },
  npcWageMarginShare: {
    label: 'Post-input revenue available for wages (fraction)',
    min: 0,
    max: 1,
    step: 0.05,
  },
  npcProductionPriceMultiplier: {
    label: 'Sustainable output price multiplier',
    min: 1,
    max: 10,
    step: 0.01,
  },
  npcMinimumOutputAsk: {
    label: 'Minimum sustainable output ask (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  npcSurplusMinimumStock: {
    label: 'Minimum surplus for price review (items)',
    min: 0,
    max: 100000,
    step: 1,
  },
  npcSurplusCapacityShare: {
    label: 'Surplus capacity fraction for price review',
    min: 0,
    max: 1,
    step: 0.05,
  },
  npcPricingMinimumLoad: {
    label: 'Minimum useful markdown delivery (items)',
    min: 1,
    max: 100000,
    step: 1,
  },
  npcPricingMaximumLoad: {
    label: 'Maximum markdown delivery estimate (items)',
    min: 1,
    max: 100000,
    step: 1,
  },
} as const;
export type NpcPricingRules = Pick<typeof defaults, keyof typeof npcPricingRuleFields>;
export function npcPricingRules(settings: Partial<NpcPricingRules> = {}): NpcPricingRules {
  return Object.fromEntries(
    Object.keys(npcPricingRuleFields).map((key) => [
      key,
      settings[key as keyof NpcPricingRules] ?? defaults[key as keyof NpcPricingRules],
    ]),
  ) as NpcPricingRules;
}
export function npcPricingRulesError(settings: Partial<NpcPricingRules>) {
  const r = npcPricingRules(settings);
  if (r.npcPricingMinimumLoad > r.npcPricingMaximumLoad)
    return 'Pricing minimum load must not exceed its maximum';
}

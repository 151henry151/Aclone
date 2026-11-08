// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import { cachedRuleValues } from './cached-rule-values';
export const bridgeRuleFields = {
  bridgeBuilding: { label: 'Allow founding bridge projects' },
  bridgePublicAccess: { label: 'Public bridge access (otherwise owner only)' },
  bridgeToll: {
    label: 'Bridge passage toll (hundredths of a denarius)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  bridgeNarrowWidth: { label: 'Single-lane clear width (m)', min: 3, max: 16, step: 0.1 },
  bridgeWidth: { label: 'Two-lane clear width (m)', min: 3, max: 20, step: 0.1 },
  bridgeMaximumSpan: { label: 'Maximum clear span (m)', min: 5, max: 300, step: 1 },
  bridgeClearance: { label: 'Minimum under-deck river clearance (m)', min: 2, max: 30, step: 0.1 },
  bridgeMaximumGrade: {
    label: 'Maximum approach grade (rise/run)',
    min: 0.01,
    max: 0.2,
    step: 0.01,
  },
  bridgeApproachLength: {
    label: 'Maximum length of each approach (m)',
    min: 10,
    max: 500,
    step: 1,
  },
  bridgeFoundationRise: { label: 'Maximum bank-seat ground rise (m)', min: 0.1, max: 3, step: 0.1 },
  bridgeFoundationLength: { label: 'Bank-seat length (m)', min: 2, max: 10, step: 0.1 },
  bridgeDeckThickness: { label: 'Deck thickness (m)', min: 0.3, max: 2, step: 0.1 },
  bridgeMaximumCount: {
    label: 'Maximum bridges and projects per world',
    min: 1,
    max: 256,
    step: 1,
  },
  bridgeProjectsPerPlayer: { label: 'Unfinished projects per founder', min: 1, max: 32, step: 1 },
  bridgeDepositFraction: {
    label: 'Founding deposit (fraction of cash bill)',
    min: 0.01,
    max: 1,
    step: 0.01,
  },
  bridgeServiceReach: { label: 'Bridge office interaction range (m)', min: 1, max: 100, step: 1 },
  bridgeCashPerSquareMetre: {
    label: 'Main-span cash per m² (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  bridgeSteelPerSquareMetre: { label: 'Steel per main-span m²', min: 0, max: 100, step: 0.001 },
  bridgeWoodPerSquareMetre: { label: 'Wood per main-span m²', min: 0, max: 100, step: 0.001 },
  bridgeStonePerSquareMetre: { label: 'Stone per main-span m²', min: 0, max: 100, step: 0.001 },
  bridgeGravelPerSquareMetre: { label: 'Gravel per main-span m²', min: 0, max: 100, step: 0.001 },
  bridgeApproachCashPerMetre: {
    label: 'Approach cash per metre (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  bridgeApproachGravelPerMetre: { label: 'Approach gravel per metre', min: 0, max: 100, step: 0.1 },
  bridgeApproachStonePerMetre: { label: 'Approach stone per metre', min: 0, max: 100, step: 0.1 },
  bridgeWearPerDay: {
    label: 'Condition wear per economic day (0 disables)',
    min: 0,
    max: 100,
    step: 0.01,
  },
  bridgeMinimumCondition: { label: 'Minimum condition for new entry', min: 0, max: 100, step: 1 },
  bridgeRepairCondition: { label: 'Condition restored per repair', min: 1, max: 100, step: 1 },
  bridgeRepairCash: {
    label: 'Reference-area repair cash (hundredths)',
    min: 0,
    max: 1000000,
    step: 1,
  },
  bridgeRepairSteel: { label: 'Reference-area repair Steel', min: 0, max: 1000, step: 1 },
  bridgeRepairReferenceArea: { label: 'Reference repair area (m²)', min: 1, max: 10000, step: 1 },
} as const;
export type BridgeRules = Pick<typeof defaults, keyof typeof bridgeRuleFields>;
export const bridgeRules = cachedRuleValues(defaults, bridgeRuleFields);

export function bridgeRulesError(settings: Partial<BridgeRules>) {
  const r = bridgeRules(settings);
  if (r.bridgeNarrowWidth > r.bridgeWidth)
    return 'Single-lane bridge width must not exceed two-lane width';
  if (r.bridgeMaximumSpan < 2 * r.bridgeFoundationLength)
    return 'Maximum bridge span must fit both foundation seats';
}

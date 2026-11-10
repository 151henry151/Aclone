// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import { maxCoordinate } from './world-limits';
export const constructionRuleFields = {
  earthworksContracts: { label: 'Allow paid earthworks contracts' },
  earthworksNpcContracts: { label: 'Allow residents to request earthworks contracts' },
  earthworksNpcFeePerVolume: {
    label: 'Resident earthworks offer per cubic metre (hundredths of denarius)',
    min: 0,
    max: 100000,
    step: 1,
  },
  earthworksNpcMaximumContracts: {
    label: 'Maximum outstanding earthworks contracts per resident',
    min: 0,
    max: 10,
    step: 1,
  },
  earthworksBermRadius: { label: 'Earthwork berm radius (m)', min: 0.1, max: 10, step: 0.1 },
  earthworksBermHeight: {
    label: 'Earthwork berm maximum height (m)',
    min: 0.01,
    max: 2,
    step: 0.01,
  },
  earthworksBermFullWeight: {
    label: 'Spoil weight for a full visual berm',
    min: 1,
    max: 10000,
    step: 1,
  },
  earthworksSpeedAssist: { label: 'Limit machine speed while working a surveyed area' },
  earthworksWorkingSpeed: {
    label: 'Maximum earthmoving work speed (m/s)',
    min: 0.1,
    max: 10,
    step: 0.1,
  },
  earthworksDozerVolume: {
    label: 'Bulldozer volume per metre (m³)',
    min: 0.01,
    max: 10,
    step: 0.01,
  },
  earthworksBackhoeVolume: {
    label: 'Backhoe volume per metre (m³)',
    min: 0.01,
    max: 10,
    step: 0.01,
  },
  earthworksStoneEffort: {
    label: 'Stone-bearing earthwork effort multiplier',
    min: 1,
    max: 20,
    step: 0.1,
  },
  earthworksTransferReach: {
    label: 'Earthwork material transfer reach (m)',
    min: 1,
    max: 50,
    step: 1,
  },
  earthworksBucketCapacity: {
    label: 'Backhoe spoil bucket capacity (weight)',
    min: 1,
    max: 1000,
    step: 1,
  },
  earthworksHeapCapacity: {
    label: 'Earthwork spoil heap capacity (weight)',
    min: 1,
    max: 100000,
    step: 1,
  },
  earthworksFillVolume: {
    label: 'Earthwork fill volume per item (m³)',
    min: 0.01,
    max: 100,
    step: 0.01,
  },
  earthworksSpoilConversion: {
    label: 'Earthwork spoil items per cubic metre',
    min: 0,
    max: 0.99,
    step: 0.01,
  },
  earthworksQuarryYieldShare: {
    label: 'Earthwork maximum share of skilled quarry yield',
    min: 0,
    max: 0.99,
    step: 0.01,
  },
  earthworksPublishSeconds: {
    label: 'Earthwork terrain update interval (seconds)',
    min: 0.25,
    max: 5,
    step: 0.25,
  },
  earthworksTolerance: {
    label: 'Earthwork completion tolerance (m)',
    min: 0.01,
    max: 0.5,
    step: 0.01,
  },
  earthworksGrassDays: {
    label: 'Earthwork grass recovery (game days)',
    min: 0.1,
    max: 365,
    step: 0.1,
  },
  earthworksGravelArea: {
    label: 'Gravel surface area per item (m²)',
    min: 0.1,
    max: 100,
    step: 0.1,
  },
  earthworksSurveySide: { label: 'Initial earthwork survey side (m)', min: 1, max: 120, step: 1 },
  earthworksSurveyShoulder: {
    label: 'Initial earthwork survey shoulder (m)',
    min: 1,
    max: 100,
    step: 1,
  },

  earthworksPlantLicence: { label: 'Require plant operator qualification for earthmovers' },
  earthworksEnabled: { label: 'Allow new earthworks' },
  earthworksMaximumSide: { label: 'Maximum earthwork pad side (m)', min: 1, max: 120, step: 1 },
  earthworksMaximumShoulder: {
    label: 'Maximum earthwork shoulder width (m)',
    min: 1,
    max: 100,
    step: 1,
  },
  earthworksMaximumGrade: {
    label: 'Maximum earthwork shoulder grade (%)',
    min: 1,
    max: 100,
    step: 0.1,
  },
  earthworksMaximumDepth: {
    label: 'Maximum earthwork cut or fill depth (m)',
    min: 0.1,
    max: 30,
    step: 0.1,
  },
  earthworksMaximumCount: { label: 'Maximum earthwork pads', min: 0, max: 2048, step: 1 },
  earthworksMaximumArea: {
    label: 'Maximum earthwork area including shoulders (m²)',
    min: 0,
    max: 10000000,
    step: 1,
  },
  earthworksResourceClearance: {
    label: 'Earthwork gathering-ground clearance (m)',
    min: 0,
    max: 100,
    step: 0.1,
  },
  earthworksBankClearance: {
    label: 'Earthwork inland-bank clearance (m)',
    min: 0,
    max: 500,
    step: 1,
  },
  constructionMaximumGrade: { label: 'Maximum building grade (%)', min: 0, max: 100, step: 0.1 },
  constructionSlopeAllowance: { label: 'Slope rise allowance (m)', min: 0, max: 2, step: 0.05 },
  constructionOwnerSlopeBypass: { label: 'Allow world-owner slope bypass' },
  farmMaximumGrade: { label: 'Maximum field grade (%)', min: 0, max: 100, step: 0.1 },
  farmMaximumRise: { label: 'Maximum field rise (m)', min: 0, max: 20, step: 0.1 },
  pastureMaximumGrade: { label: 'Maximum pasture grade (%)', min: 0, max: 100, step: 0.1 },
  pastureMaximumRise: { label: 'Maximum pasture rise (m)', min: 0, max: 20, step: 0.1 },
  constructionMaximumRise: { label: 'Maximum foundation rise (m)', min: 0, max: 20, step: 0.1 },
  pastureParcelSize: { label: 'New pasture parcel side (m)', min: 8, max: 64, step: 1 },
  maximumFarmPlots: { label: 'Maximum farm plots', min: 4, max: 64, step: 4 },
  expandedConstructionCostMultiplier: {
    label: 'Expanded construction cost multiplier',
    min: 1,
    max: 10,
    step: 0.01,
  },
  largeConstructionCostMultiplier: {
    label: 'Large construction cost multiplier',
    min: 1,
    max: 10,
    step: 0.01,
  },
  constructionMinimumSpacing: {
    label: 'Minimum building centre spacing (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  constructionPlacementReach: {
    label: 'Shoreline placement reach (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  respawnX: {
    label: 'Arrival / respawn X (m)',
    min: -maxCoordinate,
    max: maxCoordinate,
    step: 0.1,
  },
  respawnZ: {
    label: 'Arrival / respawn Z (m)',
    min: -maxCoordinate,
    max: maxCoordinate,
    step: 0.1,
  },
  spawnClearance: {
    label: 'Respawn clearance (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  townCentreClearance: {
    label: 'Town centre clearance (m)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  constructionRefundShare: {
    label: 'Construction refund share',
    min: 0,
    max: 1,
    step: 0.01,
  },
} as const;
export type ConstructionRules = Pick<typeof defaults, keyof typeof constructionRuleFields>;
export function constructionRules(settings: Partial<ConstructionRules> = {}): ConstructionRules {
  return Object.fromEntries(
    Object.keys(constructionRuleFields).map((key) => [
      key,
      settings[key as keyof ConstructionRules] ?? defaults[key as keyof ConstructionRules],
    ]),
  ) as ConstructionRules;
}

/** Display the share without binary floating-point tails; calculations retain full precision. */
export function constructionRefundPercentage(settings: Partial<ConstructionRules> = {}) {
  return constructionRules(settings).constructionRefundShare.toLocaleString('en-GB', {
    style: 'percent',
    maximumFractionDigits: 10,
  });
}

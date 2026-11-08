// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
export const roadRuleFields = {
  cityPaving: { label: 'Grow city pavement' },
  cityBuildings: { label: 'City occupied buildings', min: 1, max: 10000, step: 1 },
  cityBusinesses: { label: 'City businesses', min: 0, max: 10000, step: 1 },
  cityResidents: { label: 'City residents', min: 0, max: 10000, step: 1 },
  cityQualificationDays: {
    label: 'Sustained city qualification (game days)',
    min: 1,
    max: 3650,
    step: 1,
  },
  cityDemotionDays: { label: 'Sustained city shrinkage (game days)', min: 1, max: 3650, step: 1 },
  cityRetentionFraction: {
    label: 'City retention threshold (fraction of entry)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  cityPavingPerDay: {
    label: 'Paving (metres/city/game day; 0 pauses)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  cityDensityRadius: { label: 'Urban density radius (metres)', min: 5, max: 500, step: 1 },
  cityDensityBuildings: {
    label: 'Nearby occupied buildings for paving',
    min: 1,
    max: 1000,
    step: 1,
  },
  cityDensityDays: { label: 'Sustained paving density (game days)', min: 1, max: 3650, step: 1 },
  cityDensitySampleSpacing: {
    label: 'Maximum density sample spacing (metres)',
    min: 1,
    max: 30,
    step: 1,
  },
  roadAlternateRoutes: { label: 'Grow useful alternate dirt routes' },
  roadAlternateSavingFraction: {
    label: 'Minimum alternate-route saving (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  roadAlternateSavingMetres: {
    label: 'Minimum alternate-route saving (metres)',
    min: 0,
    max: 10000,
    step: 1,
  },
  roadAlternateParallelFraction: {
    label: 'Maximum parallel share of alternate route (fraction)',
    min: 0,
    max: 1,
    step: 0.01,
  },
  roadAlternateParallelDistance: {
    label: 'Parallel-road proximity (metres)',
    min: 0,
    max: 500,
    step: 1,
  },
  roadGrowthPerDay: {
    label: 'Dirt-road growth (metres/game day; 0 pauses)',
    min: 0,
    max: 1000,
    step: 0.1,
  },
  roadWidth: { label: 'New dirt-road width (metres)', min: 2, max: 20, step: 0.5 },
  roadFords: { label: 'Allow dirt roads through usable fords' },
  groundWaterDepth: {
    label: 'Ground vehicle and ford depth limit (metres)',
    min: 0,
    max: 2,
    step: 0.05,
  },
  roadMaxGrade: { label: 'Maximum road grade (rise/run)', min: 0.01, max: 0.5, step: 0.01 },
} as const;
export type RoadRules = Pick<typeof defaults, keyof typeof roadRuleFields>;
export function roadRules(settings: Partial<RoadRules> = {}): RoadRules {
  return Object.fromEntries(
    Object.keys(roadRuleFields).map((key) => [
      key,
      settings[key as keyof RoadRules] ?? defaults[key as keyof RoadRules],
    ]),
  ) as RoadRules;
}

/** Persist the policy used by an unfinished optional route. Edits trigger a fresh survey. */
export function roadAlternatePolicy(settings: Partial<RoadRules>) {
  const r = roadRules(settings);
  return JSON.stringify([
    r.roadAlternateRoutes,
    r.roadAlternateSavingFraction,
    r.roadAlternateSavingMetres,
    r.roadAlternateParallelFraction,
    r.roadAlternateParallelDistance,
  ]);
}

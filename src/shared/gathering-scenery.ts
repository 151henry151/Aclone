// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import type { World } from './types';
import { resourceAmount, type ResourceNode } from './resources';

export const gatheringSceneryModes = [
  'natural',
  'worked-near-settlements',
  'always-worked',
] as const;
export const gatheringSceneryFields = {
  gatheringScenery: { label: 'Gathering ground scenery' },
  gatheringTownDistance: { label: 'Wear beyond town edge (metres)', min: 0, max: 5000 },
  gatheringRecentSeconds: { label: 'Recent gathering window (seconds)', min: 0, max: 86400 },
} as const;
export type GatheringSceneryRules = Pick<typeof defaults, keyof typeof gatheringSceneryFields>;
export function gatheringSceneryRules(
  settings: Partial<GatheringSceneryRules> = {},
): GatheringSceneryRules {
  return {
    gatheringScenery: settings.gatheringScenery ?? defaults.gatheringScenery,
    gatheringTownDistance: settings.gatheringTownDistance ?? defaults.gatheringTownDistance,
    gatheringRecentSeconds: settings.gatheringRecentSeconds ?? defaults.gatheringRecentSeconds,
  };
}
export type GatheringSceneryStyle = 'natural' | 'worn' | 'legacy';
/** Visual use cues only: never mutate reserves or change gathering permission. */
export function gatheringSceneryStyle(w: World, node: ResourceNode): GatheringSceneryStyle {
  const rules = gatheringSceneryRules(w.settings);
  if (rules.gatheringScenery === 'natural') return 'natural';
  if (rules.gatheringScenery === 'always-worked') return 'legacy';
  const saved = w.resources?.[node.id];
  return w.towns.some(
    (t) => Math.hypot(t.x - node.x, t.z - node.z) <= t.radius + rules.gatheringTownDistance,
  ) ||
    resourceAmount(w, node) < node.capacity ||
    (saved &&
      rules.gatheringRecentSeconds > 0 &&
      w.time >= saved.updated &&
      w.time - saved.updated <= rules.gatheringRecentSeconds) ||
    Object.values(w.players).some(
      (p) => p.task?.kind === 'gather' && p.task.resource === node.id && p.task.end > w.time,
    )
    ? 'worn'
    : 'natural';
}

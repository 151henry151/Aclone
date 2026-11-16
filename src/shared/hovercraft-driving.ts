// SPDX-License-Identifier: GPL-3.0-or-later
import defaults from '../../data/settings.json';
import type { Player } from './types';

export const hovercraftRuleFields = {
  hovercraftDriftSeconds: {
    label: 'Hovercraft drift response (seconds; 0 = legacy pivot)',
    min: 0,
    max: 5,
  },
} as const;
export type HovercraftRules = Pick<typeof defaults, keyof typeof hovercraftRuleFields>;
export function hovercraftRules(settings: Partial<HovercraftRules> = {}): HovercraftRules {
  return {
    hovercraftDriftSeconds: settings.hovercraftDriftSeconds ?? defaults.hovercraftDriftSeconds,
  };
}
/** Velocity belongs to one continuous journey, never to a teleport or another vehicle. */
export interface HoverVelocity {
  x: number;
  z: number;
  atX: number;
  atZ: number;
  vehicle: number;
}

/** Preserve the existing signed speed/drag while the forward direction catches up with yaw.
 * Reverse is a controlled shove along the nose. The zero setting bypasses this entirely. */
export function hovercraftVelocity(
  p: Player,
  previousHeading: number,
  previousSpeed: number,
  seconds: number,
  dt: number,
) {
  const old = p.hoverVelocity;
  const continuous =
    old &&
    old.vehicle === p.vehicle &&
    old.atX === p.x &&
    old.atZ === p.z &&
    previousSpeed > 0 &&
    Number.isFinite(old.x) &&
    Number.isFinite(old.z) &&
    Math.hypot(old.x, old.z) > 0;
  const previous = continuous ? Math.atan2(old.x, old.z) : previousHeading;
  const turn = Math.atan2(Math.sin(p.heading - previous), Math.cos(p.heading - previous));
  const direction = p.speed > 0 ? previous + turn * -Math.expm1(-dt / seconds) : p.heading;
  return { x: Math.sin(direction) * p.speed, z: Math.cos(direction) * p.speed };
}

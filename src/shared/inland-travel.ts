// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { inlandWaterAt } from './inland-water';
import { terrainHeight } from './terrain';
type Point = { x: number; z: number };
export function riverDepth(w: World, p: Point) {
  const water = inlandWaterAt(w, p.x, p.z);
  return water ? Math.max(0, water.level - terrainHeight(w, p.x, p.z)) : 0;
}
/** Sweep the vehicle, not just its destination. Ground vehicles stop at deep
 * channels; an already submerged saved position may retreat toward shallows. */
export function inlandBlocksGround(w: World, from: Point, to: Point, radius = 1.3) {
  if (!w.northernIsland) return false;
  const maxDepth = (p: Point) =>
    Math.max(
      ...[
        [0, 0],
        [radius, 0],
        [-radius, 0],
        [0, radius],
        [0, -radius],
      ].map(([x, z]) => riverDepth(w, { x: p.x + x, z: p.z + z })),
    );
  const start = maxDepth(from),
    steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.6));
  const retreat =
    start > 0.8 &&
    (inlandWaterAt(w, to.x, to.z)?.bankDistance ?? 0) <
      (inlandWaterAt(w, from.x, from.z)?.bankDistance ?? 0);
  for (let i = 1; i <= steps; i++) {
    const depth = maxDepth({
      x: from.x + ((to.x - from.x) * i) / steps,
      z: from.z + ((to.z - from.z) * i) / steps,
    });
    if (depth > 0.8 && depth > start + (retreat ? Math.max(0.12, start * 0.15) : 0.001))
      return true;
  }
  return false;
}

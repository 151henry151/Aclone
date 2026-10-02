// SPDX-License-Identifier: GPL-3.0-or-later
import { terrainHeight } from './terrain';
import type { World } from './types';
/** Shared scenery, picking and movement dimensions. The seabed remains separate. */
export const fishingDock = {
  id: 'landmark:fishing-dock',
  name: 'Fishing dock',
  x: 20,
  z: 151,
  width: 16,
  depth: 22,
  shore: 140,
  rampStart: 136,
};
export function dockHeight(w: World) {
  return Math.max(
    w.settings.seaLevel + 0.55,
    terrainHeight(w, fishingDock.x, fishingDock.shore) + 0.2,
  );
}
export function travelHeight(w: World, x: number, z: number) {
  const ground = terrainHeight(w, x, z);
  if (
    Math.abs(x - fishingDock.x) > fishingDock.width / 2 ||
    z < fishingDock.rampStart ||
    z > fishingDock.z + fishingDock.depth / 2
  )
    return ground;
  const end = dockHeight(w);
  const start = terrainHeight(w, x, fishingDock.rampStart);
  const ramp = Math.min(
    1,
    (z - fishingDock.rampStart) / (fishingDock.shore - fishingDock.rampStart),
  );
  return Math.max(ground, start + (end - start) * ramp);
}
export function nearFishingDock(w: World, p: { x: number; y: number; z: number }) {
  return (
    Math.abs(p.x - fishingDock.x) <= fishingDock.width / 2 + 4 &&
    p.z >= fishingDock.rampStart - 4 &&
    p.z <= fishingDock.z + fishingDock.depth / 2 + 4 &&
    Math.abs(p.y - travelHeight(w, p.x, p.z)) < 4
  );
}

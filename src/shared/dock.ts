import { quayDeckContains, quayDeckHeight } from './quay';
import { highWater } from './ocean';
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
  return Math.max(highWater(w) + 0.55, terrainHeight(w, fishingDock.x, fishingDock.shore) + 0.2);
}
const quayCache = new WeakMap<
  World,
  { buildings: World['buildings']; length: number; revision: number; quays: World['buildings'] }
>();
function walkingQuays(w: World) {
  let entry = quayCache.get(w);
  if (
    !entry ||
    entry.buildings !== w.buildings ||
    entry.length !== w.buildings.length ||
    entry.revision !== w.revision
  ) {
    entry = {
      buildings: w.buildings,
      length: w.buildings.length,
      revision: w.revision,
      quays: w.buildings.filter((b) => b.kind === 'quay'),
    };
    quayCache.set(w, entry);
  }
  return entry.quays;
}
export function travelHeight(w: World, x: number, z: number) {
  const ground = terrainHeight(w, x, z);
  for (const b of walkingQuays(w))
    if (!b.construction && quayDeckContains(b, x, z)) return Math.max(ground, quayDeckHeight(w, b));
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

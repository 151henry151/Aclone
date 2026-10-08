// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types.ts';
import {
  GOVERNMENT_RESERVE,
  governmentPremium,
  isPublicPuddlewick,
} from '../shared/harbour-supply.ts';
import { makeBuilding } from '../shared/simulation.ts';
import { terrainHeight } from '../shared/terrain.ts';
import { blocksBuilding } from '../shared/building-shapes.ts';
import { creatorBlocks } from '../shared/creator.ts';
import { roadDistance, townRoads } from '../shared/town.ts';
import { worldResources } from '../shared/resources.ts';
import { fishingDock } from '../shared/dock.ts';

/** Repair the named, reserved starter parish once; never transfer any property. */
export function restorePublicPuddlewick(w: World) {
  if (
    w.publicParishVersion ||
    w.id !== 'puddlewick' ||
    w.name !== 'Puddlewick' ||
    w.template !== 'economy' ||
    !w.buildings.some((b) => b.id === 'b0' && b.government && b.owner === 'treasury')
  )
    return false;
  w.owner = 'server';
  w.publicParishVersion = 1;
  w.revision++;
  return true;
}

/** On-demand goods are paid from purchases, never free stock or fresh cash. */
export function governmentStores(w: World) {
  if (
    !isPublicPuddlewick(w) ||
    w.buildings.some((b) => b.id === 'parish-government-stores') ||
    w.buildings.length >= 500
  )
    return false;
  const roads = townRoads(w);
  const sites: { x: number; z: number; road: number }[] = [];
  for (let z = -184; z <= 136; z += 8)
    for (let x = -208; x <= 208; x += 8) {
      const road = roadDistance(roads, x, z);
      if (
        road < 10 ||
        road > 35 ||
        w.buildings.some((b) => blocksBuilding(b, x, z, 0, 15)) ||
        Object.values(w.players).some((p) => Math.hypot(p.x - x, p.z - z) < 20) ||
        worldResources(w).some((p) => Math.hypot(p.x - x, p.z - z) < 24) ||
        Math.hypot(fishingDock.x - x, fishingDock.z - z) < 40 ||
        (x > 44 && x < 136 && z > 4 && z < 86) ||
        w.zones.some((p) => p.kind === 'noBuild' && Math.hypot(p.x - x, p.z - z) < p.radius + 10) ||
        creatorBlocks(w, x, z, terrainHeight(w, x, z), 12) ||
        ![-8, 0, 8].every((dx) =>
          [-8, 0, 8].every((dz) => terrainHeight(w, x + dx, z + dz) > w.settings.seaLevel + 0.2),
        )
      )
        continue;
      sites.push({ x, z, road });
    }
  sites.sort((a, b) => Math.hypot(a.x, a.z) + a.road - Math.hypot(b.x, b.z) - b.road);
  const site = sites[0];
  if (!site) return false;
  const b = makeBuilding('parish-government-stores', 'market', site.x, site.z);
  Object.assign(b, {
    name: 'Government necessities',
    owner: 'treasury',
    government: true,
    stock: {},
    buy: {},
    sell: {},
    investment: 0,
    employees: [],
    forSale: false,
  });
  for (const item of Object.keys(GOVERNMENT_RESERVE) as (keyof typeof GOVERNMENT_RESERVE)[])
    b.sell[item] = governmentPremium(w, b, item);
  w.buildings.push(b);
  w.revision++;
  return true;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types.ts';
import { makeBuilding } from '../shared/simulation.ts';
import { normalizeTowns, townAt } from '../shared/civics.ts';
import { constructionSiteReason } from '../shared/construction-site.ts';
import { blocksBuilding } from '../shared/building-shapes.ts';
import { onFarmLand } from '../shared/farm-land.ts';
import { creatorBlocks } from '../shared/creator.ts';
import { terrainHeight } from '../shared/terrain.ts';
import { townRoads, roadDistance } from '../shared/town.ts';
import { worldResources } from '../shared/resources.ts';
import { checkpoints } from '../shared/catalog.ts';
import { fishingDock } from '../shared/dock.ts';

/** Restore the retired public fountain once, without moving the town boundary.
 * A blocked site remains pending; later deliberate demolition is respected. */
export function restorePuddlewickCentre(w: World) {
  if (
    w.publicCivicVersion ||
    w.id !== 'puddlewick' ||
    (w.owner !== 'server' && !w.publicParishVersion) ||
    w.template !== 'economy'
  )
    return false;
  normalizeTowns(w);
  const town = w.towns.find((t) => t.id === 'puddlewick');
  if (!town) return false;
  const existing = w.buildings.find((b) => b.kind === 'town' && b.id === town.plinth);
  if (!existing) {
    if (w.buildings.length >= 500) return false;
    let id = 'parish-civic-centre';
    while (w.buildings.some((b) => b.id === id)) id += '-new';
    const building = makeBuilding(id, 'town', town.x, town.z);
    const roads = townRoads(w),
      resources = worldResources(w);
    const sites: { x: number; z: number; distance: number }[] = [];
    const reach = Math.min(128, town.radius - 10);
    for (let dz = -reach; dz <= reach; dz += 4)
      for (let dx = -reach; dx <= reach; dx += 4) {
        const x = town.x + dx,
          z = town.z + dz;
        if (Math.hypot(dx, dz) > reach || townAt(w, x, z) !== town) continue;
        sites.push({ x, z, distance: Math.hypot(dx, dz) });
      }
    sites.sort((a, b) => a.distance - b.distance || a.z - b.z || a.x - b.x);
    const site = sites.find(({ x, z }) => {
      // Reserve the whole fountain-and-benches area, including access space.
      if (roadDistance(roads, x, z) < 9 || onFarmLand(w, x, z, 10)) return false;
      if (w.buildings.some((b) => blocksBuilding(b, x, z, 0, 10))) return false;
      if (Object.values(w.players).some((p) => Math.hypot(p.x - x, p.z - z) < 14)) return false;
      if (resources.some((p) => Math.hypot(p.x - x, p.z - z) < 20)) return false;
      if (checkpoints.some((p) => Math.hypot(p.x - x, p.z - z) < 22)) return false;
      if (Math.hypot(fishingDock.x - x, fishingDock.z - z) < 35) return false;
      if (x > 50 && x < 130 && z > 10 && z < 80) return false;
      if (w.zones.some((p) => p.kind === 'noBuild' && Math.hypot(p.x - x, p.z - z) < p.radius + 10))
        return false;
      if (creatorBlocks(w, x, z, terrainHeight(w, x, z), 10)) return false;
      Object.assign(building, { x, z });
      return !constructionSiteReason(w, building);
    });
    if (!site) return false;
    Object.assign(building, {
      x: site.x,
      z: site.z,
      name: 'Puddlewick town centre',
      owner: 'treasury',
      government: true,
      forSale: false,
      stock: {},
      buy: {},
      sell: {},
      investment: 0,
      employees: [],
    });
    w.buildings.push(building);
    town.plinth = building.id;
  }
  w.publicCivicVersion = 1;
  w.revision++;
  return true;
}

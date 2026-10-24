// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { airfieldAreas, onAirfield, type Airfield } from '../shared/airfield';
import { makeBuilding } from '../shared/simulation';
import { terrainHeight, mapHalf } from '../shared/terrain';
import { blocksBuilding } from '../shared/building-shapes';
import { onFarmLand } from '../shared/farm-land';
import { creatorBlocks } from '../shared/creator';
import { worldResources } from '../shared/resources';

/** Public works on a vacant west-side site only. Never remove or move private property. */
export function ensurePuddlewickAirfield(w: World) {
  if (
    w.airfield ||
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    (w.owner !== 'server' && !w.publicParishVersion)
  )
    return false;
  const town = w.towns.find((t) => t.id === 'puddlewick');
  if (!town || w.buildings.length >= 500) return false;
  const resources = worldResources(w);
  for (const length of [240, 220])
    for (const x of [-195, -200, -190, -205]) {
      const a: Airfield = {
        x,
        z: -85,
        length,
        width: 18,
        height: terrainHeight(w, x, -85),
        hangar: 'parish-airfield-hangar',
        apronX: x + 27,
        apronZ: -85,
      };
      let safe = !w.buildings.some((b) => b.id === a.hangar);
      for (const r of airfieldAreas(a)) {
        for (let dx = -r.hx - 3; dx <= r.hx + 3; dx += 2)
          for (let dz = -r.hz - 3; dz <= r.hz + 3; dz += 2) {
            const px = r.x + dx,
              pz = r.z + dz,
              h = terrainHeight(w, px, pz);
            if (
              Math.hypot(px - town.x, pz - town.z) >= town.radius ||
              Math.max(Math.abs(px), Math.abs(pz)) >= mapHalf(w) ||
              h <= w.settings.seaLevel + 0.3 ||
              Math.abs(h - a.height) > 2 ||
              w.buildings.some((b) => blocksBuilding(b, px, pz, 0, 4)) ||
              onFarmLand(w, px, pz, 4) ||
              creatorBlocks(w, px, pz, h, 4) ||
              w.zones.some((n) => n.kind === 'noBuild' && Math.hypot(n.x - px, n.z - pz) < n.radius)
            )
              safe = false;
          }
      }
      if (!safe) continue;
      // Clear public gathering grounds from the runway, retaining IDs and depletion.
      // Find all replacement sites before mutating the world.
      const moved = { ...w.resourceRelocations };
      let relocationFailed = false;
      for (const n of resources.filter((n) => onAirfield({ airfield: a }, n.x, n.z, 12))) {
        let found = false;
        for (let radius = 20; radius <= 140 && !found; radius += 10)
          for (let angle = 0; angle < Math.PI * 2 && !found; angle += Math.PI / 12) {
            const px = Math.round(n.x + Math.cos(angle) * radius),
              pz = Math.round(n.z + Math.sin(angle) * radius);
            const h = terrainHeight(w, px, pz);
            if (
              onAirfield({ airfield: a }, px, pz, 14) ||
              Math.max(Math.abs(px), Math.abs(pz)) > mapHalf(w) - 20 ||
              h <= w.settings.seaLevel + 1 ||
              w.buildings.some((b) => blocksBuilding(b, px, pz, 0, 12)) ||
              onFarmLand(w, px, pz, 12) ||
              creatorBlocks(w, px, pz, h, 12) ||
              resources.some((o) => {
                const p = moved[o.id] ?? o;
                return o.id !== n.id && Math.hypot(p.x - px, p.z - pz) < 18;
              })
            )
              continue;
            moved[n.id] = { x: px, z: pz };
            found = true;
          }
        if (!found) relocationFailed = true;
      }
      if (relocationFailed) continue;
      const hangar = makeBuilding(a.hangar, 'garage', x + 40, -85);
      Object.assign(hangar, {
        name: 'Puddlewick airfield hangar',
        aircraftHangar: true,
        rotation: -Math.PI / 2,
        owner: 'treasury',
        government: true,
        forSale: false,
        stock: { fuel: 100 },
        buy: {},
        sell: { fuel: 5350 },
        investment: 0,
        employees: [],
        foundationY: a.height + 0.04,
      });
      w.airfield = a;
      w.resourceRelocations = moved;
      w.buildings.push(hangar);
      w.roads ??= [];
      w.roads.push(
        { a: { x, z: a.z - a.length / 2 }, b: { x, z: a.z + a.length / 2 }, width: a.width },
        { a: { x, z: a.apronZ }, b: { x: a.apronX, z: a.apronZ }, width: 24 },
      );
      w.revision++;
      return true;
    }
  return false;
}

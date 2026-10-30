import { spaceportReserved } from './spaceport-site';
// SPDX-License-Identifier: GPL-3.0-or-later
import { barrierSegments, scatterObjects } from './landscape';
import type { Building, World } from './types';
import { isLivestockFarm, pasturePoint, MAX_PASTURE_PARCELS, type Pasture } from './pasture-land';
import { onFarmLand } from './farm-land';
import { blocksBuilding } from './building-shapes';
import { onAirfield } from './airfield';
import { dockReserved } from './boathouse';
import { highWater } from './ocean';
import { terrainHeight, mapHalf } from './terrain';
import { townRoads, roadDistance, type Road } from './town';

/** Check the full parcel, not just its centre. Pastures must not displace existing property. */
export function pastureBlocker(
  w: World,
  b: Building,
  p: Pasture,
  first = 0,
  roads: readonly Road[] = townRoads(w),
) {
  if (p.parcels > MAX_PASTURE_PARCELS) return 'Maximum four pasture parcels';
  const heights: number[] = [];
  const barriers = barrierSegments(w).map((b) => ({ ...b, width: b.width ?? 0.2 }));
  const obstacles = [...(w.creator?.objects ?? []), ...scatterObjects(w)];
  for (let x = p.x - 8 + first * 16; x <= p.x - 8 + p.parcels * 16; x += 2)
    for (let z = p.z - 8; z <= p.z + 8; z += 2) {
      const q = pasturePoint(b, x, z),
        y = terrainHeight(w, q.x, q.z);
      if (Math.max(Math.abs(q.x), Math.abs(q.z)) >= mapHalf(w) - 2 || y <= highWater(w) + 0.3)
        return 'Pasture needs dry land inside the world';
      if (spaceportReserved(w, q.x, q.z, 2))
        return 'Keep pasture outside the spaceport launch reservation';
      if (onAirfield(w, q.x, q.z, 2)) return 'Keep the runway and apron clear';
      if (roadDistance(roads, q.x, q.z) < 2) return 'A road crosses the pasture';
      if (
        onFarmLand(w, q.x, q.z, 1.5, b.id) ||
        w.buildings.some((o) => blocksBuilding(o, q.x, q.z, 0, 1.5) || dockReserved(o, q.x, q.z, 2))
      )
        return 'Another building, farm or pasture occupies this land';
      if (obstacles.some((o) => o.solid && Math.hypot(o.x - q.x, o.z - q.z) < o.radius + 2))
        return 'An obstacle occupies the pasture';
      if (roadDistance(barriers, q.x, q.z) < 2) return 'A wall or fence crosses the pasture';
      if (
        w.zones.some((o) => o.kind === 'noBuild' && Math.hypot(o.x - q.x, o.z - q.z) < o.radius + 2)
      )
        return 'Pasture would enter a no-build zone';
      heights.push(y);
    }
  if (Math.max(...heights) - Math.min(...heights) > 4) return 'Pasture needs gentler terrain';
}
/** Existing barns receive one clear parcel without deleting animals or moving other property. */
export function ensurePasture(w: World, b: Building, roads = townRoads(w)) {
  if (!isLivestockFarm(b) || b.construction || b.pasture) return;
  for (const radius of [24, 40, 56])
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const p = { x: dx * radius, z: dz * radius, parcels: 1 };
      if (!pastureBlocker(w, b, p, 0, roads)) {
        b.pasture = p;
        return;
      }
    }
}
const checked = new WeakMap<World, string>();
const lastCheck = new WeakMap<World, { time: number; revision: number; count: number }>();
/** Recheck missing parcels only after landscape/property changes, never per frame. */
export function ensurePastures(w: World) {
  const last = lastCheck.get(w);
  if (
    last &&
    w.time >= last.time &&
    w.time < last.time + 5 &&
    last.revision === w.revision &&
    last.count === w.buildings.length
  )
    return;
  lastCheck.set(w, { time: w.time, revision: w.revision, count: w.buildings.length });
  const key = JSON.stringify([
    w.revision,
    w.terrain,
    w.buildings.map((b) => [b.id, b.x, b.z, b.rotation, b.construction, b.pasture, b.farmPlots]),
  ]);
  if (checked.get(w) === key) return;
  checked.set(w, key);
  const barns = w.buildings.filter((b) => isLivestockFarm(b) && !b.pasture && !b.construction);
  if (!barns.length) return;
  const roads = townRoads(w);
  for (const b of barns) ensurePasture(w, b, roads);
}

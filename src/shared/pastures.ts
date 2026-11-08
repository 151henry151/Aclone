import { bridgeReservedFootprint } from './bridge-geometry';
import { rectanglesOverlap } from './vehicle-footprint';
import { constructionRules } from './construction-rules';
import { pastureParcelSize } from './pasture-land';
import { inlandLevel } from './inland-water';
import { spawnReserved } from './spawn-reserve';
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
  const size = pastureParcelSize(p),
    span = (p.parcels - first) * size;
  const centre = pasturePoint(b, p.x + first * size + (span - size) / 2, p.z),
    c = Math.cos(b.rotation),
    sn = Math.sin(b.rotation);
  const footprint = {
    ...centre,
    hx: span / 2,
    hz: size / 2,
    axes: [
      { x: c, z: -sn },
      { x: sn, z: c },
    ],
  };
  if (w.bridges?.some((bridge) => rectanglesOverlap(footprint, bridgeReservedFootprint(bridge))))
    return 'Keep pasture clear of the reserved bridge footprint';
  const across = Math.ceil(span / 2),
    deep = Math.ceil(size / 2);
  // Include every outer edge even when the parcel dimension is odd.
  for (let ix = 0; ix <= across; ix++)
    for (let iz = 0; iz <= deep; iz++) {
      const x = p.x - size / 2 + first * size + (span * ix) / across,
        z = p.z - size / 2 + (size * iz) / deep;
      const q = pasturePoint(b, x, z),
        y = terrainHeight(w, q.x, q.z);
      if (
        Math.max(Math.abs(q.x), Math.abs(q.z)) >= mapHalf(w) - 2 ||
        y <= inlandLevel(w, q.x, q.z, highWater(w)) + 0.3
      )
        return 'Pasture needs dry land inside the world';
      if (spawnReserved(w, q.x, q.z, 2))
        return 'Keep pasture outside the town centre and respawn area';
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
      const p = {
        x: dx * radius,
        z: dz * radius,
        parcels: 1,
        parcelSize: constructionRules(w.settings).pastureParcelSize,
      };
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

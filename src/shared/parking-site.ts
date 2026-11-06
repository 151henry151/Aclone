import { rectanglesOverlap, vehicleFootprint, trailerFootprint } from './vehicle-footprint';
import { buildingBays } from './building-bays';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { buildingPlan, buildingBlocksMovement } from './building-shapes';
import { buildingFacade, exposedFacade } from './building-facade';
import { terrainHeight, mapHalf } from './terrain';
import { highWater } from './ocean';
import { inlandLevel } from './inland-water';
import { vehicleDef } from './vehicle-config';
import { parkingRules } from './parking-rules';
import { sceneryObstaclesNear } from './scenery-obstacles';
import { constructionRules } from './construction-rules';
import { creatorBlocksSegment } from './creator';

/** Entry coordinates follow the model's front facade, including legacy inset wings. */
export function buildingEntry(b: Building) {
  const plan = buildingPlan(b),
    facade = buildingFacade(b.kind, plan);
  const bays = buildingBays(b, plan).filter((bay) => !bay.rear);
  const pedestrian = b.architecture
    ? plan.volumes.find(
        (v) =>
          v.eaves >= 2.3 &&
          exposedFacade(plan.volumes, v, v.x, 1, v.z + v.depth / 2 + 0.07, 0.2) &&
          !bays.some((bay) => bay.volume === v),
      )
    : undefined;
  const v =
    pedestrian ??
    (!b.architecture && ['school', 'hotel'].includes(b.kind) ? plan.volumes[1] : facade.v);
  const bay = !pedestrian && bays[0];
  const x = bay ? bay.x : !b.architecture ? 0 : v.x,
    z = bay ? bay.z + 0.07 : v.z + v.depth / 2 + 0.07;
  return {
    x: b.x + x * Math.cos(b.rotation) + z * Math.sin(b.rotation),
    z: b.z - x * Math.sin(b.rotation) + z * Math.cos(b.rotation),
    heading: b.rotation,
  };
}
export function parkingRadius(w: World, slot: number) {
  const v = vehicleDef(w, slot),
    radius = v.collisionRadius ?? 1.3;
  return Math.hypot((v.width ?? radius * 2) / 2, (v.length ?? radius * 2) / 2);
}
export function safeParkingPoint(
  w: World,
  slot: number,
  point: { x: number; z: number; heading: number },
  ignore?: string,
) {
  const radius = parkingRadius(w, slot);
  if (Math.abs(point.x) + radius >= mapHalf(w) || Math.abs(point.z) + radius >= mapHalf(w))
    return false;
  if (w.buildings.some((b) => buildingBlocksMovement(b, point, point, 0, radius))) return false;
  if (
    Object.values(w.trailers ?? {}).some(
      (t) =>
        !(t.parkedWith && w.parkedVehicles?.[t.parkedWith]?.inside) &&
        !(
          ignore &&
          (t.parkedWith === ignore ||
            (!t.parkedWith && t.attached && ignore.startsWith(`${t.attached}:`)))
        ) &&
        rectanglesOverlap(vehicleFootprint(w, slot, point), trailerFootprint(t)),
    )
  )
    return false;
  const groundPoint = { ...point, y: terrainHeight(w, point.x, point.z) };
  if (creatorBlocksSegment(w, groundPoint, groundPoint, radius)) return false;
  if (
    sceneryObstaclesNear(w, point, point, radius).some(
      (o) => Math.hypot(o.x - point.x, o.z - point.z) < radius + o.radius,
    )
  )
    return false;
  if (
    Object.entries(w.parkedVehicles ?? {}).some(
      ([key, v]) =>
        key !== ignore &&
        !v.inside &&
        Math.hypot(v.x - point.x, v.z - point.z) < radius + parkingRadius(w, v.slot),
    )
  )
    return false;
  if (
    Object.values(w.players).some(
      (p) =>
        p.online &&
        !ignore?.startsWith(`${p.id}:`) &&
        !p.atHome &&
        Math.hypot(p.x - point.x, p.z - point.z) < radius + parkingRadius(w, p.vehicle),
    )
  )
    return false;
  const heights = [];
  for (const dx of [-radius, 0, radius])
    for (const dz of [-radius, 0, radius]) {
      const x = point.x + dx,
        z = point.z + dz,
        h = terrainHeight(w, x, z);
      if (h <= inlandLevel(w, x, z, highWater(w))) return false;
      heights.push(h);
    }
  return (
    Math.max(...heights) - Math.min(...heights) <=
    constructionRules(w.settings).constructionMaximumRise
  );
}
/** Search both sides of the entrance, keeping its walking path free. */
export function kerbParking(
  w: World,
  b: Building,
  slot: number,
  ignore?: string,
  accepts: (point: { x: number; z: number; heading: number }) => boolean = () => true,
) {
  const entry = buildingEntry(b),
    r = parkingRules(w.settings),
    radius = parkingRadius(w, slot);
  const candidates = [];
  for (let forward = radius + r.parkingDoorOffset; forward <= r.parkingSearchRange; forward += 2)
    for (let side = radius + r.parkingDoorOffset; side <= r.parkingSearchRange; side += 2)
      for (const sign of [-1, 1]) {
        if (Math.hypot(side, forward) > r.parkingSearchRange) continue;
        candidates.push({
          x: entry.x + sign * side * Math.cos(b.rotation) + forward * Math.sin(b.rotation),
          z: entry.z - sign * side * Math.sin(b.rotation) + forward * Math.cos(b.rotation),
          heading: b.rotation,
        });
      }
  candidates.sort(
    (a, b) => Math.hypot(a.x - entry.x, a.z - entry.z) - Math.hypot(b.x - entry.x, b.z - entry.z),
  );
  const point = candidates.find((p) => safeParkingPoint(w, slot, p, ignore) && accepts(p));
  return point ? { ...point, y: terrainHeight(w, point.x, point.z) } : undefined;
}

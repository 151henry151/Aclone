// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from './types';
import { vehicles } from './catalog';
import { vehicleDef } from './vehicle-config';
import { parkingFields, parkingRules } from './parking-rules';
import { buildingEntry } from './parking-site';
import { trailerDefs, type TrailerKind } from './trailer-definitions';
import { trailerDef } from './trailers';
import { isTractor } from './tractors';
import { automotiveConfig } from './automotive-config';
import { isSemitrailer } from './highway-definitions';
import { vehicleFootprint, trailerFootprint, type GroundRect } from './vehicle-footprint';

export const landStorageVehicle = (w: World, slot: number) =>
  ![5, 6, 7, 29, 34].includes(slot) && [0, 1, 4, 5].includes(vehicleDef(w, slot).mode);
export const markedGarage = (w: World, b: Building) =>
  b.kind === 'garage' &&
  !b.aircraftHangar &&
  !b.construction &&
  parkingRules(w.settings).garageBayRequired;
export interface GarageBay {
  x: number;
  z: number;
  heading: number;
  width: number;
  depth: number;
}
/** Catalogue dimensions include the coupling gap/overlap, rather than adding body lengths. */
export function garageBay(w: World, b: Building): GarageBay | undefined {
  if (!markedGarage(w, b)) return;
  let width = 0,
    depth = 0;
  for (let slot = 0; slot < vehicles.length; slot++) {
    if (!landStorageVehicle(w, slot)) continue;
    const v = vehicleFootprint(w, slot, { x: 0, z: 0, heading: 0 });
    width = Math.max(width, v.hx * 2);
    depth = Math.max(depth, v.hz * 2);
    for (const kind of Object.keys(trailerDefs) as TrailerKind[]) {
      if (isSemitrailer(kind) ? slot !== 37 : !isTractor(slot)) continue;
      const t = trailerDef(w, kind),
        c = automotiveConfig(w).coupling;
      const z = isSemitrailer(kind)
        ? c.fifthWheelZ - t.length / 2 + c.kingpinInset
        : -2.7 - t.length / 2 - 1.4;
      depth = Math.max(depth, Math.max(v.hz, z + t.length / 2) - Math.min(-v.hz, z - t.length / 2));
      width = Math.max(width, t.width);
    }
  }
  const entry = buildingEntry(b),
    r = parkingRules(w.settings);
  // Keep the centre stable as the margin changes. Reserve the maximum margin in
  // front of the doorway so even the widest allowed paint never enters a wall.
  const forward = depth / 2 + parkingFields.garageBayMargin.max + r.parkingDoorOffset;
  return {
    x: entry.x + Math.sin(b.rotation) * forward,
    z: entry.z + Math.cos(b.rotation) * forward,
    heading: b.rotation,
    width: width + 2 * r.garageBayMargin,
    depth: depth + 2 * r.garageBayMargin,
  };
}
export function garageBayContains(bay: GarageBay, bodies: GroundRect[]) {
  const c = Math.cos(bay.heading),
    s = Math.sin(bay.heading);
  return bodies.every((r) =>
    [-1, 1].every((a) =>
      [-1, 1].every((b) => {
        const x = r.x + a * r.hx * r.axes[0].x + b * r.hz * r.axes[1].x - bay.x;
        const z = r.z + a * r.hx * r.axes[0].z + b * r.hz * r.axes[1].z - bay.z;
        return (
          Math.abs(x * c - z * s) <= bay.width / 2 + 1e-8 &&
          Math.abs(x * s + z * c) <= bay.depth / 2 + 1e-8
        );
      }),
    ),
  );
}
export function garageBayStoreReason(w: World, p: Player, b: Building) {
  const r = parkingRules(w.settings);
  if (!markedGarage(w, b) || !r.vehiclesPersist || (p.npc && !r.parkingNpcs))
    return 'Use a marked tractor garage bay';
  if (!r.garageStorageEnabled) return 'New garage storage is disabled in this world';
  if (
    p.task ||
    p.game ||
    p.hitch ||
    p.crowBody ||
    p.inside ||
    p.atHome ||
    Math.abs(p.speed) >= 0.05
  )
    return 'Stop outside and finish your activity before storing';
  if (Object.values(w.players).some((passenger) => passenger.hitch === p.id))
    return 'Let your passengers leave before storing the vehicle';
  if (!landStorageVehicle(w, p.vehicle) || !(p.fleet ?? [0, 5]).includes(p.vehicle))
    return 'Choose your own land vehicle';
  const rig = Object.values(w.trailers ?? {}).filter((t) => t.attached === p.id && !t.parkedWith);
  if (rig.some((t) => t.owner !== p.id))
    return 'Only your own trailers may be stored with this vehicle';
  if (
    !garageBayContains(garageBay(w, b)!, [
      vehicleFootprint(w, p.vehicle, p),
      ...rig.map((t) => trailerFootprint(t, w)),
    ])
  )
    return 'Park the whole vehicle and trailer inside the yellow bay';
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { fuelVehicle, isTractor } from '../shared/tractors';
import {
  parkedRefuelStatus,
  parkedReturnReason,
  persistentVehicles,
} from '../shared/parked-vehicles';
import { vehicleDef } from '../shared/vehicle-config';

/** Guidance always refers to the physical tank, never the walker's legacy fuel. */
export function parkingStatus(w: World, p: Player) {
  if (p.vehicle !== 5 || !persistentVehicles(w, p) || p.inside || p.atHome || p.task) return;
  const owned = Object.values(w.parkedVehicles ?? {}).filter((v) => v.owner === p.id);
  const v = owned.find((v) => v.slot === fuelVehicle(p, w)) ?? owned[0];
  if (!v) return;
  const garage = w.buildings.find((b) => b.id === v.inside);
  const point = { x: garage?.x ?? v.x, z: garage?.z ?? v.z, name: vehicleDef(w, v.slot).name };
  const distance = Math.hypot(p.x - point.x, p.z - point.z);
  const bearing = Math.atan2(point.x - p.x, p.z - point.z);
  const direction = [
    'north',
    'northeast',
    'east',
    'southeast',
    'south',
    'southwest',
    'west',
    'northwest',
  ][(Math.round(bearing / (Math.PI / 4)) + 8) % 8];
  return {
    slot: v.slot,
    point,
    distance,
    text: `${v.fuel <= 0 ? 'Out of fuel — ' : ''}${point.name} · ${Math.round(distance)} m ${direction}${garage ? ` · stored at ${garage.name}` : ''}`,
    returnReason: parkedReturnReason(w, p, v.slot),
    refuelReason: parkedRefuelStatus(w, p, p.id, v.slot).reason,
  };
}

/** Find a physical owned tractor independently of the currently selected fuel tank. */
export function tractorWaypoint(w: World, p: Player) {
  if (!persistentVehicles(w, p)) return;
  return Object.values(w.parkedVehicles ?? {})
    .filter((v) => v.owner === p.id && isTractor(v.slot))
    .map((v) => {
      const garage = w.buildings.find((b) => b.id === v.inside);
      return {
        x: garage?.x ?? v.x,
        z: garage?.z ?? v.z,
        name: `Your ${vehicleDef(w, v.slot).name}${garage ? ` · ${garage.name}` : ''}`,
      };
    })
    .sort((a, b) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z))[0];
}

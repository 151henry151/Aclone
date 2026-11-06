// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types';
import { parkingRules } from './parking-rules';
import { hasMotor } from './vehicle-config';
import { boatSlot } from './boats';
export interface VehicleMount {
  slot: number;
  mounting: boolean;
  start: number;
  end: number;
  vehicle: { x: number; y: number; z: number; heading: number };
  door: { x: number; y: number; z: number };
}
export function beginVehicleMount(
  w: World,
  p: Player,
  before: Pick<Player, 'vehicle' | 'x' | 'y' | 'z' | 'heading'>,
  time = w.time,
) {
  const r = parkingRules(w.settings);
  if (!r.vehiclesPersist || (p.npc && !r.parkingNpcs) || p.game || r.arrivalAnimation === 'off')
    return;
  const mounting = before.vehicle === 5,
    slot = mounting ? p.vehicle : before.vehicle;
  if (
    !(mounting || p.vehicle === 5) ||
    slot === 5 ||
    slot === 7 ||
    boatSlot(slot, w) ||
    !hasMotor(w, slot)
  )
    return;
  const vehicle = mounting
    ? { x: p.x, y: p.y, z: p.z, heading: p.heading }
    : { x: before.x, y: before.y, z: before.z, heading: before.heading };
  const duration = r.arrivalAnimation === 'quick' ? r.arrivalQuickSeconds : r.parkingMountSeconds;
  if (duration <= 0) return;
  const end = time + duration;
  const mount: VehicleMount = {
    slot,
    mounting,
    start: time,
    end,
    vehicle,
    door: {
      x: vehicle.x - Math.cos(vehicle.heading) * r.parkingDoorOffset,
      y: vehicle.y,
      z: vehicle.z + Math.sin(vehicle.heading) * r.parkingDoorOffset,
    },
  };
  p.task = { kind: mounting ? 'mounting' : 'dismounting', end, mount };
  return mount;
}

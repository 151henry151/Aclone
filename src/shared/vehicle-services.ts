// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicles } from './catalog.ts';
import type { Player, World } from './types.ts';
export interface VehicleRecord {
  acquiredAt: number;
  metres: number;
  condition: number;
}
export const SERVICE_FEE = 1000;
export const MAP_PRICE = 1000;
export function maintainable(slot: number) {
  return slot !== 7 && vehicles[slot]?.fuel > 0;
}
export function vehicleCondition(p: Player) {
  return p.fleetState?.[p.vehicle]?.condition ?? 100;
}
export function vehicleRecord(w: World, p: Player): VehicleRecord {
  p.fleetState ??= {};
  return (p.fleetState[p.vehicle] ??= { acquiredAt: w.time, metres: 0, condition: 100 });
}
/** Replace nested records so client prediction never mutates the authoritative snapshot. */
export function recordTravel(w: World, p: Player, metres: number) {
  if (!maintainable(p.vehicle) || metres <= 0 || p.game) return;
  const old = p.fleetState?.[p.vehicle] ?? { acquiredAt: w.time, metres: 0, condition: 100 };
  p.fleetState = {
    ...p.fleetState,
    [p.vehicle]: {
      ...old,
      metres: old.metres + metres,
      condition: Math.max(0, old.condition - (w.settings.vehicleMaintenance ? metres * 0.0002 : 0)),
    },
  };
}
export function requiredLicence(w: World, slot: number) {
  if (!w.settings.vehicleLicences || [0, 5, 6, 7].includes(slot)) return;
  const mode = w.vehicleTuning?.[slot]?.mode ?? vehicles[slot]?.mode;
  return mode === 2 || mode === 6 ? 'pilot' : mode === 3 || mode === 5 ? 'boatmaster' : 'driver';
}
export function mapAvailable(w: World, p: Player) {
  return !w.settings.requireMapItem || (p.inventory.parishMap ?? 0) > 0;
}
export function stoppedOutside(p: Player) {
  return (
    p.online &&
    !p.atHome &&
    !p.hitch &&
    !p.crowBody &&
    !p.game &&
    !p.task &&
    Math.abs(p.speed) <= 0.5
  );
}
export function repairRecipientReady(p: Player) {
  return !!(stoppedOutside(p) && maintainable(p.vehicle) && vehicleCondition(p) < 100);
}
export function repairStatus(w: World, p: Player, target?: Player, publicSnapshot = false) {
  let reason: string | undefined;
  if (!target || target.id === p.id || !target.online || !p.online)
    reason = 'Choose another online player';
  else if (!stoppedOutside(p)) reason = 'Stop outside and finish other activities before repairs';
  else if (Math.hypot(p.x - target.x, p.z - target.z) >= 15 || Math.abs(p.y - target.y) > 3)
    reason = 'Move within 15 metres at the same height';
  else if (!(publicSnapshot ? target.canReceiveRepair : repairRecipientReady(target)))
    reason = 'Their vehicle must be stopped outside, available and below full condition';
  else if (!p.skills.includes('mechanic')) reason = 'Learn mechanic at school';
  else if (!(p.inventory.tools > 0) || !(p.inventory.steel > 0))
    reason = 'Carry Tools and Steel spare parts';
  return { reason };
}
export function restoreVehicle(w: World, p: Player) {
  const record = vehicleRecord(w, p);
  record.condition = Math.min(100, record.condition + 25);
}

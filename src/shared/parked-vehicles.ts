import {
  parkedFootprintBlocked,
  trailerFootprint,
  rectanglesOverlap,
  vehicleFootprint,
} from './vehicle-footprint';
import { sceneryObstaclesNear } from './scenery-obstacles';
import type { Trailer } from './trailers';
import { beginVehicleMount } from './vehicle-mount';
import { clearTrailer } from './trailers';
import { travelHeight } from './dock';
import { buildingEntry, kerbParking } from './parking-site';
import { isPublicPuddlewick } from './harbour-supply';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from './types';
import { parkingRules } from './parking-rules';
import { boatSlot } from './boats';
import { hasMotor, vehicleDef } from './vehicle-config';
import { vehiclePaint } from './appearance';
import { vehicleRecord } from './vehicle-services';
import { fuelCapacity, fuelVehicle, isTractor, switchVehicle } from './tractors';
import { worldItems } from './world-catalogue';
import { fuelRules } from './fuel-rules';
export interface ParkedVehicle {
  owner: string;
  /** Public projection for owners who are offline. */
  ownerName?: string;
  slot: number;
  x: number;
  z: number;
  heading: number;
  y: number;
  fuel: number;
  condition: number;
  paint?: string;
  parkedAt: number;
  inside?: string;
}
export const parkedKey = (owner: string, slot: number) => `${owner}:${slot}`;
export function persistentVehicles(w: World, p: Player) {
  const r = parkingRules(w.settings);
  return r.vehiclesPersist && (!p.npc || r.parkingNpcs) && !p.game;
}
export function parkableVehicle(w: World, slot: number) {
  return slot !== 7 && hasMotor(w, slot) && !boatSlot(slot, w);
}
export function parkedVehicle(w: World, p: Player, slot: number) {
  return w.parkedVehicles?.[parkedKey(p.id, slot)];
}
export function parkedReturnReason(w: World, p: Player, slot: number, building?: Building) {
  if (!persistentVehicles(w, p)) return;
  const v = parkedVehicle(w, p, slot);
  if (!v) return;
  if (v.inside) {
    if (building?.id !== v.inside) return 'Visit the garage where this vehicle is stored';
  } else {
    const distance = Math.hypot(p.x - v.x, p.z - v.z);
    if (distance > parkingRules(w.settings).parkingReturnRange)
      return `Walk to your ${isTractor(slot) ? 'tractor' : 'vehicle'} first — ${Math.round(distance)} m away`;
  }
}
export function parkCurrentVehicle(w: World, p: Player, inside?: string) {
  const record: ParkedVehicle = {
    owner: p.id,
    slot: p.vehicle,
    x: p.x,
    z: p.z,
    heading: p.heading,
    y: p.y,
    fuel: p.fuel,
    condition: vehicleRecord(w, p).condition,
    paint: vehiclePaint(p),
    parkedAt: w.time,
    ...(inside ? { inside } : {}),
  };
  (w.parkedVehicles ??= {})[parkedKey(p.id, p.vehicle)] = record;
  if (p.parkedFuel) delete p.parkedFuel[p.vehicle];
  p.fuel = 0;
  for (const t of Object.values(w.trailers ?? {}))
    if (t.attached === p.id && !t.parkedWith) t.parkedWith = parkedKey(p.id, p.vehicle);
  return record;
}
/** Called only after action validation. Boats keep their existing mooring/tank path. */
export function switchPersistentVehicle(
  w: World,
  p: Player,
  slot: number,
  building?: Building,
  restoringSeat = false,
) {
  const enabled = restoringSeat || persistentVehicles(w, p);
  const target = parkedVehicle(w, p, slot);
  if ((!enabled && !target) || slot === p.vehicle) {
    switchVehicle(p, slot, true, w);
    return;
  }
  const old =
    enabled && parkableVehicle(w, p.vehicle)
      ? parkCurrentVehicle(
          w,
          p,
          building?.kind === 'garage' && isTractor(slot) ? building.id : undefined,
        )
      : undefined;
  if (target) {
    const previous = fuelVehicle(p, w);
    if (!old && previous !== slot && !parkedVehicle(w, p, previous))
      p.parkedFuel = { ...p.parkedFuel, [previous]: p.fuel };
    p.fuelVehicle = slot;
    p.fuel = target.fuel;
    vehicleRecord(w, p, slot).condition = target.condition;
    if (target.paint !== undefined) p.vehiclePaints = { ...p.vehiclePaints, [slot]: target.paint };
    if (enabled && !target.inside)
      Object.assign(p, { x: target.x, z: target.z, y: target.y, heading: target.heading });
    delete w.parkedVehicles![parkedKey(p.id, slot)];
    for (const t of Object.values(w.trailers ?? {}))
      if (t.parkedWith === parkedKey(p.id, slot)) delete t.parkedWith;
    if (p.parkedFuel) delete p.parkedFuel[slot];
  }
  const previousTank = fuelVehicle(p, w);
  switchVehicle(p, slot, true, w);
  if (p.parkedFuel && parkedVehicle(w, p, previousTank)) delete p.parkedFuel[previousTank];
  if (old && p.parkedFuel) delete p.parkedFuel[old.slot];
  if (old && slot === 5) {
    const offset = parkingRules(w.settings).parkingDoorOffset;
    p.x = old.x - Math.cos(old.heading) * offset;
    p.z = old.z + Math.sin(old.heading) * offset;
  }
  p.engine = false;
  p.lights = false;
}
/** Shared by Use Fuel and explicit parked refuelling, including optional roadside help. */
export function parkedRefuelStatus(w: World, p: Player, owner: string, slot: number) {
  const vehicle = w.parkedVehicles?.[parkedKey(owner, slot)];
  const reach = parkingRules(w.settings).parkingReturnRange;
  const capacity = fuelCapacity({ ...p, fuelVehicle: slot }, w);
  let reason: string | undefined;
  if (!persistentVehicles(w, p) || !vehicle || vehicle.inside || !parkableVehicle(w, slot))
    reason = 'Choose an available parked vehicle';
  else if (owner !== p.id && w.settings.allowPlayerRefuelling === false)
    reason = 'Helping refuel players is disabled in this world';
  else if (p.atHome || p.inside || p.hitch || p.crowBody || p.task || p.game)
    reason = 'Finish other activities and go outside before refuelling';
  else if (
    Math.hypot(p.x - vehicle.x, p.z - vehicle.z) > reach ||
    Math.abs(p.y - vehicle.y) > fuelRules(w.settings).refuelHeight
  )
    reason = `Walk within ${reach} metres of the parked vehicle at the same height`;
  else if (Math.abs(p.speed) > fuelRules(w.settings).refuelSpeed)
    reason = 'Stop moving before refuelling';
  else if (vehicle.fuel >= capacity) reason = 'The tank is full';
  else if (!(p.inventory.fuel > 0)) reason = 'Carry Fuel from a stocked shop or garage';
  const units = Math.max(
    0,
    Math.min(worldItems(w).fuel.fuel ?? 0, capacity - (vehicle?.fuel ?? 0)),
  );
  return { vehicle, units, reason };
}

/** Public defaults are applied once; a later world-owner choice is never overwritten. */
export function prepareParkingRules(w: World) {
  if (w.parkingRulesVersion) return false;
  if (isPublicPuddlewick(w)) w.settings.vehiclesPersist = true;
  w.parkingRulesVersion = 1;
  return true;
}
/** Each successful conversion consumes its legacy tank. Unsafe conversions remain pending. */
export function migrateParkedVehicles(w: World) {
  let changed = false;
  for (const p of Object.values(w.players)) {
    if (!persistentVehicles(w, p)) continue;
    for (const [key, fuel] of Object.entries(p.parkedFuel ?? {})) {
      const slot = Number(key);
      if (!parkableVehicle(w, slot) || slot === p.vehicle || parkedVehicle(w, p, slot)) continue;
      const home = w.buildings.find((b) => b.id === p.home && b.owner === p.id && !b.construction);
      const garages = w.buildings
        .filter(
          (b) => b.kind === 'garage' && !b.construction && !!b.aircraftHangar === (slot === 2),
        )
        .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
      for (const destination of [...(home ? [home] : []), ...garages]) {
        const point = kerbParking(w, destination, slot, parkedKey(p.id, slot));
        if (!point) continue;
        (w.parkedVehicles ??= {})[parkedKey(p.id, slot)] = {
          owner: p.id,
          slot,
          ...point,
          fuel,
          condition: vehicleRecord(w, p, slot).condition,
          paint: vehiclePaint(p, slot),
          parkedAt: w.time,
          ...(destination.kind === 'garage' ? { inside: destination.id } : {}),
        };
        delete p.parkedFuel![slot];
        changed = true;
        break;
      }
    }
  }
  return changed;
}
export function parkAtHome(w: World, p: Player, b: Building) {
  if (!persistentVehicles(w, p)) return;
  if (parkableVehicle(w, p.vehicle)) {
    const trailers = Object.values(w.trailers ?? {}).filter(
      (t) => t.attached === p.id && !t.parkedWith,
    );
    const movedRig = (point: { x: number; z: number; heading: number }) =>
      trailers.map((t) => {
        const angle = point.heading - p.heading,
          c = Math.cos(angle),
          s = Math.sin(angle);
        return {
          ...t,
          x: point.x + (t.x - p.x) * c + (t.z - p.z) * s,
          z: point.z - (t.x - p.x) * s + (t.z - p.z) * c,
          heading: t.heading + angle,
        };
      });
    const point = kerbParking(w, b, p.vehicle, parkedKey(p.id, p.vehicle), (point) =>
      movedRig(point).every((t) => clearParkingTrailer(w, t, parkedKey(p.id, p.vehicle))),
    );

    if (!point) throw Error('No safe clear parking place by this building');
    for (const t of movedRig(point)) Object.assign(w.trailers![t.id], t);
    p.homeParking = { building: b.id, slot: p.vehicle };
    Object.assign(p, point);
    switchPersistentVehicle(w, p, 5);
  }
  Object.assign(p, buildingEntry(b));
}
export function homeDepartureVehicle(w: World, p: Player) {
  const b = w.buildings.find((b) => b.id === p.home),
    saved = p.homeParking;
  const v = saved && parkedVehicle(w, p, saved.slot);
  const entry = b && buildingEntry(b);
  if (
    !b ||
    !saved ||
    saved.building !== b.id ||
    !v ||
    v.inside ||
    !entry ||
    Math.hypot(v.x - entry.x, v.z - entry.z) > parkingRules(w.settings).parkingSearchRange
  )
    throw Error('Walk to your tractor first; it is no longer parked at this home');
  return v;
}
export function leaveParkedHome(w: World, p: Player, tractor: boolean, time = w.time) {
  if (!persistentVehicles(w, p)) return;
  if (tractor) {
    const before = { vehicle: p.vehicle, x: p.x, y: p.y, z: p.z, heading: p.heading };
    const v = homeDepartureVehicle(w, p);
    Object.assign(p, { x: v.x, z: v.z, y: v.y });
    switchPersistentVehicle(w, p, v.slot);
    beginVehicleMount(w, p, before, time);
  } else {
    const b = w.buildings.find((b) => b.id === p.home);
    if (b) Object.assign(p, buildingEntry(b));
  }
}

export function parkOnSignOff(w: World, p: Player) {
  if (
    !persistentVehicles(w, p) ||
    !parkingRules(w.settings).parkingSignOff ||
    !parkableVehicle(w, p.vehicle) ||
    p.atHome ||
    p.hitch ||
    p.crowBody
  )
    return;
  if (
    vehicleDef(w, p.vehicle).mode === 2 &&
    !(p.flight?.grounded ?? p.y <= travelHeight(w, p.x, p.z) + 0.25)
  )
    return;
  p.parkedSeat = p.vehicle;
  switchPersistentVehicle(w, p, 5);
  p.speed = 0;
}
export function restoreParkedSeat(w: World, p: Player) {
  if (p.parkedSeat === undefined) return;
  const slot = p.parkedSeat,
    v = parkedVehicle(w, p, slot);
  if (v) {
    Object.assign(p, { x: v.x, z: v.z, y: v.y, heading: v.heading });
    switchPersistentVehicle(w, p, slot, undefined, true);
  }
  delete p.parkedSeat;
}
export function publicParkedVehicles(w: World) {
  return Object.fromEntries(
    Object.entries(w.parkedVehicles ?? {}).map(([key, v]) => [
      key,
      { ...v, ownerName: w.players[v.owner]?.name ?? v.owner },
    ]),
  );
}
export function removeAbsentParking(w: World, p: Player) {
  for (const [key, v] of Object.entries(w.parkedVehicles ?? {})) {
    if (v.owner !== p.id) continue;
    delete w.parkedVehicles![key];
    for (const t of Object.values(w.trailers ?? {}))
      if (t.parkedWith === key) {
        delete t.parkedWith;
        delete t.attached;
      }
  }
  delete p.parkedSeat;
  delete p.homeParking;
}

/** Keep the drawbar offsets when a stored rig is moved to a clear departure point. */
export function relocatedParkedTrailers(
  w: World,
  key: string,
  point: { x: number; z: number; heading: number },
) {
  const v = w.parkedVehicles?.[key];
  if (!v) return [];
  const a = point.heading - v.heading,
    c = Math.cos(a),
    s = Math.sin(a);
  return Object.values(w.trailers ?? {})
    .filter((t) => t.parkedWith === key)
    .map((t) => ({
      ...t,
      x: point.x + (t.x - v.x) * c + (t.z - v.z) * s,
      z: point.z - (t.x - v.x) * s + (t.z - v.z) * c,
      heading: t.heading + a,
    }));
}
export function clearParkedRig(
  w: World,
  key: string,
  point: { x: number; z: number; heading: number },
) {
  return relocatedParkedTrailers(w, key, point).every((t) => clearParkingTrailer(w, t, key));
}

function clearParkingTrailer(w: World, t: Trailer, key: string) {
  const rect = trailerFootprint(t),
    radius = Math.hypot(rect.hx, rect.hz);
  return (
    clearTrailer(w, t, t) &&
    !parkedFootprintBlocked(w, rect, key) &&
    !Object.values(w.players).some(
      (p) =>
        p.online &&
        !p.atHome &&
        !p.inside &&
        !key.startsWith(`${p.id}:`) &&
        rectanglesOverlap(rect, vehicleFootprint(w, p.vehicle, p)),
    ) &&
    !sceneryObstaclesNear(w, t, t, radius).some((o) =>
      rectanglesOverlap(rect, {
        x: o.x,
        z: o.z,
        hx: o.radius,
        hz: o.radius,
        axes: [
          { x: 1, z: 0 },
          { x: 0, z: 1 },
        ],
      }),
    )
  );
}

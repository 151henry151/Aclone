import { boatSlot } from './boats';
import { storeHangarArrival } from './garage-storage';
import { beginVehicleMount } from './vehicle-mount';
import { say } from './messages';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from './types';
import { parkingRules } from './parking-rules';
import {
  parkAtHome,
  leaveParkedHome,
  homeDepartureVehicle,
  persistentVehicles,
} from './parked-vehicles';
import { buildingEntry } from './parking-site';
import { travelHeight } from './dock';
export interface Arrival {
  mount?: import('./vehicle-mount').VehicleMount;
  building: string;
  start: number;
  end: number;
  from: { x: number; z: number; y: number };
  to: { x: number; z: number; y: number };
  home?: boolean;
  fromInside?: boolean;
  departTractor?: boolean;
}
export function arrivalDuration(w: World, distance: number) {
  const r = parkingRules(w.settings);
  return r.arrivalAnimation === 'off'
    ? 0
    : r.arrivalAnimation === 'quick'
      ? r.arrivalQuickSeconds
      : r.arrivalMinSeconds +
        (r.arrivalMaxSeconds - r.arrivalMinSeconds) * Math.min(1, distance / r.arrivalRange);
}
export function arrivalPosition(p: Player, time: number) {
  const a = p.task?.arrival;
  if (!a) return { x: p.x, y: p.y, z: p.z };
  const duration = a.end - a.start;
  const start = a.fromInside ? a.start + duration * arrivalDoorOpen : (a.mount?.end ?? a.start);
  const end = p.task?.kind === 'entering' ? a.start + duration * arrivalDoorClose : a.end;
  const f = Math.max(0, Math.min(1, (time - start) / (end - start || 1)));
  return {
    x: a.from.x + (a.to.x - a.from.x) * f,
    y: a.from.y + (a.to.y - a.from.y) * f,
    z: a.from.z + (a.to.z - a.from.z) * f,
  };
}
export function approachBuilding(w: World, p: Player, b: Building, home = false) {
  const walkingIn = p.vehicle === 5 && parkingRules(w.settings).arrivalWalkIn;
  if (
    p.task ||
    p.hitch ||
    p.crowBody ||
    p.game ||
    p.inside ||
    p.atHome ||
    (!walkingIn && Math.abs(p.speed) >= 0.5)
  )
    throw Error('Stop outside and finish your activity before entering');
  if (boatSlot(p.vehicle, w)) throw Error('Disembark at a boathouse before entering a building');
  if (b.construction) throw Error('Supply the construction materials first');
  if (Math.hypot(p.x - b.x, p.z - b.z) > parkingRules(w.settings).arrivalRange)
    throw Error(`Move within ${parkingRules(w.settings).arrivalRange} metres of this building`);
  const original = { x: p.x, y: p.y, z: p.z };
  const previousVehicle = p.vehicle;
  if (!storeHangarArrival(w, p, b)) parkAtHome(w, p, b);
  // ParkAtHome finds the safe kerb; the visible walk starts at its driver side.
  const from =
    p.homeParking?.building === b.id
      ? (() => {
          const v = w.parkedVehicles?.[`${p.id}:${p.homeParking!.slot}`];
          const offset = parkingRules(w.settings).parkingDoorOffset;
          return v
            ? {
                x: v.x - Math.cos(v.heading) * offset,
                z: v.z + Math.sin(v.heading) * offset,
                y: v.y,
              }
            : original;
        })()
      : original;
  const entry = buildingEntry(b),
    to = { ...entry, y: travelHeight(w, entry.x, entry.z) };
  const end = w.time + arrivalDuration(w, Math.hypot(to.x - from.x, to.z - from.z));
  Object.assign(p, from, { speed: 0 });
  const parked = w.parkedVehicles?.[`${p.id}:${previousVehicle}`];
  const mount = parked
    ? beginVehicleMount(w, p, { vehicle: previousVehicle, ...parked })
    : undefined;
  if (mount) mount.end = Math.min(mount.end, w.time + (end - w.time) / 2);
  p.task = {
    kind: 'entering',
    building: b.id,
    end,
    arrival: { building: b.id, start: w.time, end, from, to, home, mount },
  };
  if (end === w.time) finishArrival(w, p);
}
export function exitBuilding(w: World, p: Player, departTractor = false) {
  const id = p.inside ?? p.task?.arrival?.building ?? (p.atHome ? p.home : undefined);
  const b = w.buildings.find((b) => b.id === id);
  if (!b) throw Error('There is no building to leave');
  if (p.task && !p.task.arrival && p.task.kind !== 'homeCook')
    throw Error('Finish your activity before leaving');
  if (departTractor) homeDepartureVehicle(w, p);
  const from = arrivalPosition(p, w.time),
    entry = buildingEntry(b),
    r = parkingRules(w.settings);
  const to = {
    x: entry.x + Math.sin(b.rotation) * r.parkingDoorOffset,
    z: entry.z + Math.cos(b.rotation) * r.parkingDoorOffset,
    y: travelHeight(w, entry.x, entry.z),
  };
  const end = w.time + arrivalDuration(w, Math.hypot(to.x - from.x, to.z - from.z));
  const home = p.atHome || p.task?.arrival?.home,
    fromInside = !!(p.inside || p.atHome);
  delete p.inside;
  p.atHome = false;
  Object.assign(p, from, { speed: 0 });
  p.task = {
    kind: 'exiting',
    building: b.id,
    end,
    arrival: { building: b.id, start: w.time, end, from, to, home, departTractor, fromInside },
  };
  if (end === w.time) finishArrival(w, p);
}
export function finishArrival(w: World, p: Player, time = w.time) {
  const task = p.task,
    a = task?.arrival;
  if (!a) return false;
  Object.assign(p, a.to, { speed: 0 });
  delete p.task;
  const b = w.buildings.find((b) => b.id === a.building && !b.construction);
  if (!b) return true;
  p.heading = b.rotation + Math.PI;
  if (task!.kind === 'entering') {
    p.inside = b.id;
    if (a.home) {
      p.home = b.id;
      p.atHome = true;
    }
  } else if (a.home && a.departTractor) {
    try {
      leaveParkedHome(w, p, true, time);
    } catch (error) {
      say(
        w,
        'Parking',
        error instanceof Error ? error.message : 'Your departure vehicle is unavailable',
        'system',
        p.id,
      );
    }
  }
  return true;
}
export const animatedArrival = (w: World, p: Player) =>
  persistentVehicles(w, p) && parkingRules(w.settings).arrivalAnimation !== 'off';

const arrivalDoorOpen = 0.25,
  arrivalDoorClose = 0.8;
export function arrivalDoorOpenness(a: Arrival, time: number) {
  const f = Math.max(0, Math.min(1, (time - a.start) / (a.end - a.start || 1)));
  return Math.min(1, f / arrivalDoorOpen, (1 - f) / (1 - arrivalDoorClose));
}
export function arrivalVisible(p: Player, time: number) {
  const a = p.task?.arrival;
  if (!a) return true;
  const f = (time - a.start) / (a.end - a.start || 1);
  return p.task?.kind === 'entering' ? f < arrivalDoorClose : !a.fromInside || f >= arrivalDoorOpen;
}

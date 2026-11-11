// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building, Action } from './types';
import { parkingRules } from './parking-rules';
import { vehicleDef } from './vehicle-config';
import {
  parkedKey,
  parkCurrentVehicle,
  persistentVehicles,
  GARAGE_STORAGE,
  clearParkedRig,
  relocatedParkedTrailers,
} from './parked-vehicles';
import { kerbParking } from './parking-site';
import { clearTrailer, trailerDef } from './trailers';
import { trailerStorage } from './stored-trailers';
import { isTractor, switchVehicle } from './tractors';
import { parkingBlocker } from './ground-parking';
export const storageGarage = (b?: Building) =>
  !!b && !b.construction && (b.kind === 'vehicleStorage' || b.kind === 'garage');
export function landStorageVehicle(w: World, slot: number) {
  return ![5, 6, 7, 29, 34].includes(slot) && [0, 1, 4, 5].includes(vehicleDef(w, slot).mode);
}
function need(value: unknown, reason: string): asserts value {
  if (!value) throw Error(reason);
}
function checkDeposit(
  w: World,
  p: Player,
  b: Building,
  target: { x: number; z: number },
  incoming: number,
) {
  const r = parkingRules(w.settings);
  need(r.garageStorageEnabled, 'New garage storage is disabled in this world');
  need(
    b.kind !== 'vehicleStorage' || b.owner === p.id,
    'Only the private garage owner may store vehicles here',
  );
  need(
    Math.hypot(target.x - b.x, target.z - b.z) <= r.garageStorageRange &&
      Math.hypot(target.x - p.x, target.z - p.z) <= r.garageStorageRange,
    'Bring the vehicle within the garage storage handling range',
  );
  const count =
    Object.values(w.parkedVehicles ?? {}).filter((v) => v.owner === p.id && v.inside === b.id)
      .length +
    Object.values(w.trailers ?? {}).filter((t) => t.owner === p.id && trailerStorage(w, t) === b.id)
      .length;
  need(
    !r.garageStorageLimit || count + incoming <= r.garageStorageLimit,
    'Garage storage limit reached; retrieve a vehicle first',
  );
}
/** Validate the whole arriving rig before parking or changing the active vehicle. */
export function storeHangarArrival(
  w: World,
  p: Player,
  b: Building,
  beforeStore: () => void = () => {},
) {
  if (
    !b.aircraftHangar ||
    !storageGarage(b) ||
    !persistentVehicles(w, p) ||
    !landStorageVehicle(w, p.vehicle) ||
    !parkingRules(w.settings).garageStorageEnabled
  )
    return false;
  need((p.fleet ?? [0, 5]).includes(p.vehicle), 'Choose your own land vehicle');
  const rig = Object.values(w.trailers ?? {}).filter((t) => t.attached === p.id && !t.parkedWith);
  need(
    rig.every((t) => t.owner === p.id),
    'Only your own trailers may be stored with this vehicle',
  );
  checkDeposit(w, p, b, p, 1 + rig.length);
  beforeStore();
  const slot = p.vehicle;
  parkCurrentVehicle(w, p, b.id).garageStored = true;
  switchVehicle(p, 5, true, w);
  p.homeParking = { building: b.id, slot };
  p.engine = false;
  p.lights = false;
  return true;
}
export function garageStorageAction(w: World, p: Player, a: Action) {
  const b = w.buildings.find((b) => b.id === a.building),
    r = parkingRules(w.settings);
  need(
    b && storageGarage(b),
    'Choose a completed vehicle storage garage, tractor garage or aircraft hangar',
  );
  need(
    !p.task &&
      !p.game &&
      !p.hitch &&
      !p.crowBody &&
      !p.atHome &&
      (!p.inside || p.inside === b.id) &&
      Math.abs(p.speed) < 0.5,
    'Stop and finish other activities before using garage storage',
  );
  need(
    Math.hypot(p.x - b.x, p.z - b.z) <= r.garageStorageRange,
    'Move within the garage storage handling range',
  );
  const operation = String(a.operation),
    store = operation === 'storeVehicle' || operation === 'storeTrailer',
    vehicle = operation === 'storeVehicle' || operation === 'retrieveVehicle';
  need(
    ['storeVehicle', 'retrieveVehicle', 'storeTrailer', 'retrieveTrailer'].includes(operation),
    'Choose store or retrieve',
  );
  const slot = Number(a.slot),
    key = parkedKey(p.id, slot),
    v = vehicle ? w.parkedVehicles?.[key] : undefined,
    t = vehicle ? undefined : w.trailers?.[String(a.id)];
  const target = v ?? t;
  need(target && target.owner === p.id, 'Choose your own parked vehicle or trailer');
  if (vehicle)
    need(
      v && v.slot === slot && (p.fleet ?? [0, 5]).includes(slot) && landStorageVehicle(w, slot),
      'Choose an owned land vehicle; park it before storing',
    );
  if (t)
    need(
      !t.attached && !t.parkedWith,
      'Unhitch the trailer first, or store/retrieve the vehicle and its complete rig',
    );
  const stored = v?.inside ?? (t && trailerStorage(w, t));
  const rig = v ? Object.values(w.trailers ?? {}).filter((t) => t.parkedWith === key) : [];
  need(
    rig.every((t) => t.owner === p.id),
    'Only your own trailers may be stored with this vehicle',
  );
  if (store) {
    need(!stored, 'This vehicle is already stored; retrieve it first');
    checkDeposit(w, p, b, target, 1 + rig.length);
    if (v) {
      v.inside = b.id;
      v.garageStored = true;
      delete v.deliveryPending;
    } else t!.storedAt = b.id;
    return 'Stored in the garage. Fuel, condition and cargo stay with the vehicle.';
  }
  need(
    stored === b.id || (stored === GARAGE_STORAGE && b.kind === 'garage' && !b.aircraftHangar),
    'Retrieve this vehicle at the garage where it is stored',
  );
  // Retrieval never requires a licence: it delivers the unoccupied vehicle outside.
  // All geometry checks precede mutation, including the entire hitched rig.
  let point;
  if (v)
    point = kerbParking(
      w,
      b,
      slot,
      key,
      (q) => !parkingBlocker(w, { ...p, ...q, vehicle: slot }) && clearParkedRig(w, key, q),
    );
  else {
    const d = trailerDef(w, t!.kind),
      survey = {
        ...w,
        vehicleTuning: {
          ...w.vehicleTuning,
          37: { ...w.vehicleTuning?.[37], length: d.length, width: d.width },
        },
      };
    point = kerbParking(
      survey,
      b,
      37,
      undefined,
      (q) =>
        !parkingBlocker(survey, { ...p, ...q, vehicle: 37 }) &&
        clearTrailer(w, { ...t!, ...q }, { ...q }),
    );
  }
  need(point, 'No safe clear space outside this garage; clear the exit and try again');
  if (v) {
    const moved = relocatedParkedTrailers(w, key, point);
    Object.assign(v, point, { parkedAt: w.time, deliveryPending: true });
    delete v.inside;
    delete v.garageStored;
    for (const trailer of moved) Object.assign(w.trailers![trailer.id], trailer);
    if (isTractor(slot)) p.lastTractor = slot;
  } else {
    Object.assign(t!, point);
    delete t!.storedAt;
  }
  return 'Retrieved outside the garage. Walk over to board or hitch it.';
}

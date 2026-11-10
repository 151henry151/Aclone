import { actionBlocker } from './action-visibility';
// SPDX-License-Identifier: GPL-3.0-or-later
import { parkingRules } from '../shared/parking-rules';
import type { Player, World } from '../shared/types';
import { fuelVehicle, isTractor } from '../shared/tractors';
import {
  parkedBodyDistance,
  type ParkedVehicle,
  GARAGE_STORAGE,
  parkedRefuelStatus,
  persistentVehicles,
} from '../shared/parked-vehicles';
import { vehicleDef } from '../shared/vehicle-config';

/** Guidance always refers to the physical tank, never the walker's legacy fuel. */
export function parkingStatus(w: World, p: Player) {
  if (p.vehicle !== 5 || p.inside || p.atHome || p.task) return;
  const owned = Object.values(w.parkedVehicles ?? {}).filter(
    (v) =>
      v.owner === p.id &&
      v.inside !== GARAGE_STORAGE &&
      (persistentVehicles(w, p) || v.deliveryPending),
  );
  const v =
    owned
      .filter(
        (v) =>
          !v.inside && parkedBodyDistance(w, p, v) <= parkingRules(w.settings).parkingReturnRange,
      )
      .sort((a, b) => parkedBodyDistance(w, p, a) - parkedBodyDistance(w, p, b))[0] ??
    owned.find((v) => v.slot === fuelVehicle(p, w)) ??
    owned[0];
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
    returnReason: boardingReason(w, p, v),
    refuelReason: parkedRefuelStatus(w, p, p.id, v.slot).reason,
  };
}

/** Find a physical owned tractor independently of the currently selected fuel tank. */
export function tractorWaypoint(w: World, p: Player) {
  if (!persistentVehicles(w, p)) return;
  return Object.values(w.parkedVehicles ?? {})
    .filter((v) => v.owner === p.id && isTractor(v.slot) && v.inside !== GARAGE_STORAGE)
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

/** One explanation shared by HUD, inventory and click-to-board. The server validates again. */
export function boardingReason(w: World, p: Player, v: ParkedVehicle) {
  if (v.owner !== p.id || !(p.fleet ?? [0, 5]).includes(v.slot)) return 'This vehicle is not yours';
  if (v.inside) return 'Retrieve this vehicle from garage storage first';
  if (p.vehicle !== 5) return 'Step out of your current vehicle first';
  if (p.task || p.atHome || p.inside || p.hitch || p.crowBody || p.game || Math.abs(p.speed) >= 0.5)
    return 'Stop outside and finish your activity before boarding';
  return actionBlocker(w, p, 'vehicle', String(v.slot));
}
export function nearbyBoardingVehicles(w: World, p: Player) {
  return Object.values(w.parkedVehicles ?? {})
    .filter(
      (v) =>
        v.owner === p.id &&
        !v.inside &&
        (persistentVehicles(w, p) || v.deliveryPending) &&
        parkedBodyDistance(w, p, v) <= parkingRules(w.settings).parkingReturnRange,
    )
    .sort((a, b) => parkedBodyDistance(w, p, a) - parkedBodyDistance(w, p, b));
}
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function boardingPanel(w: World, p: Player) {
  const rows = nearbyBoardingVehicles(w, p);
  return `<section data-boarding-panel><h3>Nearby vehicles</h3>${
    p.vehicle !== 5
      ? '<p>Step out of your current vehicle to board another.</p>'
      : rows.length
        ? rows
            .map((v) => {
              const reason = boardingReason(w, p, v);
              return `<div><button data-do="vehicle" data-id="${v.slot}" ${reason ? 'disabled' : ''}>Get in ${escape(vehicleDef(w, v.slot).name)}</button>${reason ? `<p class="note">${escape(reason)}</p>` : ''}</div>`;
            })
            .join('')
        : '<p>No owned parked vehicle within boarding reach. Walk alongside it, or retrieve it from its garage first.</p>'
  }</section>`;
}

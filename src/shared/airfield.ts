// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types';

/** Public airfield reservation, in metres. The runway runs north/south. */
export interface Airfield {
  x: number;
  z: number;
  length: number;
  width: number;
  height: number;
  hangar: string;
  apronX: number;
  apronZ: number;
}
export function airfieldAreas(a: Airfield) {
  return [
    { x: a.x, z: a.z, hx: a.width / 2 + 10, hz: a.length / 2 + 10 },
    { x: a.apronX, z: a.apronZ, hx: 28, hz: 25 },
  ];
}
export function onAirfield(w: Pick<World, 'airfield'>, x: number, z: number, margin = 0) {
  const a = w.airfield;
  return (
    !!a &&
    ((Math.abs(x - a.x) < a.width / 2 + 10 + margin &&
      Math.abs(z - a.z) < a.length / 2 + 10 + margin) ||
      (Math.abs(x - a.apronX) < 28 + margin && Math.abs(z - a.apronZ) < 25 + margin))
  );
}
/** Three metre shoulder blends the graded strip into undisturbed terrain. */
export function airfieldHeight(a: Airfield | undefined, x: number, z: number, height: number) {
  if (!a) return height;
  const shoulder = (cx: number, cz: number, hx: number, hz: number) => {
    const d = Math.hypot(Math.max(0, Math.abs(x - cx) - hx), Math.max(0, Math.abs(z - cz) - hz));
    const t = Math.max(0, 1 - d / 3);
    return t * t * (3 - 2 * t);
  };
  const weight = Math.max(
    shoulder(a.x, a.z, a.width / 2 + 10, a.length / 2 + 10),
    shoulder(a.apronX, a.apronZ, 28, 25),
  );
  return height * (1 - weight) + a.height * weight;
}
/** One ready aircraft retains its normal fuel/paint/service record. Spares are fresh,
 * empty airframes, commissioned only after destruction; they cannot duplicate fuel. */
export function aircraftCount(p: Player) {
  return ((p.fleet ?? [0, 5]).includes(2) ? 1 : 0) + Math.max(0, Math.floor(p.spareBiplanes ?? 0));
}
export function commissionBiplane(p: Player) {
  if ((p.fleet ?? [0, 5]).includes(2) || !(p.spareBiplanes! > 0)) return;
  p.spareBiplanes = (p.spareBiplanes ?? 0) - 1;
  p.fleet = [...(p.fleet ?? [0, 5]), 2];
  p.parkedFuel = { ...p.parkedFuel, 2: 0 };
  if (p.fleetState) delete p.fleetState[2];
  if (p.vehiclePaints) delete p.vehiclePaints[2];
}

/** Worlds without an airfield retain their existing garage aircraft desk. */
export function hasAircraftHangar(w: Pick<World, 'buildings'>) {
  return w.buildings.some((b) => b.aircraftHangar && !b.construction);
}

import { isSemitrailer, semitrailerDefinition } from './highway-definitions';
import { trailerDefs, type TrailerKind } from './trailer-definitions';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { vehicleDef } from './vehicle-config';
export interface GroundRect {
  x: number;
  z: number;
  hx: number;
  hz: number;
  axes: { x: number; z: number }[];
}
export function vehicleFootprint(
  w: World,
  slot: number,
  at: { x: number; z: number; heading: number },
): GroundRect {
  const v = vehicleDef(w, slot),
    radius = v.collisionRadius ?? (v.mode === 8 ? 0.25 : 1.3);
  return {
    x: at.x,
    z: at.z,
    hx: (v.width ?? radius * 2) / 2,
    hz: (v.length ?? radius * 2) / 2,
    axes: [
      { x: Math.cos(at.heading), z: -Math.sin(at.heading) },
      { x: Math.sin(at.heading), z: Math.cos(at.heading) },
    ],
  };
}
export function rectanglesOverlap(a: GroundRect, b: GroundRect, padding = 0) {
  const projection = (r: GroundRect, axis: { x: number; z: number }) =>
    r.hx * Math.abs(r.axes[0].x * axis.x + r.axes[0].z * axis.z) +
    r.hz * Math.abs(r.axes[1].x * axis.x + r.axes[1].z * axis.z);
  return ![...a.axes, ...b.axes].some(
    (axis) =>
      Math.abs((a.x - b.x) * axis.x + (a.z - b.z) * axis.z) >=
      projection(a, axis) + projection(b, axis) + padding,
  );
}
export function parkedFootprintBlocked(w: World, rect: GroundRect, except?: string) {
  return Object.entries(w.parkedVehicles ?? {}).some(
    ([key, v]) =>
      key !== except && !v.inside && rectanglesOverlap(rect, vehicleFootprint(w, v.slot, v)),
  );
}

export function trailerFootprint(
  t: {
    x: number;
    z: number;
    heading: number;
    kind: TrailerKind;
  },
  w?: Pick<World, 'automotive'>,
): GroundRect {
  const d = isSemitrailer(t.kind) ? semitrailerDefinition(t.kind, w) : trailerDefs[t.kind];
  return {
    x: t.x,
    z: t.z,
    hx: d.width / 2,
    hz: d.length / 2,
    axes: [
      { x: Math.cos(t.heading), z: -Math.sin(t.heading) },
      { x: Math.sin(t.heading), z: Math.cos(t.heading) },
    ],
  };
}

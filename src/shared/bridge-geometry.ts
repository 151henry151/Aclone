import { trailerStorage } from './stored-trailers';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { BridgePlan } from './bridge-types';
import type { GroundRect } from './vehicle-footprint';
export const BRIDGE_RAIL_WIDTH = 0.18;
export function bridgeReservedFootprint(b: BridgePlan): GroundRect {
  const rect = bridgeFootprint(b);
  return { ...rect, hx: rect.hx + BRIDGE_RAIL_WIDTH };
}
export function bridgeFootprint(b: BridgePlan): GroundRect {
  const a = b.approachA,
    c = b.approachB,
    length = Math.hypot(c.x - a.x, c.z - a.z);
  const dx = (c.x - a.x) / length,
    dz = (c.z - a.z) / length;
  return {
    x: (a.x + c.x) / 2,
    z: (a.z + c.z) / 2,
    hx: b.width / 2,
    hz: length / 2,
    axes: [
      { x: dz, z: -dx },
      { x: dx, z: dz },
    ],
  };
}

import type { Bridge } from './bridge-types';
import type { World, Player } from './types';
import type { Point } from './town';
import { terrainHeight } from './terrain';
import { bridgeRules } from './bridge-rules';
import { vehicleFootprint, rectanglesOverlap, parkedFootprintBlocked } from './vehicle-footprint';
/** Physical support remains after maintenance/access closure so occupants can leave. */
export function bridgeDeckHeight(w: World, x: number, z: number) {
  for (const b of w.bridges ?? []) {
    if (b.completedAt === undefined) continue;
    const rect = bridgeFootprint(b),
      dx = x - rect.x,
      dz = z - rect.z;
    if (
      Math.abs(dx * rect.axes[0].x + dz * rect.axes[0].z) > rect.hx + 1e-8 ||
      Math.abs(dx * rect.axes[1].x + dz * rect.axes[1].z) > rect.hz + 1e-8
    )
      continue;
    const span = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
    const along = (x - b.a.x) * rect.axes[1].x + (z - b.a.z) * rect.axes[1].z;
    const side = dx * rect.axes[0].x + dz * rect.axes[0].z;
    return along < 0
      ? bridgeRampHeight(b, 0, -along, side)
      : along > span
        ? bridgeRampHeight(b, 1, along - span, side)
        : b.deckY;
  }
  return undefined;
}
export function bridgeAccessReason(w: World, p: Player, b: Bridge) {
  if (b.completedAt === undefined) return 'Bridge construction is unfinished';
  const r = bridgeRules(w.settings);
  if (b.condition < r.bridgeMinimumCondition) return 'Bridge closed for maintenance';
  if (!r.bridgePublicAccess && b.owner !== p.id) return 'This bridge is private; owner access only';
  if (b.closure) return b.closure;
  return undefined;
}
/** Sweep oriented footprints through both rail planes, including intermediate turns. */
export function bridgeRectBlocked(w: World, from: GroundRect, to: GroundRect, player?: Player) {
  if (!w.bridges?.length) return false;
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.4),
    Math.ceil(
      (Math.hypot(to.axes[1].x - from.axes[1].x, to.axes[1].z - from.axes[1].z) * from.hz) / 0.4,
    ),
  );
  for (const b of w.bridges) {
    if (b.completedAt === undefined) continue;
    const footprint = bridgeFootprint(b);
    // Clip the centre sweep to a conservative expanded bridge rectangle. Road
    // surveys can span kilometres; only nearby samples can touch these rails.
    const radius = Math.hypot(from.hx, from.hz);
    let first = 0,
      last = 1;
    for (const [axis, half] of [
      [footprint.axes[0], footprint.hx],
      [footprint.axes[1], footprint.hz],
    ] as const) {
      const start = (from.x - footprint.x) * axis.x + (from.z - footprint.z) * axis.z;
      const delta = (to.x - from.x) * axis.x + (to.z - from.z) * axis.z;
      const extent = half + radius;
      if (Math.abs(delta) < 1e-12) {
        if (Math.abs(start) > extent) {
          last = -1;
          break;
        }
      } else {
        const a = (-extent - start) / delta,
          b = (extent - start) / delta;
        first = Math.max(first, Math.min(a, b));
        last = Math.min(last, Math.max(a, b));
      }
    }
    if (first > last) continue;
    const startInside = rectanglesOverlap(footprint, from);
    for (
      let i = Math.max(1, Math.floor(first * steps));
      i <= Math.min(steps, Math.ceil(last * steps));
      i++
    ) {
      const t = i / steps;
      const rect = {
        ...from,
        x: from.x + (to.x - from.x) * t,
        z: from.z + (to.z - from.z) * t,
        axes: from.axes.map((axis, j) => ({
          x: axis.x + (to.axes[j].x - axis.x) * t,
          z: axis.z + (to.axes[j].z - axis.z) * t,
        })),
      };
      if (!rectanglesOverlap(footprint, rect)) continue;
      const dx = rect.x - footprint.x,
        dz = rect.z - footprint.z;
      const side = Math.abs(dx * footprint.axes[0].x + dz * footprint.axes[0].z);
      const halfWidth =
        rect.hx *
          Math.abs(rect.axes[0].x * footprint.axes[0].x + rect.axes[0].z * footprint.axes[0].z) +
        rect.hz *
          Math.abs(rect.axes[1].x * footprint.axes[0].x + rect.axes[1].z * footprint.axes[0].z);
      if (side + halfWidth > footprint.hx + 1e-6) return true;
      if (player && !startInside && !player.bridgePasses?.[b.id]?.entered) {
        if (bridgeAccessReason(w, player, b)) return true;
        if (
          bridgeRules(w.settings).bridgeToll > 0 &&
          player.id !== b.owner &&
          !player.bridgePasses?.[b.id]
        )
          return true;
      }
    }
  }
  return false;
}
export function bridgeGroundBlocked(w: World, p: Player, to: Point, beforeHeading = p.heading) {
  if (!w.bridges?.length) return false;
  return bridgeRectBlocked(
    w,
    vehicleFootprint(w, p.vehicle, { ...p, heading: beforeHeading }),
    vehicleFootprint(w, p.vehicle, { ...to, heading: p.heading }),
    p,
  );
}
export function updateBridgePassages(w: World, p: Player) {
  if (!w.bridges?.length && !p.bridgePasses) return;
  const rect = vehicleFootprint(w, p.vehicle, p);
  let passes = p.bridgePasses;
  const change = () => {
    if (passes === p.bridgePasses) passes = { ...passes };
    return passes!;
  };
  for (const b of w.bridges ?? []) {
    if (b.completedAt === undefined) continue;
    const footprint = bridgeFootprint(b),
      inside = rectanglesOverlap(footprint, rect);
    if (inside && !passes?.[b.id]?.entered) change()[b.id] = { entered: true };
    if (!inside && passes?.[b.id]?.entered) {
      const trailer = Object.values(w.trailers ?? {}).find((t) => t.attached === p.id);
      if (trailer && rectanglesOverlap(footprint, trailerFootprint(trailer, w))) continue;
      delete change()[b.id];
    }
  }
  if (passes !== p.bridgePasses) p.bridgePasses = passes;
}
import { trailerFootprint } from './vehicle-footprint';

/** Above-water clearance at a hull sample; approach foundations remain solid. */
export function bridgeWaterClearance(w: World, x: number, z: number, water: number) {
  for (const b of w.bridges ?? []) {
    if (b.completedAt === undefined) continue;
    const rect = bridgeReservedFootprint(b),
      dx = x - rect.x,
      dz = z - rect.z;
    if (
      Math.abs(dx * rect.axes[0].x + dz * rect.axes[0].z) > rect.hx ||
      Math.abs(dx * rect.axes[1].x + dz * rect.axes[1].z) > rect.hz
    )
      continue;
    const along = (x - b.a.x) * rect.axes[1].x + (z - b.a.z) * rect.axes[1].z;
    const length = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z);
    return along >= 0 && along <= length ? b.deckY - b.thickness - water : 0;
  }
  return Infinity;
}

/** Identical triangle interpolation for saved approach geometry and wheel support. */
export function bridgeRampHeight(b: BridgePlan, end: 0 | 1, distance: number, side: number) {
  const rows = b.ramps[end].rows;
  const d = Math.max(0, Math.min(rows.at(-1)!.distance, distance));
  let row = 0;
  while (row < rows.length - 2 && rows[row + 1].distance < d) row++;
  const before = rows[row],
    after = rows[row + 1];
  const n = before.heights.length - 1;
  const coordinate = Math.max(0, Math.min(n, (side / (b.width + 2 * BRIDGE_RAIL_WIDTH) + 0.5) * n));
  const column = Math.min(n - 1, Math.floor(coordinate)),
    u = coordinate - column;
  const v = (d - before.distance) / (after.distance - before.distance);
  return u + v <= 1
    ? before.heights[column] * (1 - u - v) +
        before.heights[column + 1] * u +
        after.heights[column] * v
    : after.heights[column + 1] * (u + v - 1) +
        after.heights[column] * (1 - u) +
        before.heights[column + 1] * (1 - v);
}

/** Conservative circular reservation check, including rails and unfinished sites. */
export function bridgeReserved(w: Pick<World, 'bridges'>, x: number, z: number, radius = 0) {
  return (w.bridges ?? []).some((b) => {
    const r = bridgeReservedFootprint(b),
      dx = x - r.x,
      dz = z - r.z;
    const across = Math.max(0, Math.abs(dx * r.axes[0].x + dz * r.axes[0].z) - r.hx);
    const along = Math.max(0, Math.abs(dx * r.axes[1].x + dz * r.axes[1].z) - r.hz);
    return Math.hypot(across, along) <= radius;
  });
}

/** Permanent parked vehicles and unhitched trailers cannot be buried by a new site. */
export function bridgeSiteVehicleBlocked(w: World, plan: BridgePlan) {
  const footprint = bridgeReservedFootprint(plan);
  return (
    parkedFootprintBlocked(w, footprint) ||
    Object.values(w.trailers ?? {}).some(
      (t) =>
        !trailerStorage(w, t) &&
        !t.attached &&
        rectanglesOverlap(footprint, trailerFootprint(t, w)),
    ) ||
    Object.values(w.mooredBoats ?? {}).some((b) =>
      rectanglesOverlap(footprint, vehicleFootprint(w, b.slot, b)),
    )
  );
}

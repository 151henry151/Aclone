// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Bridge } from './bridge-types';
import type { Road, Point } from './town';
import { bridgeRules } from './bridge-rules';
type NetworkWorld = Pick<World, 'bridges' | 'settings'>;
export function publicBridges(w: NetworkWorld): Bridge[] {
  const r = bridgeRules(w.settings);
  if (!r.bridgePublicAccess || r.bridgeToll > 0) return [];
  return (w.bridges ?? []).filter(
    (b) => b.completedAt !== undefined && !b.closure && b.condition >= r.bridgeMinimumCondition,
  );
}
const empty: readonly Road[] = [];
type CachedBridge = { id: string; width: number; available: boolean; points: number[] };
const cache = new WeakMap<Bridge[], { entries: CachedBridge[]; roads: readonly Road[] }>();
/** Derived geometry never overwrites persistent dirt roads or a completed bridge's design. */
export function bridgeRoads(w: NetworkWorld): readonly Road[] {
  if (!w.bridges?.length) return empty;
  const r = bridgeRules(w.settings);
  const available = (b: Bridge) =>
    r.bridgePublicAccess &&
    r.bridgeToll === 0 &&
    b.completedAt !== undefined &&
    !b.closure &&
    b.condition >= r.bridgeMinimumCondition;
  const prior = cache.get(w.bridges);
  if (
    prior &&
    prior.entries.length === w.bridges.length &&
    w.bridges.every((b, i) => {
      const e = prior.entries[i],
        p = e.points;
      return (
        b.id === e.id &&
        b.width === e.width &&
        available(b) === e.available &&
        b.approachA.x === p[0] &&
        b.approachA.z === p[1] &&
        b.a.x === p[2] &&
        b.a.z === p[3] &&
        b.b.x === p[4] &&
        b.b.z === p[5] &&
        b.approachB.x === p[6] &&
        b.approachB.z === p[7]
      );
    })
  )
    return prior.roads;
  const entries = w.bridges.map((b) => ({
    id: b.id,
    width: b.width,
    available: available(b),
    points: [
      b.approachA.x,
      b.approachA.z,
      b.a.x,
      b.a.z,
      b.b.x,
      b.b.z,
      b.approachB.x,
      b.approachB.z,
    ],
  }));
  const roads = w.bridges.filter(available).flatMap((b) =>
    [b.approachA, b.a, b.b].map((a, i) => ({
      a,
      b: [b.a, b.b, b.approachB][i],
      width: b.width,
      bridge: b.id,
    })),
  );
  cache.set(w.bridges, { entries, roads });
  return roads;
}
/** Split a proposed centreline at deck entrances so paving never creates an orphan river road. */
export function bridgePathCuts(w: World, path: Point[]): Point[] {
  const result: Point[] = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      cuts = [0];
    for (const bridge of publicBridges(w)) {
      const length = Math.hypot(
        bridge.approachB.x - bridge.approachA.x,
        bridge.approachB.z - bridge.approachA.z,
      );
      const dx = (bridge.approachB.x - bridge.approachA.x) / length,
        dz = (bridge.approachB.z - bridge.approachA.z) / length;
      const along = (a.x - bridge.approachA.x) * dx + (a.z - bridge.approachA.z) * dz;
      const delta = (b.x - a.x) * dx + (b.z - a.z) * dz;
      if (Math.abs(delta) < 1e-9) continue;
      for (const edge of [0, length]) {
        const t = (edge - along) / delta;
        if (t <= 1e-8 || t >= 1 - 1e-8) continue;
        const side =
          (a.x + (b.x - a.x) * t - bridge.approachA.x) * dz -
          (a.z + (b.z - a.z) * t - bridge.approachA.z) * dx;
        if (Math.abs(side) <= bridge.width / 2) cuts.push(t);
      }
    }
    for (const t of [...new Set(cuts)].sort((a, b) => a - b))
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  if (path.length) result.push(path.at(-1)!);
  return result;
}
export function bridgeCoversRoad(w: World, a: Point, b: Point) {
  return publicBridges(w).some((bridge) => {
    const dx = bridge.approachB.x - bridge.approachA.x,
      dz = bridge.approachB.z - bridge.approachA.z,
      length = Math.hypot(dx, dz);
    return [a, b].every((p) => {
      const x = p.x - bridge.approachA.x,
        z = p.z - bridge.approachA.z;
      const along = (x * dx + z * dz) / length;
      return (
        along >= -1e-6 &&
        along <= length + 1e-6 &&
        Math.abs(x * dz - z * dx) / length <= bridge.width / 2
      );
    });
  });
}

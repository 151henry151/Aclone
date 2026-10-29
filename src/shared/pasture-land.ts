// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from './types';
export interface Pasture {
  x: number;
  z: number;
  parcels: number;
}
export const pastureAnimal = {
  dairy: 'cows',
  sheepfold: 'sheep',
  piggery: 'pigs',
  henhouse: 'chickens',
};
export const pastureSpecies = { dairy: 4, sheepfold: 6, piggery: 6, henhouse: 12 };
export const isLivestockFarm = (b: Pick<Building, 'kind'>) => Object.hasOwn(pastureSpecies, b.kind);
export const PASTURE_PARCEL = 16,
  MAX_PASTURE_PARCELS = 4;
/** Stored offset is local to the barn; adjoining parcels extend along its local X axis. */
export function pasturePoint(b: Pick<Building, 'x' | 'z' | 'rotation'>, x: number, z: number) {
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return { x: b.x + x * c + z * s, z: b.z - x * s + z * c };
}
export function inPasture(b: Building, x: number, z: number, padding = 0) {
  const p = b.pasture;
  if (!p || !isLivestockFarm(b)) return false;
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const lx = dx * c - dz * s - p.x,
    lz = dx * s + dz * c - p.z;
  return lx > -8 - padding && lx < p.parcels * 16 - 8 + padding && Math.abs(lz) < 8 + padding;
}
export function pastureCapacity(b: Building, multiplier = 1) {
  const per = pastureSpecies[b.kind as keyof typeof pastureSpecies] ?? 0;
  return Math.floor(per * (b.pasture?.parcels ?? 0) * multiplier);
}
export function pastureCost(b: Building, multiplier = 1) {
  return Math.round((15000 + (b.pasture?.parcels ?? 0) * 10000) * multiplier);
}

export interface PastureFence {
  id: string;
  kind: 'fence';
  height: number;
  width: number;
  points: { x: number; z: number }[];
  a: { x: number; z: number };
  b: { x: number; z: number };
}
const fenceCache = new WeakMap<Building, { key: string; segments: PastureFence[] }>();
/** Four-metre gate faces the barn side; short rails follow uneven ground. */
export function pastureFences(buildings: Building[]): PastureFence[] {
  const result: PastureFence[] = [];
  for (const b of buildings) {
    if (!b.pasture || !isLivestockFarm(b) || b.construction) continue;
    const p = b.pasture,
      key = `${b.x},${b.z},${b.rotation},${p.x},${p.z},${p.parcels}`;
    let cached = fenceCache.get(b);
    if (!cached || cached.key !== key) {
      const l = p.x - 8,
        r = p.x + p.parcels * 16 - 8,
        t = p.z - 8,
        d = p.z + 8;
      const edges = [
        [l, t, r, t],
        [r, t, r, d],
        [r, d, l, d],
        [l, d, l, p.z + 2],
        [l, p.z - 2, l, t],
      ];
      const segments: PastureFence[] = [];
      for (const [ax, az, bx, bz] of edges) {
        const count = Math.ceil(Math.hypot(bx - ax, bz - az) / 3);
        for (let i = 0; i < count; i++) {
          const a = pasturePoint(b, ax + ((bx - ax) * i) / count, az + ((bz - az) * i) / count);
          const end = pasturePoint(
            b,
            ax + ((bx - ax) * (i + 1)) / count,
            az + ((bz - az) * (i + 1)) / count,
          );
          segments.push({
            id: `pasture-${b.id}`,
            kind: 'fence',
            height: 1.2,
            width: 0.14,
            points: [a, end],
            a,
            b: end,
          });
        }
      }
      cached = { key, segments };
      fenceCache.set(b, cached);
    }
    result.push(...cached.segments);
  }
  return result;
}

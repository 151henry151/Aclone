// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Stock } from './types';
import type { EarthworkContract } from './earthworks-contracts';
export interface EarthworkJob {
  contract?: EarthworkContract;
  pendingApproval?: boolean;
  approvalOwners?: string[];
  approvedBy?: string[];
  cut: number;
  fill: number;
  volume: number;
  done: number;
  delivered: number;
  material: 'dirt' | 'gravel' | 'stone';
  effort: number;
  active: boolean;
  operators: string[];
  seconds: number;
  spoilProduced: number;
  spoil: Stock;
  published: number;
  weatherDays: number;
}

/** Pad lists and records are replaced, never mutated, when work advances. */
export interface Earthwork {
  id: string;
  owner: string;
  created: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  target: number;
  shoulder: number;
  shoulderGrade: number;
  progress: number;
  finish: 'bare' | 'gravel' | 'grass';
  work?: EarthworkJob;
  berm?: { x: number; z: number; radius: number; height: number };
}
type Entry = {
  pad: Earthwork;
  c: number;
  s: number;
  hx: number;
  hz: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  shoulderSquared: number;
};
// A technical acceleration cell, not a gameplay limit. Only local candidates are
// visited by terrainHeight. Weak keys let replaced snapshots release their grids.
const cellSize = 128;
type Index = {
  grid: Map<number, Map<number, Entry[]>>;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
const indexes = new WeakMap<Earthwork[], Index>();
let lastPads: Earthwork[] | undefined, lastIndex: Index | undefined;
export function earthworkBounds(p: Earthwork) {
  const c = Math.abs(Math.cos(p.rotation)),
    s = Math.abs(Math.sin(p.rotation));
  const x = (c * p.width) / 2 + (s * p.depth) / 2 + p.shoulder;
  const z = (s * p.width) / 2 + (c * p.depth) / 2 + p.shoulder;
  return { minX: p.x - x, maxX: p.x + x, minZ: p.z - z, maxZ: p.z + z };
}
function index(pads: Earthwork[]) {
  let cached = indexes.get(pads);
  if (!cached) {
    cached = { grid: new Map(), minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const pad of pads) {
      if (pad.progress <= 0) continue;
      const b = earthworkBounds(pad),
        entry = {
          pad,
          c: Math.cos(pad.rotation),
          s: Math.sin(pad.rotation),
          hx: pad.width / 2,
          hz: pad.depth / 2,
          ...b,
          shoulderSquared: pad.shoulder ** 2,
        };
      cached.minX = Math.min(cached.minX, b.minX);
      cached.maxX = Math.max(cached.maxX, b.maxX);
      cached.minZ = Math.min(cached.minZ, b.minZ);
      cached.maxZ = Math.max(cached.maxZ, b.maxZ);
      for (let x = Math.floor(b.minX / cellSize); x <= Math.floor(b.maxX / cellSize); x++) {
        let column = cached.grid.get(x);
        if (!column) cached.grid.set(x, (column = new Map()));
        for (let z = Math.floor(b.minZ / cellSize); z <= Math.floor(b.maxZ / cellSize); z++) {
          let bucket = column.get(z);
          if (!bucket) column.set(z, (bucket = []));
          bucket.push(entry);
        }
      }
    }
    indexes.set(pads, cached);
  }
  lastPads = pads;
  lastIndex = cached;
  return cached;
}
function weight(e: Entry, x: number, z: number) {
  if (x < e.minX || x > e.maxX || z < e.minZ || z > e.maxZ) return 0;
  const dx = x - e.pad.x,
    dz = z - e.pad.z;
  const a = Math.max(0, Math.abs(dx * e.c - dz * e.s) - e.hx);
  const b = Math.max(0, Math.abs(dx * e.s + dz * e.c) - e.hz);
  if (a === 0 && b === 0) return e.pad.progress;
  if (a >= e.pad.shoulder || b >= e.pad.shoulder) return 0;
  const squared = a * a + b * b;
  if (squared >= e.shoulderSquared) return 0;
  // Coordinates are bounded by the world; scaled hypot's overflow protection
  // is unnecessary here. Keep the same smooth circular corner profile.
  const t = Math.sqrt(squared) / e.pad.shoulder;
  return (1 - t * t * (3 - 2 * t)) * e.pad.progress;
}
/** Return either a completely replacing height or the local partial candidates.
 * This carries the lookup into terrain sampling without allocating a query object. */
export function earthworksTerrain(w: Pick<World, 'earthworks'>, x: number, z: number) {
  if (!w.earthworks?.length) return undefined;
  const cached = w.earthworks === lastPads ? lastIndex! : index(w.earthworks);
  if (x < cached.minX || x > cached.maxX || z < cached.minZ || z > cached.maxZ) return undefined;
  const bucket = cached.grid.get(Math.floor(x / cellSize))?.get(Math.floor(z / cellSize));
  if (bucket)
    for (let i = bucket.length - 1; i >= 0; i--) {
      const entry = bucket[i];
      if (entry.pad.progress === 1 && weight(entry, x, z) === 1)
        return blendEarthworks(bucket, x, z, entry.pad.target, i + 1);
    }
  return bucket;
}
export function blendEarthworks(
  bucket: readonly Entry[],
  x: number,
  z: number,
  height: number,
  first = 0,
) {
  for (let i = first; i < bucket.length; i++) {
    const entry = bucket[i];
    const amount = weight(entry, x, z);
    if (amount > 0) height += (entry.pad.target - height) * amount;
    const berm = entry.pad.berm;
    if (berm)
      height += berm.height * Math.max(0, 1 - Math.hypot(x - berm.x, z - berm.z) / berm.radius);
  }
  return height;
}
export function earthworksHeight(
  w: Pick<World, 'earthworks'>,
  x: number,
  z: number,
  height: number,
) {
  const local = earthworksTerrain(w, x, z);
  return typeof local === 'number' ? local : local ? blendEarthworks(local, x, z, height) : height;
}

export type EarthworkBounds = ReturnType<typeof earthworkBounds>;
/** Geometry and finish changes only; importing ownership/age does not rebuild terrain. */
export function changedEarthworkBounds(
  before: Earthwork[] | undefined,
  after: Earthwork[] | undefined,
) {
  if (before === after) return [];
  const old = new Map((before ?? []).map((p) => [p.id, p]));
  const changes: EarthworkBounds[] = [];
  const shape = (p: Earthwork) =>
    [
      p.x,
      p.z,
      p.width,
      p.depth,
      p.rotation,
      p.target,
      p.shoulder,
      p.progress,
      p.finish,
      p.berm?.x,
      p.berm?.z,
      p.berm?.radius,
      p.berm?.height,
    ].join(':');
  for (const p of after ?? []) {
    const previous = old.get(p.id);
    old.delete(p.id);
    if (previous && shape(previous) === shape(p)) continue;
    if (previous) changes.push(earthworkBounds(previous));
    changes.push(earthworkBounds(p));
  }
  for (const p of old.values()) changes.push(earthworkBounds(p));
  return changes;
}
export function earthworkIntersects(
  changes: readonly EarthworkBounds[],
  x: number,
  z: number,
  half: number,
) {
  return changes.some(
    (b) => x + half >= b.minX && x - half <= b.maxX && z + half >= b.minZ && z - half <= b.maxZ,
  );
}

/** Rendering depends on published geometry, never mutable inventories/work clocks. */
export function earthworkTerrainSnapshot(pads: Earthwork[] | undefined) {
  return pads?.map(({ work, ...shape }) => shape);
}

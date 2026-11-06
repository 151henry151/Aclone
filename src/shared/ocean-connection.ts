// SPDX-License-Identifier: GPL-3.0-or-later
import { terrainHeight, mapHalf } from './terrain';
import { inlandWaterAt } from './inland-water';
import { lowWater } from './ocean';
import type { World } from './types';
// Geometry sampling and bounded search work, not gameplay distances. A positive
// result has a sampled wet path all the way to the map boundary; an enclosed
// edited depression cannot pass merely because it lies below sea level.
const STEP = 4,
  MAX_VISITED = 8192;
const caches = new WeakMap<
  World['terrain'],
  {
    key: string;
    landscape: World['landscape'];
    island: World['northernIsland'];
    cells: Map<string, boolean>;
  }
>();
export function oceanConnected(w: World, p: { x: number; z: number }) {
  const sea = lowWater(w),
    half = mapHalf(w),
    key = [w.id, w.revision, w.terrain.length, sea, half, w.terrainMapSize, w.townLayout].join(':');
  let cache = caches.get(w.terrain);
  if (
    !cache ||
    cache.key !== key ||
    cache.landscape !== w.landscape ||
    cache.island !== w.northernIsland
  ) {
    cache = { key, landscape: w.landscape, island: w.northernIsland, cells: new Map() };
    caches.set(w.terrain, cache);
  }
  const wet = (x: number, z: number) => terrainHeight(w, x, z) < sea && !inlandWaterAt(w, x, z);
  if (!wet(p.x, p.z)) return false;
  const line = (ax: number, az: number, bx: number, bz: number) => {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (STEP / 2));
    for (let i = 1; i <= n; i++)
      if (!wet(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return false;
    return true;
  };
  const escape = (x: number, z: number) => {
    const targets = [
      { x: half, z },
      { x: -half, z },
      { x, z: half },
      { x, z: -half },
      { x: half, z: half },
      { x: -half, z: half },
      { x: half, z: -half },
      { x: -half, z: -half },
    ];
    targets.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    return targets.some((q) => line(x, z, q.x, q.z));
  };
  const queue: { x: number; z: number }[] = [],
    seen = new Set<string>();
  for (const ix of [Math.floor(p.x / STEP), Math.ceil(p.x / STEP)])
    for (const iz of [Math.floor(p.z / STEP), Math.ceil(p.z / STEP)]) {
      const x = ix * STEP,
        z = iz * STEP,
        k = `${ix}:${iz}`;
      if (seen.has(k) || !wet(x, z) || !line(p.x, p.z, x, z)) continue;
      const known = cache.cells.get(k);
      if (known !== undefined) return known;
      seen.add(k);
      queue.push({ x, z });
    }
  if (!queue.length) return escape(p.x, p.z);
  let connected = false,
    cursor = 0;
  while (cursor < queue.length && cursor < MAX_VISITED) {
    const q = queue[cursor++],
      k = `${q.x / STEP}:${q.z / STEP}`;
    const known = cache.cells.get(k);
    if (
      known === true ||
      Math.abs(q.x) >= half ||
      Math.abs(q.z) >= half ||
      (cursor % 128 === 1 && escape(q.x, q.z))
    ) {
      connected = true;
      break;
    }
    if (known === false) continue;
    for (const [dx, dz] of [
      [STEP, 0],
      [-STEP, 0],
      [0, STEP],
      [0, -STEP],
    ]) {
      const x = q.x + dx,
        z = q.z + dz,
        next = `${x / STEP}:${z / STEP}`;
      if (seen.has(next) || !wet(x, z) || !line(q.x, q.z, x, z)) continue;
      seen.add(next);
      queue.push({ x, z });
    }
  }
  // Bounded/inconclusive searches refuse construction; cache negatives only for
  // fully explored components. Do not poison an open inlet beyond the work cap.
  if (connected || cursor === queue.length) {
    if (cache.cells.size + queue.length > 65536) cache.cells.clear();
    for (const q of queue) cache.cells.set(`${q.x / STEP}:${q.z / STEP}`, connected);
  }
  return connected;
}

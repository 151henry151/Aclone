import { creatorBlocks } from '../../shared/creator.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Input } from '../../shared/types.ts';
import { terrainHeight, distance } from '../../shared/simulation.ts';
import { blocksBuilding, buildingBounds, buildingPlan } from '../../shared/building-shapes.ts';
import type { Point } from '../../shared/town.ts';
import { mapHalf, legacyHalf } from '../../shared/terrain.ts';
const step = 4;
/** The compact village grid; large maps use a window around each journey instead. */
const villageWindow = { originX: -248, originZ: -248, sizeX: 125, sizeZ: 125 };
/** Longest side of a journey window, in cells: about 1.6 km of countryside. */
const maxCells = 400;
interface Window {
  originX: number;
  originZ: number;
  sizeX: number;
  sizeZ: number;
}
interface Grid extends Window {
  key: string;
  clear: Uint8Array;
  heights: Float32Array;
}
const point = (g: Window, i: number): Point => ({
  x: g.originX + (i % g.sizeX) * step,
  z: g.originZ + Math.floor(i / g.sizeX) * step,
});
const index = (g: Window, p: Point) =>
  Math.max(0, Math.min(g.sizeZ - 1, Math.round((p.z - g.originZ) / step))) * g.sizeX +
  Math.max(0, Math.min(g.sizeX - 1, Math.round((p.x - g.originX) / step)));
/** Compact maps keep the whole-village grid. On large maps the window spans the
 * journey with room to detour, and takes in the village whenever it touches it. */
function windowFor(w: World, from: Point, target: Point): Window {
  const half = mapHalf(w);
  if (half <= legacyHalf) return villageWindow;
  const margin = 120;
  let minX = Math.min(from.x, target.x) - margin,
    maxX = Math.max(from.x, target.x) + margin,
    minZ = Math.min(from.z, target.z) - margin,
    maxZ = Math.max(from.z, target.z) + margin;
  if (minX < legacyHalf && maxX > -legacyHalf && minZ < legacyHalf && maxZ > -legacyHalf) {
    minX = Math.min(minX, -248);
    maxX = Math.max(maxX, 248);
    minZ = Math.min(minZ, -248);
    maxZ = Math.max(maxZ, 248);
  }
  const bound = half - 2;
  minX = Math.max(-bound, minX);
  minZ = Math.max(-bound, minZ);
  maxX = Math.min(bound, maxX);
  maxZ = Math.min(bound, maxZ);
  const originX = Math.floor(minX / step) * step,
    originZ = Math.floor(minZ / step) * step,
    sizeX = Math.ceil((maxX - originX) / step) + 1,
    sizeZ = Math.ceil((maxZ - originZ) / step) + 1;
  if (sizeX > maxCells || sizeZ > maxCells)
    throw Error('Destination too far for a ground route; break the journey into stages');
  return { originX, originZ, sizeX, sizeZ };
}
const cache = new WeakMap<World, Map<string, Grid>>();
function grid(w: World, win: Window): Grid {
  const key = JSON.stringify([
    win,
    w.settings.seaLevel,
    w.townLayout,
    w.terrain,
    w.landscape,
    w.creator?.objects,
    w.creator?.models.map((m) => [m.id, m.width, m.height, m.depth]),
    w.buildings.map((b) => [b.id, b.kind, b.style, b.x, b.z, b.rotation]),
  ]);
  let grids = cache.get(w);
  if (!grids) cache.set(w, (grids = new Map()));
  const previous = grids.get(key);
  if (previous) return previous;
  const { originX, originZ, sizeX, sizeZ } = win;
  const clear = new Uint8Array(sizeX * sizeZ),
    heights = new Float32Array(sizeX * sizeZ);
  for (let i = 0; i < clear.length; i++) {
    const p = point(win, i),
      h = terrainHeight(w, p.x, p.z);
    heights[i] = h;
    clear[i] = +(h >= w.settings.seaLevel + 0.05 && !creatorBlocks(w, p.x, p.z, h, 2.2));
  }
  // Rasterize only a building's conservative bounding square, then use the
  // same exact rotated-volume collision test. Avoid cells × every building.
  for (const b of w.buildings) {
    const bounds = buildingBounds(buildingPlan(b));
    const radius = Math.hypot(
      Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + 2.2,
      Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) + 2.2,
    );
    const minX = Math.max(0, Math.ceil((b.x - radius - originX) / step));
    const maxX = Math.min(sizeX - 1, Math.floor((b.x + radius - originX) / step));
    const minZ = Math.max(0, Math.ceil((b.z - radius - originZ) / step));
    const maxZ = Math.min(sizeZ - 1, Math.floor((b.z + radius - originZ) / step));
    for (let z = minZ; z <= maxZ; z++)
      for (let x = minX; x <= maxX; x++) {
        const i = z * sizeX + x;
        if (clear[i] && blocksBuilding(b, originX + x * step, originZ + z * step, 0, 2.2))
          clear[i] = 0;
      }
  }
  const value = { ...win, key, clear, heights };
  // A handful of recent windows per world: residents mostly repeat the same trips.
  if (grids.size >= 6) grids.delete(grids.keys().next().value!);
  grids.set(key, value);
  return value;
}
class Queue {
  a: { id: number; score: number }[] = [];
  push(id: number, score: number) {
    const n = { id, score };
    let i = this.a.length;
    this.a.push(n);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].score <= score) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = n;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop()!;
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1].score < this.a[c].score) c++;
        if (this.a[c].score >= last.score) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return first;
  }
}
function route(w: World, from: Point, target: Point, radius: number) {
  const g = grid(w, windowFor(w, from, target)),
    { clear, heights, sizeX, sizeZ } = g,
    size = sizeX,
    start = index(g, from),
    queue = new Queue(),
    cost = new Float64Array(clear.length).fill(Infinity),
    parent = new Int32Array(clear.length).fill(-1),
    closed = new Uint8Array(clear.length);
  cost[start] = 0;
  queue.push(start, 0);
  while (queue.a.length) {
    const i = queue.pop().id;
    if (closed[i]) continue;
    closed[i] = 1;
    if (clear[i] && distance(point(g, i), target) <= radius) {
      const path: Point[] = [];
      let at = i;
      while (at !== start) {
        path.push(point(g, at));
        at = parent[at];
      }
      return path.reverse();
    }
    const x = i % size,
      z = Math.floor(i / size);
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        j = nz * size + nx;
      if (
        nx < 0 ||
        nz < 0 ||
        nx >= sizeX ||
        nz >= sizeZ ||
        !clear[j] ||
        closed[j] ||
        Math.abs(heights[i] - heights[j]) > 2
      )
        continue;
      if (dx && dz && (!clear[z * size + nx] || !clear[nz * size + x])) continue;
      const value = cost[i] + Math.hypot(dx, dz);
      if (value >= cost[j]) continue;
      parent[j] = i;
      cost[j] = value;
      queue.push(j, value + Math.max(0, distance(point(g, j), target) - radius) / step);
    }
  }
  throw Error('No safe ground route to that destination');
}
const idle: Input = { throttle: 0, steer: 0, boost: false };
/** Only steering/throttle: the shared move() remains authoritative for collision,
 * fuel, snow/rain grip, speed and heading. No teleport or strategy decisions. */
export class Navigator {
  private path: Point[];
  private next = 0;
  private elapsed = 0;
  private stuck = 0;
  private last: Point;
  private sample = 0;
  constructor(
    w: World,
    p: Player,
    readonly target: Point,
    readonly radius: number,
  ) {
    // A service visit is already complete inside its range. Requiring a clear
    // grid endpoint here can fail beside an inflated building obstacle.
    this.path = distance(p, target) <= radius ? [] : route(w, p, target, radius);
    this.last = { x: p.x, z: p.z };
  }
  waypoints(): readonly Point[] {
    return this.path;
  }
  step(w: World, p: Player, dt: number): { input: Input; arrived?: boolean; error?: string } {
    if (p.atHome || p.task) return { input: idle, error: 'Cannot travel while indoors or busy' };
    this.elapsed += dt;
    this.sample += dt;
    if (this.elapsed > 240)
      return { input: idle, error: 'Journey timed out; choose a different approach' };
    if (distance(p, this.target) <= this.radius + 0.5 && this.next >= this.path.length - 1) {
      return {
        input: {
          ...idle,
          throttle:
            Math.abs(p.speed) > 0.15 ? -Math.sign(p.speed) * Math.min(1, Math.abs(p.speed)) : 0,
        },
        arrived: Math.abs(p.speed) < 0.2,
      };
    }
    if (p.vehicle !== 0 && p.vehicle !== 5)
      return { input: idle, error: 'Ground navigation requires tractor or walking' };
    if (p.vehicle === 0 && (!p.engine || p.fuel <= 0))
      return { input: idle, error: 'Start the engine and refuel before driving' };
    if (this.sample >= 2) {
      this.stuck = distance(this.last, p) < 0.6 ? this.stuck + this.sample : 0;
      this.sample = 0;
      this.last = { x: p.x, z: p.z };
    }
    if (this.stuck > 8) return { input: idle, error: 'Route obstructed; stopped safely' };
    if (this.stuck >= 2) return { input: { throttle: -0.35, steer: 0.5, boost: false } };
    while (this.next < this.path.length - 1 && distance(p, this.path[this.next]) < 3) this.next++;
    const waypoint = this.path[this.next] ?? this.target;
    const angle = Math.atan2(waypoint.x - p.x, waypoint.z - p.z) - p.heading;
    const error = Math.atan2(Math.sin(angle), Math.cos(angle));
    const speed =
      Math.abs(error) > 1
        ? 1.2
        : Math.abs(error) > 0.4
          ? 2.5
          : Math.min(6, Math.max(1, distance(p, waypoint)));
    return {
      input: {
        throttle: Math.max(-0.8, Math.min(1, (speed - p.speed) * 0.7)),
        steer: Math.max(-1, Math.min(1, error * 1.8)),
        boost: false,
      },
    };
  }
}

/** Fit large service footprints while staying strictly inside the player's 18m interaction range. */
export const serviceRadius = 16;

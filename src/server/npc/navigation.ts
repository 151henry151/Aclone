// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Input } from '../../shared/types.ts';
import { terrainHeight, distance } from '../../shared/simulation.ts';
import { blocksBuilding, buildingBounds, buildingPlan } from '../../shared/building-shapes.ts';
import type { Point } from '../../shared/town.ts';
const step = 4,
  size = 125,
  origin = -248;
const point = (i: number): Point => ({
  x: origin + (i % size) * step,
  z: origin + Math.floor(i / size) * step,
});
const index = (p: Point) =>
  Math.max(0, Math.min(size - 1, Math.round((p.z - origin) / step))) * size +
  Math.max(0, Math.min(size - 1, Math.round((p.x - origin) / step)));
const cache = new WeakMap<World, { key: string; clear: Uint8Array; heights: Float32Array }>();
function grid(w: World) {
  const key = JSON.stringify([
    w.settings.seaLevel,
    w.townLayout,
    w.terrain,
    w.buildings.map((b) => [b.id, b.kind, b.style, b.x, b.z, b.rotation]),
  ]);
  const previous = cache.get(w);
  if (previous?.key === key) return previous;
  const clear = new Uint8Array(size * size),
    heights = new Float32Array(size * size);
  for (let i = 0; i < clear.length; i++) {
    const p = point(i),
      h = terrainHeight(w, p.x, p.z);
    heights[i] = h;
    clear[i] = +(h >= w.settings.seaLevel + 0.05);
  }
  // Rasterize only a building's conservative bounding square, then use the
  // same exact rotated-volume collision test. Avoid cells × every building.
  for (const b of w.buildings) {
    const bounds = buildingBounds(buildingPlan(b));
    const radius = Math.hypot(
      Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + 2.2,
      Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)) + 2.2,
    );
    const minX = Math.max(0, Math.ceil((b.x - radius - origin) / step));
    const maxX = Math.min(size - 1, Math.floor((b.x + radius - origin) / step));
    const minZ = Math.max(0, Math.ceil((b.z - radius - origin) / step));
    const maxZ = Math.min(size - 1, Math.floor((b.z + radius - origin) / step));
    for (let z = minZ; z <= maxZ; z++)
      for (let x = minX; x <= maxX; x++) {
        const i = z * size + x;
        if (clear[i] && blocksBuilding(b, origin + x * step, origin + z * step, 0, 2.2))
          clear[i] = 0;
      }
  }
  const value = { key, clear, heights };
  cache.set(w, value);
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
  const { clear, heights } = grid(w),
    start = index(from),
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
    if (clear[i] && distance(point(i), target) <= radius) {
      const path: Point[] = [];
      let at = i;
      while (at !== start) {
        path.push(point(at));
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
        nx >= size ||
        nz >= size ||
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
      queue.push(j, value + Math.max(0, distance(point(j), target) - radius) / step);
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
  step(w: World, p: Player, dt: number): { input: Input; arrived?: boolean; error?: string } {
    if (p.atHome || p.task) return { input: idle, error: 'Cannot travel while indoors or busy' };
    this.elapsed += dt;
    this.sample += dt;
    if (this.elapsed > 240)
      return { input: idle, error: 'Journey timed out; choose a different approach' };
    if (distance(p, this.target) <= this.radius + 1 && this.next >= this.path.length - 1) {
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

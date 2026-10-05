import { landscapeRoads } from './landscape.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { blocksBuilding } from './building-shapes.ts';

export interface Point {
  x: number;
  z: number;
}
export interface Road {
  a: Point;
  b: Point;
  width: number;
}
const lots: [string, number, number][] = [
  ['market', -22, -16],
  ['workhouse', 0, -28],
  ['school', 22, -18],
  ['pub', 30, 8],
  ['garage', -30, 8],
  ['home', -24, 34],
  ['mill', 24, 35],
  ['farm', 40, 70],
  ['bakery', 0, 48],
  ['sawmill', -45, 60],
  ['quarry', -65, 85],
  ['starport', 8, -65],
  ['bank', -22, -42],
  ['town', 0, 0],
  ['forge', 50, -40],
];
export const legacyTown = lots.map(([kind, x, z]) => ({ kind, x, z }));
const positions = [
  [-65, -55],
  [-8, -110],
  [68, -82],
  [105, -6],
  [-118, -5],
  [-78, 108],
  [45, 105],
  [140, 110],
  [-5, 60],
  [-150, 30],
  [-220, 75],
  [18, -220],
  [-83, -155],
  [0, 0],
  [200, -110],
];
export const expandedTown = legacyTown.map((b, i) => ({
  ...b,
  x: positions[i][0],
  z: positions[i][1],
}));

/** A stable parish plan, not a new random layout on every connection. Units remain metres. */
const lanes: number[][][] = [
  [
    [18, -207],
    [24, -185],
    [18, -155],
    [12, -125],
    [15, -102],
    [-8, -97],
    [5, -75],
    [-8, -44],
    [-13, -10],
    [-16, 3],
    [0, 17],
    [-12, 39],
    [-26, 52],
    [-23, 73],
    [-5, 73],
    [16, 91],
    [45, 118],
    [88, 127],
    [119, 119],
    [140, 123],
  ],
  [
    [18, -155],
    [-20, -164],
    [-53, -147],
    [-83, -142],
  ],
  [
    [5, -75],
    [35, -60],
    [68, -69],
    [95, -52],
    [140, -50],
    [178, -75],
    [200, -97],
  ],
  [
    [-8, -44],
    [-36, -36],
    [-65, -42],
    [-99, -20],
    [-98, 10],
    [-118, 8],
  ],
  [
    [-118, 8],
    [-142, 10],
    [-166, 23],
    [-166, 43],
    [-150, 43],
    [-176, 60],
    [-199, 61],
    [-205, 86],
    [-220, 88],
  ],
  [
    [-12, 39],
    [-38, 85],
    [-57, 93],
    [-57, 120],
    [-78, 121],
    [-109, 115],
    [-142, 73],
    [-150, 43],
  ],
  [
    [0, 17],
    [23, 7],
    [49, -2],
    [77, 4],
    [105, 7],
    [126, -12],
    [140, -50],
  ],
  [
    [-118, 8],
    [-107, 33],
    [-87, 46],
    [-58, 48],
    [-12, 39],
  ],
];
const expandedRoads: Road[] = lanes.flatMap((lane, k) =>
  lane.slice(1).flatMap((end, i) => {
    const start = lane[i],
      dx = end[0] - start[0],
      dz = end[1] - start[1],
      length = Math.hypot(dx, dz);
    const points = Array.from({ length: 5 }, (_, j) => {
      const t = j / 4,
        bend = Math.sin(Math.PI * t) * (k % 2 ? -1 : 1) * Math.min(3, length * 0.08);
      return {
        x: start[0] + dx * t - (dz / length) * bend,
        z: start[1] + dz * t + (dx / length) * bend,
      };
    });
    return points.slice(1).map((b, j) => ({ a: points[j], b, width: k === 0 ? 8 : 6 }));
  }),
);
const legacyRoads: Road[] = [
  [0, 30, 12, 175],
  [0, 10, 120, 11],
  [0, -36, 80, 9],
  [-40, 60, 75, 8],
  [35, 50, 9, 90],
  [52, 45, 82, 7],
].map(([x, z, w, d]) =>
  w > d
    ? { a: { x: x - w / 2, z }, b: { x: x + w / 2, z }, width: d }
    : { a: { x, z: z - d / 2 }, b: { x, z: z + d / 2 }, width: w },
);
export function townRoads(
  w: Pick<World, 'townLayout' | 'creator' | 'landscape' | 'settings' | 'roads'>,
): readonly Road[] {
  return [
    ...(w.creator?.roads === false ? [] : w.townLayout === 2 ? expandedRoads : legacyRoads),
    ...landscapeRoads(w),
    ...(w.roads ?? []),
  ];
}
export function roadDistance(roads: readonly Road[], x: number, z: number) {
  let closest = Infinity;
  for (const { a, b, width } of roads) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    closest = Math.min(closest, Math.hypot(x - a.x - dx * t, z - a.z - dz * t) - width / 2);
  }
  return closest;
}
/** Upgrade only untouched starter positions. Never reset a property or overwrite a custom plot. */
export function migrateTown(w: World) {
  if (w.townLayout) return;
  const moves = w.buildings.flatMap((b) => {
    const i = legacyTown.findIndex(
      (old, i) =>
        b.id === 'b' + i &&
        b.kind === old.kind &&
        b.x === old.x &&
        b.z === old.z &&
        b.rotation === 0,
    );
    return i >= 0 ? [{ b, old: legacyTown[i], next: expandedTown[i] }] : [];
  });
  // Reject destinations occupied by existing lots, including a starter that must stay put.
  let selected = moves.filter((m) => m.old.x !== m.next.x || m.old.z !== m.next.z);
  for (let pass = 0; pass < moves.length; pass++) {
    const remaining = selected.filter((m) =>
      w.buildings.every(
        (b) =>
          b === m.b ||
          selected.some((n) => n.b === b) ||
          Math.hypot(b.x - m.next.x, b.z - m.next.z) > 26,
      ),
    );
    if (remaining.length === selected.length) break;
    selected = remaining;
  }
  for (const p of Object.values(w.players)) {
    if (p.game || p.race || p.crowBody || p.hitch || p.y > 3) continue;
    const nearest = selected
      .filter((m) => (p.atHome ? p.home === m.b.id : Math.hypot(p.x - m.old.x, p.z - m.old.z) < 18))
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.old.x, p.z - a.old.z) - Math.hypot(p.x - b.old.x, p.z - b.old.z),
      )[0];
    if (nearest) {
      p.x += nearest.next.x - nearest.old.x;
      p.z += nearest.next.z - nearest.old.z;
      p.speed = 0;
    }
  }
  for (const { b, next } of selected) {
    b.x = next.x;
    b.z = next.z;
  }
  // A pilot may have parked on a formerly empty destination. Keep them outside
  // the relocated walls rather than relying on collision recovery on login.
  for (const p of Object.values(w.players)) {
    if (p.atHome || p.game || p.race || p.crowBody || p.hitch || p.y > 3) continue;
    const blocking = selected.find(({ b }) => blocksBuilding(b, p.x, p.z, 0, 1.5));
    if (!blocking) continue;
    const b = blocking.b;
    let exit: Point | undefined;
    for (let radius = 14; radius <= 38 && !exit; radius += 4)
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI) / 8;
        const q = { x: b.x + Math.sin(angle) * radius, z: b.z + Math.cos(angle) * radius };
        if (Math.abs(q.x) > 235 || q.z < -235 || q.z > 135) continue;
        if (w.buildings.every((other) => !blocksBuilding(other, q.x, q.z, 0, 1.5))) {
          exit = q;
          break;
        }
      }
    if (exit) {
      p.x = exit.x;
      p.z = exit.z;
      p.y = 0.15;
      p.speed = 0;
    }
  }
  w.townLayout = 2;
  w.revision++;
}

/** Evenly spaced along lanes, with a bounded number of visible lamp meshes. */
export function streetLights(w: World): Point[] {
  const lights: Point[] = [];
  let travelled = 0,
    next = 12;
  for (const { a, b, width } of townRoads(w)) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz);
    while (next <= travelled + length) {
      const t = (next - travelled) / length,
        side = lights.length % 2 ? -1 : 1;
      const p = {
        x: a.x + dx * t - (dz / length) * (width / 2 + 2) * side,
        z: a.z + dz * t + (dx / length) * (width / 2 + 2) * side,
      };
      if (
        lights.length < 96 &&
        lights.every((q) => Math.hypot(q.x - p.x, q.z - p.z) > 10) &&
        w.buildings.every((b) => Math.hypot(b.x - p.x, b.z - p.z) > 11)
      )
        lights.push(p);
      next += 24;
    }
    travelled += length;
  }
  return lights;
}

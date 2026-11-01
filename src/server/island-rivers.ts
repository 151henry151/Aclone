// SPDX-License-Identifier: GPL-3.0-or-later
import { northernHeight, type NorthernIsland, type IslandRiver } from '../shared/northern-island';
import { smoothstep } from '../shared/noise';
const round = (v: number) => Math.round(v * 100) / 100;

/** Survey a drainage corridor before carving it. Dynamic programming finds the
 * least uphill route through successive contour bands, rather than drawing a
 * sine wave through ridges. Outward progress guarantees a connected, loop-free
 * watershed and keeps these five catchments separate from the southern towns. */
export function islandRivers(n: NorthernIsland, sea: number): IslandRiver[] {
  return [-2.7, -1.45, -0.15, 0.68, 2.4].map((angle, index) => {
    const bands = Math.ceil((n.radius * 1.1 - 1800) / 125),
      lanes = 41;
    const rows: { x: number; z: number; h: number; cost: number; parent: number }[][] = [];
    for (let i = 0; i <= bands; i++) {
      const t = i / bands,
        r = 1800 + (n.radius * 1.1 - 1800) * t;
      const row = [];
      for (let j = 0; j < lanes; j++) {
        const lateral = (j - 20) * 100;
        const x = n.mountain.x + Math.cos(angle) * r - Math.sin(angle) * lateral;
        const z = n.mountain.z + Math.sin(angle) * r + Math.cos(angle) * lateral;
        const h = northernHeight(n, x, z, sea);
        let cost = i ? Infinity : j === 20 ? 0 : Infinity,
          parent = -1;
        if (i)
          for (let k = Math.max(0, j - 3); k <= Math.min(lanes - 1, j + 3); k++) {
            const prev = rows[i - 1][k];
            const distance = Math.hypot(x - prev.x, z - prev.z);
            const grade = Math.abs(h - prev.h) / distance;
            // Broad floodplain bends become cheaper on level ground. The valley
            // cost dominates this gentle guidance wherever a ridge blocks a bend.
            const bend =
              (Math.sin(r / 210 + index) * 240 + Math.sin(r / 630 + index * 2) * 350) *
              (1 - smoothstep(0.025, 0.15, grade)) *
              smoothstep(0, 0.2, t);
            const candidate =
              prev.cost +
              distance * 0.32 +
              Math.max(0, h - prev.h) * 72 +
              Math.max(0, h - sea) * 0.14 +
              (lateral - bend) ** 2 * 0.00045;
            if (candidate < cost) {
              cost = candidate;
              parent = k;
            }
          }
        row.push({ x, z, h, cost, parent });
      }
      rows.push(row);
    }
    let lane = rows[bands].reduce((best, p, j, row) => (p.cost < row[best].cost ? j : best), 0);
    const route = [];
    for (let i = bands; i >= 0; i--) {
      const p = rows[i][lane];
      route.push(p);
      lane = p.parent;
    }
    route.reverse();
    // Corner cutting twice keeps the surveyed valley route, removes grid angles,
    // and bounds the portable survey to fewer than 600 points per river.
    let curve = route.map(({ x, z }) => ({ x, z }));
    for (let pass = 0; pass < 2; pass++) {
      const next = [curve[0]];
      for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1],
          b = curve[i];
        next.push(
          { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 },
          { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 },
        );
      }
      next.push(curve.at(-1)!);
      curve = next;
    }
    const distances = [0];
    for (let i = 1; i < curve.length; i++)
      distances.push(
        distances[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].z - curve[i - 1].z),
      );
    const total = distances.at(-1)!;
    let prior = Infinity;
    const points = curve.map((p, i) => {
      const level = Math.max(sea, Math.min(northernHeight(n, p.x, p.z, sea) - 0.7, prior - 0.015));
      prior = level;
      return { ...p, level, width: 0, depth: 0 };
    });
    points.forEach((p, i) => {
      const a = Math.max(0, i - 2),
        b = Math.min(points.length - 1, i + 2);
      const slope = (points[a].level - points[b].level) / Math.max(1, distances[b] - distances[a]);
      const t = distances[i] / total;
      p.width = Math.max(
        3,
        (4.5 + 36 * t ** 1.35) *
          (1.12 - 0.5 * smoothstep(0.008, 0.1, slope)) *
          (1 + 0.15 * Math.sin(distances[i] / 145 + index) + 0.06 * Math.sin(distances[i] / 57)),
      );
      p.depth =
        (t < 0.24 ? 0.3 + t : 0.54 + 4.2 * ((t - 0.24) / 0.76) ** 0.7) *
        (0.83 + 0.17 * Math.cos(distances[i] / 83 + index));
      p.x = round(p.x);
      p.z = round(p.z);
      p.level = round(p.level);
      p.width = round(p.width);
      p.depth = round(p.depth);
    });
    return {
      id: `north-river-${index}`,
      name: ['Alder River', 'North Beck', 'Silverwater', 'River Bracken', 'Westmere River'][index],
      points,
    };
  });
}

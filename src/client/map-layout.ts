// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { worldResources } from '../shared/resources';
import { townRoads, type Point } from '../shared/town';
import { mapHalf, legacyHalf } from '../shared/terrain';

export interface MapBounds {
  x: number;
  z: number;
  width: number;
  depth: number;
}
/** On large maps the parish sheet covers the village and its surroundings; anything
 * further out belongs on a local sheet (see localBounds). Compact maps fit everything. */
export const parishReach = 600;
export const localReach = 320;
export function mapBounds(w: World, you: Point): MapBounds {
  const wide = mapHalf(w) > legacyHalf,
    near = (p: Point) => !wide || Math.max(Math.abs(p.x), Math.abs(p.z)) <= parishReach;
  const points = [
    ...w.buildings.filter(near),
    ...worldResources(w).filter((n) => Math.max(Math.abs(n.x), Math.abs(n.z)) <= 250),
    ...townRoads(w)
      .flatMap((r) => [r.a, r.b])
      .filter(near),
    ...(near(you) ? [you] : []),
  ];
  const xs = points.map((p) => p.x),
    zs = points.map((p) => p.z);
  const x = Math.min(-155, ...xs) - 40,
    z = Math.min(-120, ...zs) - 40;
  return { x, z, width: Math.max(155, ...xs) + 40 - x, depth: Math.max(170, ...zs) + 35 - z };
}
/** A sheet centred on a pilot out in the countryside. */
export function localBounds(you: Point, reach = localReach): MapBounds {
  return { x: you.x - reach, z: you.z - reach, width: reach * 2, depth: reach * 2 };
}
export function inBounds(b: MapBounds, p: Point, margin = 0) {
  return (
    p.x >= b.x - margin &&
    p.x <= b.x + b.width + margin &&
    p.z >= b.z - margin &&
    p.z <= b.z + b.depth + margin
  );
}
export interface MapLabel {
  id: string;
  x: number;
  y: number;
  width: number;
}
export interface LabelBox extends MapLabel {
  left: number;
  top: number;
  height: number;
}
/** Keep lettering a fixed readable size when zooming. Move crowded labels off
 * their sites, with leader lines supplied by the renderer. Stable input order
 * means labels don't jump as live player positions change. */
export function placeMapLabels(labels: MapLabel[], width: number, height: number): LabelBox[] {
  const placed: LabelBox[] = [];
  for (const label of labels) {
    const h = 24,
      candidates: LabelBox[] = [];
    for (let ring = 0; ring < 10; ring++) {
      const gap = 10 + ring * 28;
      for (const [left, top] of [
        [label.x + 10, label.y - 12 - ring * 28],
        [label.x + gap, label.y - 12],
        [label.x - label.width - gap, label.y - 12],
        [label.x - label.width - 10, label.y - 12 - ring * 28],
        [label.x - label.width / 2, label.y + gap],
        [label.x - label.width / 2, label.y - gap - h],
      ])
        candidates.push({
          ...label,
          left: Math.max(6, Math.min(width - label.width - 6, left)),
          top: Math.max(6, Math.min(height - h - 6, top)),
          height: h,
        });
    }
    const penalty = (b: LabelBox) => {
      const overlap = placed.reduce(
        (n, p) =>
          n +
          Math.max(
            0,
            Math.min(b.left + b.width + 3, p.left + p.width + 3) - Math.max(b.left, p.left),
          ) *
            Math.max(0, Math.min(b.top + h + 3, p.top + h + 3) - Math.max(b.top, p.top)),
        0,
      );
      const covered = labels.filter(
        (p) =>
          p.x > b.left - 5 && p.x < b.left + b.width + 5 && p.y > b.top - 5 && p.y < b.top + h + 5,
      ).length;
      return (
        overlap * 1000 +
        covered * 10000 +
        Math.hypot(b.left + b.width / 2 - b.x, b.top + h / 2 - b.y)
      );
    };
    const ranked = candidates.map((box) => ({ box, score: penalty(box) }));
    ranked.sort((a, b) => a.score - b.score);
    placed.push(ranked[0].box);
  }
  return placed;
}

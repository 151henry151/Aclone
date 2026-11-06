// SPDX-License-Identifier: GPL-3.0-or-later
import type { SceneryObstacle } from '../shared/scenery-obstacles';
import type { EvergreenSite } from './evergreen';
/** Cosmetics can vary with quality; trunk transforms always come from shared solids. */
export function sceneryInstances(objects: readonly SceneryObstacle[], low: boolean) {
  const trunks: number[][] = [],
    birches: number[][] = [],
    crowns: number[][] = [],
    rocks: number[][] = [],
    pines: EvergreenSite[] = [];
  const shades: { x: number; y: number; z: number; size: number; opacity: number }[] = [];
  for (const o of objects) {
    const { x, y, z, scale, rotation } = o;
    if (o.kind === 'boulder') {
      rocks.push([x, y, z, scale, rotation]);
      continue;
    }
    const pine = o.species === 'pine',
      birch = o.species === 'birch';
    if (pine)
      pines.push({ x, y, z, scale, rotation, variant: o.variant, width: 1, leanX: 0, leanZ: 0 });
    else {
      (birch ? birches : trunks).push([x, y, z, scale, rotation]);
      for (let k = 0; k < (low ? 7 : 13); k++) {
        const a = k * 2.399,
          r = k < 4 ? 0.7 : birch ? 1.4 : 2.4;
        const variation = (Math.sin(x * 13 + z * 7 + k * 9.3) + 1) / 2;
        crowns.push([
          x + Math.sin(a) * r * scale,
          y + (3.7 + variation * 2.5) * scale,
          z + Math.cos(a) * r * scale,
          (2.7 + variation * 1.3) * scale,
          a,
        ]);
      }
    }
    shades.push({ x, y: y + 0.1, z, size: (pine ? 8 : 12) * scale, opacity: pine ? 0.23 : 0.25 });
  }
  return { trunks, birches, crowns, rocks, pines, shades };
}

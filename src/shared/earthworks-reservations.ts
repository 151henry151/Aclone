// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Earthwork } from './earthworks-ground';
import { rectanglesOverlap, type GroundRect } from './vehicle-footprint';
export function earthworkFootprint(p: Earthwork): GroundRect {
  const c = Math.cos(p.rotation),
    s = Math.sin(p.rotation);
  return {
    x: p.x,
    z: p.z,
    hx: p.width / 2 + p.shoulder,
    hz: p.depth / 2 + p.shoulder,
    axes: [
      { x: c, z: -s },
      { x: s, z: c },
    ],
  };
}

export function earthworkReservedFootprint(w: Pick<World, 'earthworks'>, rect: GroundRect) {
  return (
    w.earthworks?.some(
      (p) =>
        p.progress < 1 &&
        p.work?.active !== false &&
        rectanglesOverlap(rect, earthworkFootprint(p)),
    ) ?? false
  );
}
export function earthworkReserved(w: Pick<World, 'earthworks'>, x: number, z: number, padding = 0) {
  return earthworkReservedFootprint(w, {
    x,
    z,
    hx: padding,
    hz: padding,
    axes: [
      { x: 1, z: 0 },
      { x: 0, z: 1 },
    ],
  });
}

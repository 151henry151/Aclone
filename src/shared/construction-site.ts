import { farmPlotPosition } from './farm-land';
import { onAirfield } from './airfield';
// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingPlan, type BuildingVolume } from './building-shapes';
import { mapHalf, terrainHeight } from './terrain';
import type { Building, World } from './types';
type Site = Pick<
  Building,
  | 'aircraftHangar'
  | 'id'
  | 'kind'
  | 'x'
  | 'z'
  | 'rotation'
  | 'architecture'
  | 'style'
  | 'size'
  | 'creatorBounds'
>;
function rectangles(b: Site) {
  const plan = buildingPlan(b);
  const volumes: BuildingVolume[] = [...plan.volumes, ...(plan.fixtures ?? [])];
  if (plan.apron)
    volumes.push({
      x: plan.apron.x,
      z: plan.apron.z,
      width: plan.apron.radius * 2,
      depth: plan.apron.radius * 2,
      eaves: 0,
      rise: 0,
      roof: 'flat',
    });
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return volumes.map((v) => ({
    x: b.x + v.x * c + v.z * s,
    z: b.z - v.x * s + v.z * c,
    hx: v.width / 2,
    hz: v.depth / 2,
    axes: [
      { x: c, z: -s },
      { x: s, z: c },
    ],
  }));
}
type Rect = ReturnType<typeof rectangles>[number];
const projectRadius = (a: Rect, axis: { x: number; z: number }) =>
  a.hx * Math.abs(a.axes[0].x * axis.x + a.axes[0].z * axis.z) +
  a.hz * Math.abs(a.axes[1].x * axis.x + a.axes[1].z * axis.z);
/** Sample every two metres, including each rotated corner and the doorway edge.
 * New buildings store this level; existing buildings retain their original datum. */
export function foundationProfile(w: World, b: Site) {
  const samples: number[] = [];
  for (const a of rectangles(b)) {
    const nx = Math.max(1, Math.ceil(a.hx)),
      nz = Math.max(1, Math.ceil(a.hz));
    for (let ix = 0; ix <= nx; ix++)
      for (let iz = 0; iz <= nz; iz++) {
        const dx = ((ix / nx) * 2 - 1) * a.hx,
          dz = ((iz / nz) * 2 - 1) * a.hz;
        samples.push(
          terrainHeight(
            w,
            a.x + dx * a.axes[0].x + dz * a.axes[1].x,
            a.z + dx * a.axes[0].z + dz * a.axes[1].z,
          ),
        );
      }
  }
  const low = Math.min(...samples),
    high = Math.max(...samples);
  return { low, high, level: high + 0.04, rise: high - low };
}
/** Oriented footprint test shared with the purchase preview. No payment occurs before it passes. */
export function constructionSiteReason(w: World, b: Site) {
  if (
    b.kind === 'farm' &&
    Array.from({ length: 4 }, (_, i) => farmPlotPosition(b, i)).some((p) =>
      onAirfield(w, p.x, p.z, 6),
    )
  )
    return 'Keep farm plots outside the airfield runway and apron';
  const foundation = foundationProfile(w, b);
  if (foundation.rise > 2)
    return 'Ground rises more than 2 metres across this footprint; choose a flatter site or smaller building';
  const rects = rectangles(b),
    edge = mapHalf(w);
  for (const a of rects) {
    if (onAirfield(w, a.x, a.z, Math.hypot(a.hx, a.hz)))
      return 'Keep the airfield runway and apron clear';
    for (const sx of [-1, 0, 1])
      for (const sz of [-1, 0, 1]) {
        const x = a.x + sx * a.hx * a.axes[0].x + sz * a.hz * a.axes[1].x;
        const z = a.z + sx * a.hx * a.axes[0].z + sz * a.hz * a.axes[1].z;
        if (Math.abs(x) > edge || Math.abs(z) > edge)
          return 'The building footprint would cross the world boundary';
        if (terrainHeight(w, x, z) < w.settings.seaLevel)
          return 'The building foundation must stay on dry land';
      }
    for (const zone of w.zones.filter((z) => z.kind === 'noBuild')) {
      const dx = zone.x - a.x,
        dz = zone.z - a.z;
      const x = Math.max(0, Math.abs(dx * a.axes[0].x + dz * a.axes[0].z) - a.hx);
      const z = Math.max(0, Math.abs(dx * a.axes[1].x + dz * a.axes[1].z) - a.hz);
      if (Math.hypot(x, z) < zone.radius) return 'Construction prohibited in this zone';
    }
    for (const other of w.buildings)
      for (const o of rectangles(other)) {
        const separated = [...a.axes, ...o.axes].some(
          (axis) =>
            Math.abs((a.x - o.x) * axis.x + (a.z - o.z) * axis.z) >
            projectRadius(a, axis) + projectRadius(o, axis) + 2,
        );
        if (!separated)
          return 'Too close to another building; leave room for the selected footprint';
      }
  }
  return undefined;
}

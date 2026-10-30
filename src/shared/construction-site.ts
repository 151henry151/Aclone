import { spaceportReserved } from './spaceport-site';
import { bluffLocal, bluffEdge, bluffPoint } from './coastal-bluffs';
import { highWater } from './ocean';
import { boathouseSite, dockObstruction, dockReserved } from './boathouse';
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
  if (rectangles(b).some((r) => spaceportReserved(w, r.x, r.z, Math.hypot(r.hx, r.hz))))
    return 'Keep buildings outside the spaceport launch reservation';
  if (b.kind === 'lighthouse' && !lighthouseCliffSite(w, b.x, b.z))
    return 'Lighthouses require a flat cliff-top site, 15–65 metres inland of a tall coastal cliff';
  if (b.kind === 'boathouse') {
    if (!boathouseSite(w, b, true))
      return 'Boathouses need dry shoreline ground, with a deep, clear berth behind the building; rotate the jetty toward the water';
    const blocked = dockObstruction(w, b);
    if (blocked) return blocked;
  }
  if (
    b.kind === 'farm' &&
    Array.from({ length: 4 }, (_, i) => farmPlotPosition(b, i)).some((p) =>
      onAirfield(w, p.x, p.z, 6),
    )
  )
    return 'Keep farm plots outside the airfield runway and apron';
  if (
    b.kind === 'farm' &&
    Array.from({ length: 4 }, (_, i) => farmPlotPosition(b, i)).some((p) =>
      spaceportReserved(w, p.x, p.z, 6),
    )
  )
    return 'Keep fields outside the spaceport launch reservation';
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
        if (terrainHeight(w, x, z) < highWater(w))
          return 'The building foundation must stay on dry land';
      }
    for (const zone of w.zones.filter((z) => z.kind === 'noBuild')) {
      const dx = zone.x - a.x,
        dz = zone.z - a.z;
      const x = Math.max(0, Math.abs(dx * a.axes[0].x + dz * a.axes[0].z) - a.hx);
      const z = Math.max(0, Math.abs(dx * a.axes[1].x + dz * a.axes[1].z) - a.hz);
      if (Math.hypot(x, z) < zone.radius) return 'Construction prohibited in this zone';
    }
    if (w.buildings.some((o) => dockReserved(o, a.x, a.z, Math.hypot(a.hx, a.hz))))
      return 'Keep the boathouse jetty and boat berth clear';
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

/** Keep the whole tower/keeper footprint safely back from a tall, sea-facing lip. */
export function lighthouseCliffSite(w: World, x: number, z: number) {
  return (w.coastalBluffs ?? []).some((b) => {
    const { u, v } = bluffLocal(b, x, z),
      setback = bluffEdge(b, u) - v;
    const foot = bluffPoint(b, u, bluffEdge(b, u) + 3);
    return (
      Math.abs(u) < b.width * 0.5 &&
      setback >= 15 &&
      setback <= 65 &&
      b.height >= 15 &&
      terrainHeight(w, x, z) > highWater(w) + 14 &&
      terrainHeight(w, foot.x, foot.z) < highWater(w)
    );
  });
}

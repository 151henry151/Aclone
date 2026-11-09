// SPDX-License-Identifier: GPL-3.0-or-later
import { flightRules } from './flight-rules';
import { earthworkFootprint } from './earthworks-reservations';
import type { World } from './types';
import { constructionRules } from './construction-rules';
import { type Earthwork, earthworkBounds, earthworksHeight } from './earthworks-ground';
import { mapHalf, terrainHeight } from './terrain';
import { rectanglesOverlap, type GroundRect } from './vehicle-footprint';
import { buildingPlan } from './building-shapes';
import { onFarmLand } from './farm-land';
import { worldResources } from './resources';
import { townRoads } from './town';
import { spawnReservations } from './spawn-reserve';
import { onAirfield } from './airfield';
import { spaceportReserved } from './spaceport-site';
import { nearBluff } from './coastal-bluffs';
import { nearInlandWater, inlandWaterAt } from './inland-water';
import { highWater } from './ocean';
import { bridgeReservedFootprint } from './bridge-geometry';
export function earthworkArea(p: Earthwork) {
  return (p.width + 2 * p.shoulder) * (p.depth + 2 * p.shoulder);
}
/** Limit a spoil mound by the slope already used by its shoulder. Only survey
 * edges touching this small mound need sampling, not the whole pad/world. */
export function earthworkBermHeight(w: World, p: Earthwork, berm: NonNullable<Earthwork['berm']>) {
  const rect = earthworkFootprint(p),
    nx = Math.ceil(rect.hx),
    nz = Math.ceil(rect.hz),
    sx = (2 * rect.hx) / nx,
    sz = (2 * rect.hz) / nz,
    dx = berm.x - p.x,
    dz = berm.z - p.z,
    bx = dx * rect.axes[0].x + dz * rect.axes[0].z,
    bz = dx * rect.axes[1].x + dz * rect.axes[1].z;
  const loX = Math.max(0, Math.floor((bx - berm.radius + rect.hx) / sx) - 1),
    hiX = Math.min(nx, Math.ceil((bx + berm.radius + rect.hx) / sx) + 1),
    loZ = Math.max(0, Math.floor((bz - berm.radius + rect.hz) / sz) - 1),
    hiZ = Math.min(nz, Math.ceil((bz + berm.radius + rect.hz) / sz) + 1);
  const base = { ...w, earthworks: w.earthworks?.filter((e) => e.id !== p.id) },
    finished = { earthworks: [{ ...p, progress: 1, berm: undefined }] },
    grade = p.shoulderGrade / 100,
    maxDepth = constructionRules(w.settings).earthworksMaximumDepth;
  let height = berm.height;
  type Sample = { level: number; weight: number };
  let previous: Sample[] = [];
  const limit = (a: Sample, b: Sample, span: number) => {
    const weight = a.weight - b.weight;
    if (Math.abs(weight) > 1e-12)
      height = Math.min(
        height,
        (grade * span - Math.sign(weight) * (a.level - b.level)) / Math.abs(weight),
      );
  };
  for (let ix = loX; ix <= hiX; ix++) {
    const row: Sample[] = [];
    for (let iz = loZ; iz <= hiZ; iz++) {
      const a = ix * sx - rect.hx,
        b = iz * sz - rect.hz,
        x = p.x + a * rect.axes[0].x + b * rect.axes[1].x,
        z = p.z + a * rect.axes[0].z + b * rect.axes[1].z,
        natural = terrainHeight(base, x, z),
        level = earthworksHeight(finished, x, z, natural),
        weight = Math.max(0, 1 - Math.hypot(x - berm.x, z - berm.z) / berm.radius),
        sample = { level, weight };
      if (weight > 0) height = Math.min(height, (maxDepth - (level - natural)) / weight);
      if (ix > loX) limit(sample, previous[iz - loZ], sx);
      if (iz > loZ) limit(sample, row[iz - loZ - 1], sz);
      row.push(sample);
    }
    previous = row;
  }
  return Math.max(0, height);
}
function circleOverlaps(a: GroundRect, b: { x: number; z: number; radius: number }) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const x = Math.max(0, Math.abs(dx * a.axes[0].x + dz * a.axes[0].z) - a.hx);
  const z = Math.max(0, Math.abs(dx * a.axes[1].x + dz * a.axes[1].z) - a.hz);
  return Math.hypot(x, z) <= b.radius;
}
/** Survey-time validation; never mutate terrain or charge the owner. Completed
 * portable pads may underlie later construction, but never water or protected geography. */
export function earthworkSiteReason(w: World, p: Earthwork, restoring = false): string | undefined {
  const r = constructionRules(w.settings);
  if (!restoring && !r.earthworksEnabled) return 'New earthworks are disabled in this world';
  for (const key of [
    'x',
    'z',
    'width',
    'depth',
    'rotation',
    'target',
    'shoulder',
    'shoulderGrade',
    'progress',
    'created',
  ] as const)
    if (!Number.isFinite(p[key])) return 'Earthwork geometry must contain finite numbers';
  if (
    !p.id ||
    !p.owner ||
    !['bare', 'gravel', 'grass'].includes(p.finish) ||
    p.progress < 0 ||
    p.progress > 1
  )
    return 'Invalid earthwork pad record';
  if (
    p.width < 1 ||
    p.depth < 1 ||
    p.width > r.earthworksMaximumSide ||
    p.depth > r.earthworksMaximumSide
  )
    return `Earthwork side size must be between 1 and ${r.earthworksMaximumSide} m`;
  if (
    p.shoulder <= 0 ||
    p.shoulder > r.earthworksMaximumShoulder ||
    p.shoulderGrade <= 0 ||
    p.shoulderGrade > r.earthworksMaximumGrade
  )
    return 'Earthwork shoulder width or grade exceeds the world limit';
  if (p.berm) {
    const b = p.berm,
      c = Math.cos(p.rotation),
      s = Math.sin(p.rotation),
      dx = b.x - p.x,
      dz = b.z - p.z,
      a = Math.abs(dx * c - dz * s),
      v = Math.abs(dx * s + dz * c);
    if (
      ![b.x, b.z, b.radius, b.height].every(Number.isFinite) ||
      b.radius <= 0 ||
      b.radius > r.earthworksBermRadius ||
      b.height < 0 ||
      b.height > Math.min(r.earthworksBermHeight, (p.shoulderGrade / 100) * b.radius) + 1e-8 ||
      a + b.radius > p.width / 2 + p.shoulder ||
      v + b.radius > p.depth / 2 + p.shoulder ||
      (a - b.radius < p.width / 2 && v - b.radius < p.depth / 2)
    )
      return 'Keep the spoil berm inside the shoulder, clear of the level pad and within its height limit';
  }
  const prior = w.earthworks?.filter((e) => e.id !== p.id) ?? [];
  if (prior.length >= r.earthworksMaximumCount) return 'Earthwork pad count limit reached';
  if (
    earthworkArea(p) + prior.reduce((sum, e) => sum + earthworkArea(e), 0) >
    r.earthworksMaximumArea
  )
    return 'Earthwork total area limit exceeded';
  const rect = earthworkFootprint(p),
    bounds = earthworkBounds(p),
    half = mapHalf(w);
  if (bounds.minX < -half || bounds.maxX > half || bounds.minZ < -half || bounds.maxZ > half)
    return 'Keep earthworks inside the world boundary';
  for (const other of prior)
    if (
      rectanglesOverlap(rect, earthworkFootprint(other)) &&
      (!other.work?.pendingApproval || other.owner === p.owner) &&
      (other.owner !== p.owner || other.progress < 1)
    )
      return 'That area is reserved by an unfinished or foreign earthwork pad';
  if (spawnReservations(w).some((b) => circleOverlaps(rect, b)))
    return 'Keep earthworks clear of arrival areas and town centres';
  if (w.zones.some((z) => z.kind === 'noBuild' && circleOverlaps(rect, z)))
    return 'Earthworks are prohibited in this no-build zone';
  const radius = Math.hypot(rect.hx, rect.hz);
  if (spaceportReserved(w, p.x, p.z, radius))
    return 'Keep earthworks outside the spaceport reservation';
  if (onAirfield(w, p.x, p.z, radius + flightRules(w.settings).runwayShoulder))
    return 'Keep earthworks clear of the airfield';
  if (nearBluff(w, p.x, p.z, radius)) return 'Keep earthworks clear of coastal bluffs';
  if (w.bridges?.some((b) => rectanglesOverlap(rect, bridgeReservedFootprint(b))))
    return 'Keep earthworks clear of bridges';
  if (
    worldResources(w).some((n) =>
      circleOverlaps(rect, { ...n, radius: r.earthworksResourceClearance }),
    )
  )
    return 'Keep earthworks clear of gathering grounds';
  if (!(restoring && p.progress === 1)) {
    if (onFarmLand(w, p.x, p.z, radius)) return 'Keep earthworks clear of fields and pastures';
    for (const b of w.buildings) {
      const plan = buildingPlan(b),
        c = Math.cos(b.rotation),
        s = Math.sin(b.rotation);
      const volumes = [...plan.volumes, ...(plan.fixtures ?? [])];
      if (plan.apron)
        volumes.push({
          ...plan.volumes[0],
          x: plan.apron.x,
          z: plan.apron.z,
          width: plan.apron.radius * 2,
          depth: plan.apron.radius * 2,
        });
      if (
        volumes.some((v) =>
          rectanglesOverlap(rect, {
            x: b.x + v.x * c + v.z * s,
            z: b.z - v.x * s + v.z * c,
            hx: v.width / 2,
            hz: v.depth / 2,
            axes: [
              { x: c, z: -s },
              { x: s, z: c },
            ],
          }),
        )
      )
        return 'Keep earthworks clear of buildings and their yards';
    }
    for (const road of townRoads(w)) {
      const dx = road.b.x - road.a.x,
        dz = road.b.z - road.a.z,
        len = Math.hypot(dx, dz);
      if (!len) continue;
      if (
        rectanglesOverlap(rect, {
          x: (road.a.x + road.b.x) / 2,
          z: (road.a.z + road.b.z) / 2,
          hx: road.width / 2,
          hz: len / 2,
          axes: [
            { x: dz / len, z: -dx / len },
            { x: dx / len, z: dz / len },
          ],
        })
      )
        return 'Keep earthwork shoulders clear of roads';
    }
  }
  const base = { ...w, earthworks: prior };
  const completed = { earthworks: [{ ...p, progress: 1 }] };
  const nx = Math.ceil(rect.hx),
    nz = Math.ceil(rect.hz);
  const heights: number[][] = [];
  for (let ix = 0; ix <= nx; ix++) {
    const row: number[] = [];
    heights.push(row);
    for (let iz = 0; iz <= nz; iz++) {
      const a = ((ix / nx) * 2 - 1) * rect.hx,
        b = ((iz / nz) * 2 - 1) * rect.hz;
      const x = p.x + a * rect.axes[0].x + b * rect.axes[1].x,
        z = p.z + a * rect.axes[0].z + b * rect.axes[1].z;
      const natural = terrainHeight(base, x, z);
      if (
        natural <= highWater(w) ||
        inlandWaterAt(w, x, z) ||
        nearInlandWater(w, x, z, r.earthworksBankClearance)
      )
        return 'Keep earthworks clear of water and inland banks';
      const height = earthworksHeight(completed, x, z, natural);
      if (height <= highWater(w)) return 'Earthwork cuts must remain above high water';
      row.push(height);
      if (Math.abs(height - natural) > r.earthworksMaximumDepth + 1e-8)
        return 'Earthwork cut or fill exceeds the maximum depth';
      // The rectangle interior is level. Compare the finished shoulder surface,
      // including the joins to natural ground, at the construction survey spacing.
      if (
        ix &&
        Math.abs(height - heights[ix - 1][iz]) / ((rect.hx * 2) / nx) > p.shoulderGrade / 100 + 1e-8
      )
        return 'Earthwork shoulder exceeds its maximum grade; use a wider shoulder';
      if (
        iz &&
        Math.abs(height - row[iz - 1]) / ((rect.hz * 2) / nz) > p.shoulderGrade / 100 + 1e-8
      )
        return 'Earthwork shoulder exceeds its maximum grade; use a wider shoulder';
    }
  }
  return undefined;
}

import { earthworkReserved } from './earthworks-reservations';
import { surveySlope, slopeAssessment, slopeBypass } from './construction-slope';
import { bridgeReserved } from './bridge-geometry';
import { constructionRules, constructionRuleFields } from './construction-rules';
import { inlandLevel } from './inland-water';
import { spawnReserved } from './spawn-reserve';
import { spaceportReserved } from './spaceport-site';
import { inPasture } from './pasture-land';
import { highWater } from './ocean';
import { dockReserved } from './boathouse';
import { onAirfield } from './airfield';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World, Player } from './types.ts';
import { terrainHeight, mapHalf } from './terrain.ts';
import { blocksBuilding } from './building-shapes.ts';
import { townRoads, roadDistance } from './town.ts';
/** Stored counts survive a lower current purchase limit. */
export function validFarmPlotCount(value: unknown): value is number {
  const spec = constructionRuleFields.maximumFarmPlots;
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= spec.min &&
    value <= spec.max &&
    value % spec.step === 0
  );
}
export function farmPlotCount(b: Pick<Building, 'farmPlots'>) {
  return validFarmPlotCount(b.farmPlots) ? b.farmPlots : 4;
}
/** Four plots per parcel, two rows. Existing four-plot farms keep their coordinates. */
export function farmPlotLocal(index: number) {
  return {
    x: 10 + (index % 2) * 8 + Math.floor(index / 4) * 16,
    z: 9 + (Math.floor(index / 2) % 2) * 8,
  };
}
export function farmPlotPosition(b: Pick<Building, 'x' | 'z' | 'rotation'>, index: number) {
  const p = farmPlotLocal(index),
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return { x: b.x + p.x * c + p.z * s, z: b.z - p.x * s + p.z * c };
}
export function farmExpansionCost(b: Building) {
  return 15000 + (farmPlotCount(b) / 4 - 1) * 10000;
}
/** Fields reserve farmland, but remain driveable. Padding is conservative for rotated lots. */
export function onFarmLand(
  w: World,
  x: number,
  z: number,
  padding = 0,
  except?: string,
  firstPlot = 0,
) {
  return w.buildings.some((b) => {
    if (b.id === except) return false;
    if (inPasture(b, x, z, padding)) return true;
    if (b.kind !== 'farm') return false;
    const dx = x - b.x,
      dz = z - b.z,
      c = Math.cos(b.rotation),
      s = Math.sin(b.rotation);
    const lx = dx * c - dz * s,
      lz = dx * s + dz * c;
    const count = farmPlotCount(b),
      first = Math.trunc(firstPlot) || 0,
      start = first < 0 ? Math.max(count + first, 0) : Math.min(first, count);
    // Query directly: scenery and navigation call this for many candidate points.
    for (let i = start; i < count; i++) {
      const p = farmPlotLocal(i);
      if (Math.abs(lx - p.x) < 4 + padding && Math.abs(lz - p.z) < 4 + padding) return true;
    }
    return false;
  });
}
export function farmPlotSlopeReason(
  w: World,
  b: Pick<Building, 'x' | 'z' | 'rotation'>,
  index: number,
) {
  const p = farmPlotPosition(b, index);
  const slope = slopeAssessment(w, [surveySlope(w, p.x, p.z, 8, 8, b.rotation)], 'field');
  return slope.reason ? `New fields: ${slope.reason}` : undefined;
}
export function farmExpansionBlocker(
  w: World,
  b: Building,
  actor?: Pick<Player, 'authority'>,
): string | undefined {
  const count = farmPlotCount(b);
  const limit = constructionRules(w.settings).maximumFarmPlots;
  if (count >= limit) return `This farm already has the maximum ${limit} plots`;
  const roads = townRoads(w);
  for (let i = count; i < count + 4; i++) {
    const p = farmPlotPosition(b, i);
    if (earthworkReserved(w, p.x, p.z, 6))
      return 'Complete the earthwork pad before claiming these fields';
    if (bridgeReserved(w, p.x, p.z, 6)) return 'Keep fields clear of the reserved bridge footprint';
    if (spawnReserved(w, p.x, p.z, 6))
      return 'Keep fields outside the town centre and respawn area';
    if (spaceportReserved(w, p.x, p.z, 6))
      return 'Keep fields outside the spaceport launch reservation';
    if (onAirfield(w, p.x, p.z, 6)) return 'Keep the airfield runway and apron clear';
    // Circumscribed clearance avoids missing a narrow road or small object between samples.
    if (roadDistance(roads, p.x, p.z) < 6) return 'A road crosses the new fields';
    if (
      onFarmLand(w, p.x, p.z, 6, b.id) ||
      w.buildings.some((v) => v.id !== b.id && blocksBuilding(v, p.x, p.z, 0, 6))
    )
      return 'Another property occupies the new fields';
    if (
      w.zones.some((v) => v.kind === 'noBuild' && Math.hypot(p.x - v.x, p.z - v.z) < v.radius + 6)
    )
      return 'New fields enter a no-build zone';
    if (w.creator?.objects.some((o) => o.solid && Math.hypot(p.x - o.x, p.z - o.z) < o.radius + 6))
      return 'An obstacle occupies the new fields';
    if (!slopeBypass(w, actor)) {
      const reason = farmPlotSlopeReason(w, b, i);
      if (reason) return reason;
    }
    // Check a conservative 10 m square including boundaries, not just the centre.
    for (const dx of [-5, 0, 5])
      for (const dz of [-5, 0, 5]) {
        const x = p.x + dx,
          z = p.z + dz;
        if (Math.max(Math.abs(x), Math.abs(z)) >= mapHalf(w))
          return 'New fields would leave the map';
        const height = terrainHeight(w, x, z);
        if (height <= inlandLevel(w, x, z, highWater(w)) + 0.1) return 'New fields need dry ground';
        if (roadDistance(roads, x, z) < 1) return 'A road crosses the new fields';
        if (w.zones.some((v) => v.kind === 'noBuild' && Math.hypot(x - v.x, z - v.z) < v.radius))
          return 'New fields enter a no-build zone';
        if (
          onFarmLand(w, x, z, 0, b.id) ||
          w.buildings.some(
            (v) => v.id !== b.id && (blocksBuilding(v, x, z, 0, 1) || dockReserved(v, x, z, 4)),
          )
        )
          return 'Another property occupies the new fields';
        if (w.creator?.objects.some((o) => o.solid && Math.hypot(x - o.x, z - o.z) < o.radius + 2))
          return 'An obstacle occupies the new fields';
      }
  }
}

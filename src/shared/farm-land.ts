import { spaceportReserved } from './spaceport-site';
import { inPasture } from './pasture-land';
import { highWater } from './ocean';
import { dockReserved } from './boathouse';
import { onAirfield } from './airfield';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types.ts';
import { terrainHeight, mapHalf } from './terrain.ts';
import { blocksBuilding } from './building-shapes.ts';
import { townRoads, roadDistance } from './town.ts';
export const MAX_FARM_PLOTS = 16;
export function farmPlotCount(b: Pick<Building, 'farmPlots'>) {
  return [4, 8, 12, 16].includes(b.farmPlots ?? 4) ? (b.farmPlots ?? 4) : 4;
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
    return Array.from({ length: farmPlotCount(b) }, (_, i) => farmPlotLocal(i))
      .slice(firstPlot)
      .some((p) => Math.abs(lx - p.x) < 4 + padding && Math.abs(lz - p.z) < 4 + padding);
  });
}
export function farmExpansionBlocker(w: World, b: Building): string | undefined {
  const count = farmPlotCount(b);
  if (count >= MAX_FARM_PLOTS) return 'This farm already has the maximum 16 plots';
  const roads = townRoads(w);
  for (let i = count; i < count + 4; i++) {
    const p = farmPlotPosition(b, i);
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
    const heights: number[] = [];
    // Check a conservative 10 m square including boundaries, not just the centre.
    for (const dx of [-5, 0, 5])
      for (const dz of [-5, 0, 5]) {
        const x = p.x + dx,
          z = p.z + dz;
        if (Math.max(Math.abs(x), Math.abs(z)) >= mapHalf(w))
          return 'New fields would leave the map';
        const height = terrainHeight(w, x, z);
        if (height <= highWater(w) + 0.1) return 'New fields need dry ground';
        heights.push(height);
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
    if (Math.max(...heights) - Math.min(...heights) > 2)
      return 'New fields need reasonably level ground';
  }
}

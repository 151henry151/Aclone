// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types';
import { CANOE, canoeRules, canoeVehicle } from './canoe-rules';
import { boatLandings, withinBoatLanding, landingBlocked } from './boathouse';
import { terrainHeight, mapHalf } from './terrain';
import { surfaceWaterLevel } from './ocean';
import { travelHeight } from './dock';
import { blocksBuilding, buildingBlocksMovement } from './building-shapes';
import { creatorBlocks, creatorBlocksSegment } from './creator';
export interface CanoeLanding {
  land: { x: number; z: number };
  berth: { x: number; z: number };
  heading: number;
  id?: string;
}
export function rowedWater(
  w: World,
  x: number,
  z: number,
  heading: number,
  v: import('./types').VehicleDef,
  minDepth: number,
) {
  const s = Math.sin(heading),
    c = Math.cos(heading);
  return (
    [-1, 0, 1].every((side) =>
      [-1, 0, 1].every((end) => {
        const px = x + ((side * v.beam!) / 2) * c + ((end * v.length!) / 2) * s,
          pz = z - ((side * v.beam!) / 2) * s + ((end * v.length!) / 2) * c;
        return (
          Math.max(Math.abs(px), Math.abs(pz)) < mapHalf(w) &&
          surfaceWaterLevel(w, px, pz) - terrainHeight(w, px, pz) >= minDepth
        );
      }),
    ) &&
    !w.buildings.some((b) =>
      blocksBuilding(
        b,
        x,
        z,
        surfaceWaterLevel(w, x, z) - terrainHeight(w, b.x, b.z),
        v.collisionRadius!,
      ),
    ) &&
    !creatorBlocks(w, x, z, surfaceWaterLevel(w, x, z), v.collisionRadius!)
  );
}
export function clearRowedBank(
  w: World,
  land: { x: number; z: number },
  berth: { x: number; z: number },
  bankRise: number,
) {
  const h = travelHeight(w, land.x, land.z),
    level = surfaceWaterLevel(w, berth.x, berth.z);
  return (
    Math.max(Math.abs(land.x), Math.abs(land.z)) < mapHalf(w) &&
    h > level &&
    h > surfaceWaterLevel(w, land.x, land.z) &&
    h - level <= bankRise &&
    !w.buildings.some(
      (b) =>
        blocksBuilding(b, land.x, land.z, 0, 0.35) ||
        buildingBlocksMovement(b, land, berth, 0, 0.35),
    ) &&
    !creatorBlocksSegment(
      w,
      { ...land, y: h },
      { ...berth, y: surfaceWaterLevel(w, berth.x, berth.z) },
      0.35,
      true,
    )
  );
}
export function canoeWater(w: World, x: number, z: number, heading: number) {
  return rowedWater(
    w,
    x,
    z,
    heading,
    canoeVehicle(w.settings),
    canoeRules(w.settings).canoeMinDepth,
  );
}
/** A bounded deterministic search shared by server and controls. Prefer established docks. */
export function canoeLanding(w: World, p: Player, afloat: boolean): CanoeLanding | undefined {
  const r = canoeRules(w.settings);
  const dock = boatLandings(w).find(
    (d) =>
      withinBoatLanding(w, p, d, afloat) &&
      !landingBlocked(w, d, p, !afloat, CANOE) &&
      canoeWater(w, d.berth.x, d.berth.z, d.heading),
  );
  if (dock) return dock;
  const depth = surfaceWaterLevel(w, p.x, p.z) - terrainHeight(w, p.x, p.z);
  if (afloat && (depth < r.canoeMinDepth || depth > r.canoeStepOutDepth)) return;
  if (!afloat && travelHeight(w, p.x, p.z) <= surfaceWaterLevel(w, p.x, p.z)) return;
  for (let distance = 0.5; distance <= r.canoeBankRange; distance += 0.5)
    for (let i = 0; i < 32; i++) {
      const angle = p.heading + (i * Math.PI) / 16,
        other = { x: p.x + Math.sin(angle) * distance, z: p.z + Math.cos(angle) * distance };
      const land = afloat ? other : { x: p.x, z: p.z },
        berth = afloat ? { x: p.x, z: p.z } : other;
      if (
        clearRowedBank(w, land, berth, r.canoeBankRise) &&
        (afloat || canoeWater(w, berth.x, berth.z, p.heading))
      )
        return { land, berth, heading: p.heading };
    }
}

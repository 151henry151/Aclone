// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { riverBanks } from '../shared/inland-water';
import { mapTerrainPaths } from './map-water';
export type ChartWorld = Pick<
  World,
  | 'id'
  | 'settings'
  | 'townLayout'
  | 'terrainMapSize'
  | 'northernIsland'
  | 'terrain'
  | 'landscape'
  | 'coastalBluffs'
  | 'airfield'
  | 'spaceportSite'
>;
export interface MapTerrainJob {
  id: number;
  world: ChartWorld;
  width: number;
  height: number;
  x: number;
  z: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  contours: boolean;
  tide: number;
}
export function chartWorld(w: World): ChartWorld {
  return {
    id: w.id,
    settings: { mapSize: w.settings.mapSize, seaLevel: w.settings.seaLevel } as World['settings'],
    townLayout: w.townLayout,
    terrainMapSize: w.terrainMapSize,
    northernIsland: w.northernIsland ? { ...w.northernIsland, resources: [] } : undefined,
    terrain: w.terrain,
    landscape: w.landscape?.heightmap
      ? ({ heightmap: w.landscape.heightmap } as World['landscape'])
      : undefined,
    coastalBluffs: w.coastalBluffs,
    airfield: w.airfield,
    spaceportSite: w.spaceportSite,
  };
}
export function sampleMapTerrain(j: MapTerrainJob) {
  const paths = mapTerrainPaths(
    j.width,
    j.height,
    (x, y) =>
      terrainHeight(
        j.world as World,
        j.x + (x - j.offsetX) / j.scale,
        j.z + (y - j.offsetY) / j.scale,
      ) - j.world.settings.seaLevel,
    j.contours,
    j.tide,
  );

  let inland = '';
  if (j.world.northernIsland) {
    const at = (p: { x: number; z: number }) =>
      `${((p.x - j.x) * j.scale + j.offsetX).toFixed(2)} ${((p.z - j.z) * j.scale + j.offsetY).toFixed(2)}`;
    const polygon = (points: { x: number; z: number }[]) =>
      points.map((p, i) => (i ? 'L' : 'M') + at(p)).join('') + 'Z';
    for (const r of j.world.northernIsland.rivers) {
      // The survey continues offshore to blend into the sea. Do not chart that
      // submerged continuation as a bright river drawn across the ocean.
      const mouth = r.points.findIndex((p) => p.level <= j.world.settings.seaLevel);
      const banks = riverBanks(mouth < 0 ? r.points : r.points.slice(0, mouth + 1));
      inland += polygon([...banks.map((b) => b.right), ...banks.map((b) => b.left).reverse()]);
    }
    for (const p of j.world.northernIsland.ponds)
      inland += polygon(
        Array.from({ length: 64 }, (_, i) => ({
          x: p.x + Math.cos((i * Math.PI) / 32) * p.rx,
          z: p.z + Math.sin((i * Math.PI) / 32) * p.rz,
        })),
      );
  }
  return { ...paths, inland };
}

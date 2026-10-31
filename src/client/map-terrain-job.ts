// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { mapTerrainPaths } from './map-water';
export type ChartWorld = Pick<
  World,
  | 'id'
  | 'settings'
  | 'townLayout'
  | 'terrainMapSize'
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
  return mapTerrainPaths(
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
}

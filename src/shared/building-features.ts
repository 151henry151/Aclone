// SPDX-License-Identifier: GPL-3.0-or-later
import type { BuildingVolume } from './building-shapes';
export interface BuildingFeature {
  kind: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}
/** Equipment yards are real parts of the footprint, not scenery placed through a neighbour. */
export function buildingFeatures(kind: string, volumes: BuildingVolume[]): BuildingFeature[] {
  const yards: Record<string, [number, number, number]> = {
    refinery: [8, 7, 11],
    brewery: [7, 5, 5.6],
    mine: [6, 7, 10],
    rareMine: [6, 7, 10],
    quarry: [6, 4, 3.5],
    mason: [5, 4, 2.5],
    sawmill: [6, 4, 3],
    carpenter: [4, 3, 2.5],
    workshop: [4, 3, 2.5],
    forge: [5, 5, 7],
    brickworks: [5, 5, 6.5],
    concreteWorks: [6, 5, 8],
    feedmill: [4, 4, 6],
    farm: [4, 4, 5.2],
    dairy: [4, 4, 4],
    creamery: [3, 3, 3],
    sheepfold: [4, 3, 1.8],
    piggery: [4, 3, 2.4],
    bakery: [4, 3, 3.3],
    winery: [5, 4, 3],
    roastery: [4, 3, 3],
    teaHouse: [3, 3, 2.5],
    market: [5, 3, 2],
    garage: [4, 3, 2.5],
    warehouse: [5, 4, 2.5],
    shipyard: [5, 7, 3.5],
    composter: [5, 4, 1.6],
    kitchen: [3, 3, 3],
    dairyKitchen: [5, 4, 2.5],
  };
  const features: BuildingFeature[] = [];
  const main = volumes[0],
    yard = yards[kind];
  if (yard) {
    const [width, depth, height] = yard;
    const right = Math.max(...volumes.map((v) => v.x + v.width / 2));
    features.push({ kind, x: right + width / 2 + 0.25, y: 0, z: main.z, width, depth, height });
  }
  if (kind === 'town')
    features.push({
      kind: 'clocktower',
      x: main.x,
      y: main.eaves + main.rise,
      z: main.z,
      width: 2.6,
      depth: 2.6,
      height: 4.3,
    });
  return features;
}

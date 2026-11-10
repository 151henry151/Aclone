// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building } from './types';
import type { BuildingPlan, BuildingVolume } from './building-shapes';
import { industrialKinds, loadingBayXs, exposedFacade } from './building-facade';
export type BayMotion = 'roll' | 'slide' | 'hinge';
export interface BuildingBay {
  x: number;
  z: number;
  width: number;
  height: number;
  rear?: boolean;
  motion: BayMotion;
  volume: BuildingVolume;
}
export function buildingBays(b: Building, plan: BuildingPlan): BuildingBay[] {
  if (b.construction || b.creatorModel) return [];
  if (b.aircraftHangar)
    return [{ x: 0, z: 8, width: 14.5, height: 5.5, motion: 'slide', volume: plan.volumes[0] }];
  if (!industrialKinds.has(b.kind) && b.kind !== 'starport') return [];
  const motion: BayMotion = ['sawmill', 'boathouse', 'haybarn', 'shipyard'].includes(b.kind)
    ? 'slide'
    : [
          'garage',
          'vehicleStorage',
          'warehouse',
          'factory',
          'automotiveFactory',
          'feedmill',
          'concreteWorks',
          'starport',
        ].includes(b.kind)
      ? 'roll'
      : 'hinge';
  return plan.volumes.flatMap((v, index): BuildingBay[] => {
    if (v.eaves < 2.3 || v.width < 4 || (!b.architecture && index !== 0 && b.kind !== 'starport'))
      return [];
    if (b.kind === 'starport' && (index === 0 || v.width < 18 || v.eaves < 10)) return [];
    const front = v.z + v.depth / 2;
    if (b.kind === 'vehicleStorage')
      return [-7, 0, 7].map((x) => ({
        x: v.x + x,
        z: front,
        width: 4.8,
        height: 4.6,
        motion: 'roll' as const,
        volume: v,
      }));
    if (!exposedFacade(plan.volumes, v, v.x, 1, front + 0.07, 0.2)) return [];
    const port = b.kind === 'starport';
    const xs =
      !b.architecture && port
        ? [v.x - 7, v.x + 7]
        : !b.architecture &&
            ['garage', 'vehicleStorage', 'warehouse', 'factory', 'shipyard', 'haybarn'].includes(
              b.kind,
            ) &&
            v.width >= 10
          ? [v.x - 2.7, v.x + 2.7]
          : loadingBayXs(b.kind, v);
    const bays = xs.map((x) => ({
      x,
      z: front,
      width: port ? (!b.architecture ? 10 : v.width * 0.72) : Math.min(3.6, v.width * 0.65),
      height: port ? (!b.architecture ? 9.5 : v.eaves * 0.72) : Math.min(3.4, v.eaves - 0.3),
      motion,
      volume: v,
    }));
    // The lumber-shed design has a matching rear opening onto daylight.
    if (
      (b.kind === 'sawmill' && b.architecture === 'model-3' && index > 0) ||
      (b.kind === 'boathouse' && index === 0)
    )
      bays.push(...bays.map((bay) => ({ ...bay, z: v.z - v.depth / 2, rear: true })));
    return bays;
  });
}

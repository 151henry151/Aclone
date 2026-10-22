// SPDX-License-Identifier: GPL-3.0-or-later
import { roadSite, roadRoute } from './road-routing.ts';
import {
  advanceRoadProject,
  planRoadDetour,
  planTownRoad,
  safeNearest,
  type RoadProject,
} from './road-projects.ts';
import type { World, Building } from './types.ts';
import { townRoads, roadDistance, type Road } from './town.ts';
import { buildingPlan, buildingBounds } from './building-shapes.ts';
import { townRefusal } from './town-charter.ts';

/** A tractor is about 4.6 m long; the parish lays a little under three a day. */
export const roadGrowthPerDay = 12;
export const grownRoadWidth = 5;

export function grownRoads(w: Pick<World, 'roads'>): readonly Road[] {
  return w.roads ?? [];
}
function footprintRadius(b: Building) {
  const bounds = buildingBounds(buildingPlan(b));
  return Math.max(bounds.width, bounds.depth) / 2;
}
/** Starter lots sit up to ~10 m from a lane edge; larger footprints get a wider reach. */
export function roadConnected(w: World, b: Building, roads: readonly Road[] = townRoads(w)) {
  return roadDistance(roads, b.x, b.z) <= Math.max(12, footprintRadius(b) + 4);
}
/** Building spurs use the same planner as public links, including reserved fields. */
function planBuildingRoad(w: World): RoadProject | undefined {
  const roads = townRoads(w);
  if (!roads.length) return;
  const site = roadSite(w);
  const pending = w.buildings
    .filter((b) => !roadConnected(w, b, roads))
    .filter((b) => b.government || !townRefusal(w, b.owner, b.x, b.z, 'roads'))
    .sort((a, b) => roadDistance(roads, a.x, a.z) - roadDistance(roads, b.x, b.z));
  for (const target of pending) {
    const from = safeNearest(roads, target, site);
    if (!from) continue;
    const heading = Math.atan2(from.x - target.x, from.z - target.z);
    const stop = Math.max(10, footprintRadius(target) + 3);
    for (const turn of [0, 0.5, -0.5, 1, -1, Math.PI]) {
      const to = {
        x: target.x + Math.sin(heading + turn) * stop,
        z: target.z + Math.cos(heading + turn) * stop,
      };
      const path = roadRoute(w, from, to);
      if (path) return { kind: 'building', building: target.id, width: grownRoadWidth, path };
    }
  }
}
/** Each game-day boundary crossed since the last checkpoint lays one stretch, so an
 * outage catches up deterministically instead of racing or skipping work. */
export function growRoads(w: World, start: number, end: number) {
  const dayLength = w.settings.dayLength > 0 ? w.settings.dayLength : 600;
  const last = w.roadGrowth ?? Math.floor(start / dayLength);
  const due = Math.floor(end / dayLength);
  if (due <= last) {
    w.roadGrowth ??= last;
    return;
  }
  for (let d = last + 1; d <= due; d++) {
    w.roadProject ??= planRoadDetour(w) ?? planTownRoad(w) ?? planBuildingRoad(w);
    if (w.roadProject) {
      const target =
        w.roadProject.building && w.buildings.find((b) => b.id === w.roadProject!.building);
      if (
        w.roadProject.kind === 'building' &&
        (!target ||
          roadConnected(w, target) ||
          (!target.government && townRefusal(w, target.owner, target.x, target.z, 'roads')))
      )
        delete w.roadProject;
      else if (!advanceRoadProject(w, w.roadProject, roadGrowthPerDay)) delete w.roadProject;
    }
  }
  w.roadGrowth = due;
}

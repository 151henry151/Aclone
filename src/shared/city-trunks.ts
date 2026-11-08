import { bridgeRoads, bridgePathCuts, bridgeCoversRoad } from './bridge-network';
import { inlandWaterAt } from './inland-water';
import { terrainHeight } from './terrain';
import { roadFordSteps } from './road-fords';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Town } from './town-charter';
import { roadDistance, roadKey, townRoads, type Point, type Road } from './town';
import { roadRules } from './road-rules';
import { roadProjection } from './road-journeys';
import { pointDistance, roadRouteSteps, roadSite } from './road-routing';
import type { RoadWork } from './road-work';
export interface PavingProject {
  destination: string;
  goal: Point;
  path: Point[];
  width: number;
  feederQueued?: boolean;
  bridges?: string;
  waitingForBridge?: { near: Point; far: Point };
}
/** Survey the first intervening river; endpoints alone cannot distinguish a ford
 * from a paved crossing. Return dry, full-width waiting approaches on both banks. */
function* bankApproach(
  w: World,
  start: Point,
  goal: Point,
  width: number,
): RoadWork<{ path: Point[]; near: Point; far: Point } | undefined> {
  const site = roadSite({ ...w, settings: { ...w.settings, roadFords: false } }, width);
  const length = pointDistance(start, goal),
    n = Math.ceil(length / 2);
  const point = (i: number) => ({
    x: start.x + ((goal.x - start.x) * i) / n,
    z: start.z + ((goal.z - start.z) * i) / n,
  });
  let enter = -1,
    leave = -1;
  for (let i = 0; i <= n; i++) {
    yield;
    const p = point(i),
      water = inlandWaterAt(w, p.x, p.z);
    const wet = water?.river && terrainHeight(w, p.x, p.z) <= water.level;
    if (wet && enter < 0) enter = i;
    if (enter >= 0 && !wet) {
      leave = i;
      break;
    }
  }
  if (enter < 0 || leave < 0) return;
  const dry = { ...w, settings: { ...w.settings, roadFords: false } };
  // Solver retries landward when a steep bank cannot support a full-width lane.
  for (
    let offset = Math.ceil((width / 2 + 1) / 2);
    offset <= Math.ceil((width * 8) / 2);
    offset += Math.ceil(width / 2)
  ) {
    const near = point(Math.max(0, enter - offset)),
      far = point(Math.min(n, leave + offset));
    if (!(yield* site.clearSteps(near)) || !(yield* site.clearSteps(far))) continue;
    const path = yield* roadRouteSteps(dry, start, near, width);
    if (path) return { path, near, far };
  }
}
function* fordFeeder(
  w: World,
  near: Point,
  far: Point,
  width: number,
): RoadWork<Point[] | undefined> {
  if (!roadRules(w.settings).roadFords) return;
  const site = roadSite(w, width);
  const fords = (yield* roadFordSteps(w, site, width)).flatMap((f) => [
    { a: f.a, b: f.b },
    { a: f.b, b: f.a },
  ]);
  fords.sort(
    (a, b) =>
      pointDistance(near, a.a) +
      pointDistance(a.b, far) -
      pointDistance(near, b.a) -
      pointDistance(b.b, far),
  );
  for (const ford of fords) {
    yield;
    const before = yield* roadRouteSteps(w, near, ford.a, width);
    if (!before) continue;
    const after = yield* roadRouteSteps(w, ford.b, far, width);
    if (after) return [...before, ford.b, ...after.slice(1)];
  }
}
/** Only a centre-connected urban exit unlocks a trunk; rural branches are not
 * promoted to streets just because a trunk crosses their town boundary. */
export function* growPavedTrunkSteps(
  w: World,
  town: Town,
  connected: readonly Road[],
  allowance: number,
): RoadWork<number> {
  const rules = roadRules(w.settings),
    dry = { ...w, settings: { ...w.settings, roadFords: false } };
  const exits = connected
    .flatMap((r) => [r.a, r.b])
    .filter((p) => pointDistance(p, town) >= town.radius - 1e-6);
  if (!exits.length || allowance <= 0) return 0;
  const projects = (w.pavingProjects ??= {});
  let project: PavingProject | undefined = projects[town.id];
  if (
    project &&
    (!w.cityDevelopment?.[project.destination]?.qualified ||
      !w.towns.some(
        (t) => t.id === project!.destination && pointDistance(t, project!.goal) <= t.radius,
      ))
  ) {
    delete projects[town.id];
    project = undefined;
  }
  const bridgeKey = bridgeRoads(w)
    .map((r) => r.bridge)
    .join(',');
  if (project?.waitingForBridge && (project.bridges ?? '') !== bridgeKey) {
    delete projects[town.id];
    project = undefined;
  }
  if (project?.waitingForBridge) {
    const { near, far } = project.waitingForBridge;
    const site = roadSite(dry, project.width);
    if (
      !(yield* site.clearSteps(near)) ||
      !(yield* site.clearSteps(far)) ||
      (yield* site.segmentSteps(near, far))
    ) {
      // Water/terrain edits can invalidate the bank or remove the crossing.
      // Survey again from the still-connected paved exit before spending more.
      delete projects[town.id];
      project = undefined;
    }
  }
  if (!project) {
    const destinations = w.towns
      .filter((t) => t.id !== town.id && w.cityDevelopment?.[t.id]?.qualified)
      .sort((a, b) => pointDistance(a, town) - pointDistance(b, town));
    const roads = townRoads(w);
    for (const destination of destinations) {
      const goals = roads
        .map((r) => roadProjection(r, destination))
        .filter((p) => pointDistance(p, destination) <= destination.radius);
      goals.sort((a, b) => pointDistance(a, destination) - pointDistance(b, destination));
      if (!goals.length || roadDistance(connected, goals[0].x, goals[0].z) <= 0) continue;
      const goal = goals[0],
        start = exits.slice().sort((a, b) => pointDistance(a, goal) - pointDistance(b, goal))[0];
      const crossing = bridgeKey
        ? yield* roadRouteSteps(dry, start, goal, rules.roadWidth)
        : undefined;
      const bank = crossing ? undefined : yield* bankApproach(w, start, goal, rules.roadWidth);
      const path =
        crossing ?? bank?.path ?? (yield* roadRouteSteps(dry, start, goal, rules.roadWidth));
      if (path) {
        project = projects[town.id] = {
          destination: destination.id,
          goal,
          path: bridgePathCuts(w, path),
          bridges: bridgeKey,
          width: rules.roadWidth,
          ...(bank ? { waitingForBridge: { near: bank.near, far: bank.far } } : {}),
        };
        break;
      }
    }
  }
  if (!project) return 0;
  if (project.waitingForBridge && !project.feederQueued) {
    const { near, far } = project.waitingForBridge;
    const path = yield* fordFeeder(w, near, far, project.width);
    if (path) {
      (w.pavingFeeders ??= []).push({ kind: 'connection', width: project.width, path });
      project.feederQueued = true;
    }
  }
  const site = roadSite(dry, project.width);
  for (let i = 1; i < project.path.length; i++)
    if (!(yield* site.segmentSteps(project.path[i - 1], project.path[i]))) {
      delete projects[town.id];
      return 0;
    }
  let used = 0;
  while (project.path.length > 1 && allowance - used > 1e-6) {
    yield;
    const [a, b] = project.path,
      length = pointDistance(a, b);
    if (length < 1e-6) {
      project.path.shift();
      continue;
    }
    if (bridgeCoversRoad(w, a, b)) {
      project.path.shift();
      continue;
    }
    const step = Math.min(length, allowance - used),
      t = step / length;
    const to = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    const roads = (w.roads ??= []),
      paved = (w.pavedRoads ??= []);
    const tip = paved.findLast(
      (r) =>
        r.kind === 'trunk' &&
        r.town === town.id &&
        r.width === project!.width &&
        pointDistance(r.b, a) < 1e-6 &&
        Math.abs((r.b.x - r.a.x) * (to.z - a.z) - (r.b.z - r.a.z) * (to.x - a.x)) < 1e-6 &&
        (r.b.x - r.a.x) * (to.x - a.x) + (r.b.z - r.a.z) * (to.z - a.z) > 0,
    );
    const base =
      tip?.source && !w.retiredRoads?.includes(tip.source)
        ? roads.findLast((r) => roadKey(r) === tip.source)
        : undefined;
    if (tip && base) {
      base.b = { ...to };
      tip.b = { ...to };
      tip.source = roadKey(base);
    } else {
      const base = { a: { ...a }, b: { ...to }, width: project.width };
      roads.push(base);
      paved.push({
        ...base,
        a: { ...a },
        b: { ...to },
        source: roadKey(base),
        town: town.id,
        kind: 'trunk',
      });
    }
    used += step;
    if (step >= length - 1e-6) project.path.shift();
    else project.path[0] = to;
  }
  if (project.path.length < 2 && !project.waitingForBridge) delete projects[town.id];
  return used;
}

import { bridgeRules } from './bridge-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { ResourceNode } from './resources';
import type { World } from './types';
import type { Road } from './town';
import type { IslandRiver } from './northern-island';
export type RoadWork<T> = Generator<void, T, void>;
/** Synchronous diagnostics use the identical steps that the server schedules. */
export function finishRoadWork<T>(work: RoadWork<T>): T {
  let next = work.next();
  while (!next.done) next = work.next();
  return next.value;
}
let nextResourceStamp = 0;
const resourceStamps = new WeakMap<ResourceNode[], { stamp: number; nodes: ResourceNode[] }>();
/** Compare scalar fields directly instead of formatting every coordinate each tick.
 * Copies retain in-place edit detection without relying on a revision bump. */
function resourceStamp(nodes: ResourceNode[] | undefined) {
  if (!nodes) return;
  const old = resourceStamps.get(nodes);
  if (
    old &&
    old.nodes.length === nodes.length &&
    nodes.every((n, i) => {
      const prior = old.nodes[i];
      return (
        n.id === prior.id &&
        n.item === prior.item &&
        n.x === prior.x &&
        n.z === prior.z &&
        n.name === prior.name &&
        n.capacity === prior.capacity &&
        n.regrowth === prior.regrowth
      );
    })
  )
    return old.stamp;
  const stamp = ++nextResourceStamp;
  resourceStamps.set(nodes, { stamp, nodes: nodes.map((n) => ({ ...n })) });
  return stamp;
}
let nextGeometryStamp = 0;
const roadStamps = new WeakMap<readonly Road[], { stamp: number; roads: Road[] }>();
/** Preserve in-place edit detection without serializing the entire network. */
export function roadGeometryStamp(roads: readonly Road[] | undefined) {
  if (!roads) return;
  const old = roadStamps.get(roads);
  if (
    old &&
    old.roads.length === roads.length &&
    roads.every((r, i) => {
      const prior = old.roads[i];
      return (
        r.a.x === prior.a.x &&
        r.a.z === prior.a.z &&
        r.b.x === prior.b.x &&
        r.b.z === prior.b.z &&
        r.width === prior.width
      );
    })
  )
    return old.stamp;
  const stamp = ++nextGeometryStamp;
  roadStamps.set(roads, {
    stamp,
    roads: roads.map((r) => ({ a: { ...r.a }, b: { ...r.b }, width: r.width })),
  });
  return stamp;
}
const riverStamps = new WeakMap<IslandRiver[], { stamp: number; rivers: IslandRiver[] }>();
export function riverGeometryStamp(rivers: IslandRiver[]) {
  const old = riverStamps.get(rivers);
  if (
    old &&
    old.rivers.length === rivers.length &&
    rivers.every((r, i) => {
      const prior = old.rivers[i];
      return (
        r.id === prior.id &&
        r.name === prior.name &&
        r.points.length === prior.points.length &&
        r.points.every((p, j) => {
          const q = prior.points[j];
          return (
            p.x === q.x &&
            p.z === q.z &&
            p.level === q.level &&
            p.width === q.width &&
            p.depth === q.depth
          );
        })
      );
    })
  )
    return old.stamp;
  const stamp = ++nextGeometryStamp;
  riverStamps.set(rivers, {
    stamp,
    rivers: rivers.map((r) => ({ ...r, points: r.points.map((p) => ({ ...p })) })),
  });
  return stamp;
}
/** Only durable geometry/policy participates; clock, stock and cash are not edits. */
export function roadGeometryKey(w: World): string {
  const { time: _time, ...settings } = w.settings;
  return JSON.stringify([
    settings,
    w.terrainMapSize,
    w.townLayout,
    w.terrain,
    w.earthworks?.map((p) => [
      p.id,
      p.x,
      p.z,
      p.width,
      p.depth,
      p.rotation,
      p.target,
      p.shoulder,
      p.progress,
      p.work?.active,
      p.berm,
    ]),
    w.northernIsland && {
      ...w.northernIsland,
      resources: resourceStamp(w.northernIsland.resources),
      rivers: riverGeometryStamp(w.northernIsland.rivers),
    },
    w.coastalBluffs,
    w.landscape,
    w.creator,
    w.airfield,
    w.spaceportSite,
    w.resourceRelocations,
    resourceStamp(w.additionalResources),
    w.zones,
    roadGeometryStamp(w.roads),
    w.retiredRoads,
    w.bridges?.map((b) => [
      b.id,
      b.a,
      b.b,
      b.approachA,
      b.approachB,
      b.width,
      b.completedAt !== undefined,
      !!b.closure,
      b.condition >= bridgeRules(w.settings).bridgeMinimumCondition,
    ]),
    w.towns.map((t) => [t.id, t.x, t.z, t.radius, t.permissions, t.residents]),
    w.buildings.map((b) => [
      b.id,
      b.kind,
      b.owner,
      b.x,
      b.z,
      b.rotation,
      b.architecture,
      b.farmPlots,
      b.pasture,
      b.style,
      b.size,
      b.creatorBounds,
      b.launchOffset,
      b.aircraftHangar,
    ]),
  ]);
}

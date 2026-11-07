// SPDX-License-Identifier: GPL-3.0-or-later
import type { ResourceNode } from './resources';
import type { World } from './types';
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
/** Only durable geometry/policy participates; clock, stock and cash are not edits. */
export function roadGeometryKey(w: World): string {
  const { time: _time, ...settings } = w.settings;
  return JSON.stringify([
    settings,
    w.terrainMapSize,
    w.townLayout,
    w.terrain,
    w.northernIsland && {
      ...w.northernIsland,
      resources: resourceStamp(w.northernIsland.resources),
    },
    w.coastalBluffs,
    w.landscape,
    w.creator,
    w.airfield,
    w.spaceportSite,
    w.resourceRelocations,
    resourceStamp(w.additionalResources),
    w.zones,
    w.roads,
    w.retiredRoads,
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

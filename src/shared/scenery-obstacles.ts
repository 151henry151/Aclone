// SPDX-License-Identifier: GPL-3.0-or-later
import { finishRoadWork, type RoadWork } from './road-work';
import type { World } from './types';
import { terrainHeight, mapHalf, woodland } from './terrain';
import { hash2 } from './noise';
import { townRoads, roadDistance, type Point } from './town';
import { worldResourcesSteps, type ResourceNode } from './resources';
import { buildingPlan, buildingBounds } from './building-shapes';
import { onFarmLand } from './farm-land';
import { onAirfield } from './airfield';
import { inlandWaterAt, nearInlandWater } from './inland-water';
import { spawnReservations } from './spawn-reserve';
import { bluffPoint, bluffEdge } from './coastal-bluffs';
import { obstacleRules } from './obstacle-rules';
export const sceneryChunkSize = 256;
export interface SceneryObstacle extends Point {
  id: string;
  kind: 'tree' | 'boulder';
  source: 'village' | 'woodland' | 'coast' | 'resource';
  y: number;
  radius: number;
  height: number;
  scale: number;
  rotation: number;
  variant: number;
  species?: 'oak' | 'birch' | 'pine';
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  tiltX?: number;
  tiltZ?: number;
}
/** Authored gathering-ground stone dimensions, shared with the mesh builder. */
export const stoneBoulderShapes = [
  { x: -1.25, z: -0.6, sx: 2.15, sy: 1.9, sz: 1.7 },
  { x: 2, z: -1.2, sx: 1.45, sy: 1.4, sz: 1.2 },
  { x: 0.2, z: 2.4, sx: 0.7, sy: 0.43, sz: 0.55 },
] as const;
export function stoneGroundBoulders(w: World, node: ResourceNode): SceneryObstacle[] {
  if (
    node.item !== 'stone' ||
    w.creator?.scenery === false ||
    w.creator?.resourceModels?.stone ||
    w.buildings.some((b) => Math.hypot(b.x - node.x, b.z - node.z) < 12) ||
    terrainHeight(w, node.x, node.z) < w.settings.seaLevel + 0.1
  )
    return [];
  return stoneBoulderShapes.map((s, i) => ({
    id: `resource:${node.id}:${i}`,
    kind: 'boulder',
    source: 'resource',
    x: node.x + s.x,
    z: node.z + s.z,
    y: terrainHeight(w, node.x + s.x, node.z + s.z),
    radius: Math.max(s.sx, s.sz),
    height: s.sy * 1.55,
    scale: 1,
    scaleX: s.sx,
    scaleY: s.sy,
    scaleZ: s.sz,
    rotation: Number(node.id.split('-').at(-1)) * 0.57,
    variant: i,
  }));
}
export function coastalBoulders(w: World): SceneryObstacle[] {
  return (w.coastalBluffs ?? []).flatMap((b, i) =>
    Array.from({ length: 9 }, (_, j) => {
      const at = bluffPoint(
          b,
          (j / 8 - 0.5) * b.width * 1.55,
          bluffEdge(b, (j / 8 - 0.5) * b.width * 1.55) - 2.6,
        ),
        seed = Math.abs(Math.sin(b.seed * 13 + j * 7.9));
      return {
        id: `coast:${i}:${j}`,
        kind: 'boulder' as const,
        source: 'coast' as const,
        ...at,
        y: terrainHeight(w, at.x, at.z) - 0.5,
        radius: 1.5 + seed * 2,
        height: (1 + seed * 2.4) * 2,
        scale: 1,
        scaleX: 1.5 + seed * 2,
        scaleY: 1 + seed * 2.4,
        scaleZ: 1.2 + seed,
        rotation: b.angle + j,
        tiltX: seed * 0.5,
        tiltZ: seed * 0.3,
        variant: j,
      };
    }),
  );
}
function random(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
type Cache = {
  signature: string;
  chunks: Map<string, SceneryObstacle[]>;
  buckets: Map<string, Map<string, SceneryObstacle[]>>;
  roads: ReturnType<typeof townRoads>;
  grounds: ResourceNode[];
  coast: SceneryObstacle[];
  footprints: { x: number; z: number; radius: number }[];
};
const caches = new Map<string, Cache>();
const checked = new WeakMap<
  World,
  {
    time: number;
    stamp: string;
    landscape: World['landscape'];
    roadRef: World['roads'];
    terrain: World['terrain'];
    revision: number;
    buildings: number;
    roads: number;
    scenery: unknown;
    sea: number;
    cache: Cache;
  }
>();
const identities = new WeakMap<object, number>();
let identitySequence = 0;
function identity(value: object | undefined) {
  if (!value) return 0;
  let id = identities.get(value);
  if (!id) {
    id = ++identitySequence;
    identities.set(value, id);
  }
  return id;
}
/** Cheap per-tick change detection; large terrain/province payloads are serialized only on edits. */
function geometryStamp(w: World) {
  return JSON.stringify([
    w.revision,
    w.settings.mapSize,
    w.settings.seaLevel,
    w.settings.respawnX,
    w.settings.respawnZ,
    w.settings.spawnClearance,
    w.settings.townCentreClearance,
    w.terrainMapSize,
    w.townLayout,
    w.creator?.scenery,
    w.creator?.roads,
    identity(w.creator?.resourceModels),
    identity(w.terrain),
    identity(w.landscape),
    identity(w.roads),
    identity(w.retiredRoads),
    identity(w.coastalBluffs),
    identity(w.northernIsland),
    identity(w.additionalResources),
    identity(w.spaceportSite),
    identity(w.airfield),
    w.zones,
    w.towns.map((t) => [t.x, t.z, t.radius]),
    w.buildings.map((b) => [
      b.id,
      b.kind,
      b.x,
      b.z,
      b.rotation,
      b.size,
      b.style,
      b.architecture,
      b.creatorBounds,
      b.farmPlots,
      b.pasture,
    ]),
  ]);
}
/** Snapshots may replace World objects; reuse immutable geometry across their identities. */
function* layout(w: World): RoadWork<Cache> {
  const old = checked.get(w);
  if (
    old?.time === w.time &&
    old.landscape === w.landscape &&
    old.roadRef === w.roads &&
    old.terrain === w.terrain &&
    old.revision === w.revision &&
    old.buildings === w.buildings.length &&
    old.roads === (w.roads?.length ?? 0) &&
    old.scenery === w.creator?.scenery &&
    old.sea === w.settings.seaLevel
  )
    return old.cache;
  const stamp = geometryStamp(w);
  if (old?.stamp === stamp) {
    old.time = w.time;
    return old.cache;
  }
  const signature = JSON.stringify([
    w.id,
    w.settings.mapSize,
    w.settings.seaLevel,
    w.settings.respawnX,
    w.settings.respawnZ,
    w.settings.spawnClearance,
    w.settings.townCentreClearance,
    w.terrainMapSize,
    w.terrain,
    w.landscape,
    w.townLayout,
    w.creator?.scenery,
    w.creator?.roads,
    w.creator?.resourceModels,
    w.roads,
    w.retiredRoads,
    w.coastalBluffs,
    w.northernIsland,
    w.additionalResources,
    w.spaceportSite,
    w.airfield,
    w.towns.map((t) => [t.x, t.z, t.radius]),
    w.zones,
    w.buildings.map((b) => [
      b.id,
      b.kind,
      b.x,
      b.z,
      b.rotation,
      b.size,
      b.style,
      b.architecture,
      b.creatorBounds,
      b.farmPlots,
      b.pasture,
    ]),
  ]);
  let cache = caches.get(w.id);
  if (!cache || cache.signature !== signature) {
    cache = {
      signature,
      chunks: new Map(),
      buckets: new Map(),
      roads: townRoads(w),
      grounds: yield* worldResourcesSteps(w),
      coast: coastalBoulders(w),
      footprints: w.buildings.map((b) => {
        const bounds = buildingBounds(buildingPlan(b));
        return {
          x: b.x,
          z: b.z,
          radius: Math.hypot(
            Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
            Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
          ),
        };
      }),
    };
    if (caches.size >= 8) caches.delete(caches.keys().next().value!);
    caches.set(w.id, cache);
  }
  checked.set(w, {
    time: w.time,
    stamp,
    landscape: w.landscape,
    roadRef: w.roads,
    terrain: w.terrain,
    revision: w.revision,
    buildings: w.buildings.length,
    roads: w.roads?.length ?? 0,
    scenery: w.creator?.scenery,
    sea: w.settings.seaLevel,
    cache,
  });
  return cache;
}
/** Every candidate has its own random stream: exclusions never move surviving objects. */
export function sceneryChunk(w: World, i: number, j: number): readonly SceneryObstacle[] {
  return finishRoadWork(sceneryChunkSteps(w, i, j));
}
/** Survey callers can pause cold generation; only complete chunks enter the cache. */
export function* sceneryChunkSteps(
  w: World,
  i: number,
  j: number,
): RoadWork<readonly SceneryObstacle[]> {
  const cache = yield* layout(w),
    key = `${i}:${j}`,
    prior = cache.chunks.get(key);
  if (prior) return prior;
  const x0 = i * sceneryChunkSize,
    z0 = j * sceneryChunkSize,
    half = mapHalf(w),
    out: SceneryObstacle[] = [];
  const within = (o: Point) =>
    o.x >= x0 && o.x < x0 + sceneryChunkSize && o.z >= z0 && o.z < z0 + sceneryChunkSize;
  const roads = cache.roads.filter(
    ({ a, b, width }) =>
      Math.max(a.x, b.x) + width >= x0 - 8 &&
      Math.min(a.x, b.x) - width <= x0 + 264 &&
      Math.max(a.z, b.z) + width >= z0 - 8 &&
      Math.min(a.z, b.z) - width <= z0 + 264,
  );
  const footprints = cache.footprints.filter(
    (b) => Math.abs(b.x - x0 - 128) < b.radius + 150 && Math.abs(b.z - z0 - 128) < b.radius + 150,
  );
  const grounds = cache.grounds.filter(
    (n) => n.x >= x0 - 16 && n.x < x0 + 272 && n.z >= z0 - 16 && n.z < z0 + 272,
  );
  const reservations = spawnReservations(w);
  const clear = (x: number, z: number, margin: number) =>
    Math.abs(x) < half &&
    Math.abs(z) < half &&
    !reservations.some((s) => Math.hypot(x - s.x, z - s.z) < s.radius + margin) &&
    !onAirfield(w, x, z, margin + 3) &&
    !onFarmLand(w, x, z, margin) &&
    !inlandWaterAt(w, x, z) &&
    !(
      w.spaceportSite &&
      Math.hypot(x - w.spaceportSite.x, z - w.spaceportSite.z) < w.spaceportSite.fence + 10
    ) &&
    roadDistance(roads, x, z) > margin &&
    grounds.every((n) => Math.hypot(n.x - x, n.z - z) > 8 + margin) &&
    footprints.every((b) => Math.hypot(b.x - x, b.z - z) > b.radius + 2 + margin);
  if (w.creator?.scenery !== false)
    for (let n = 0; n < 540; n++) {
      if (n % 8 === 0) yield;
      const rand = random(Math.floor(hash2(i * 541 + n, j, 4201) * 4294967295)),
        x = x0 + rand() * 256,
        z = z0 + rand() * 256,
        village = Math.max(Math.abs(x), Math.abs(z)) < 250,
        roll = rand(),
        h = terrainHeight(w, x, z);
      if (h < w.settings.seaLevel + 0.9) continue;
      const cover = village ? 0.11 : woodland(w, x, z),
        kind =
          roll < cover
            ? 'tree'
            : n % 9 === 0 && h > 14 && cover < 0.2 && !nearInlandWater(w, x, z, 12)
              ? 'boulder'
              : undefined;
      if (!kind || !clear(x, z, kind === 'tree' ? 4 : 1)) continue;
      const scale = kind === 'tree' ? 0.7 + rand() * 0.9 : 0.5 + rand() * 1.1,
        species = hash2(Math.floor(x / 60), Math.floor(z / 50), 91) * 3;
      out.push({
        id: `scenery:${i}:${j}:${n}`,
        kind,
        source: village ? 'village' : 'woodland',
        x,
        y: kind === 'tree' ? h : h + 0.2,
        z,
        scale,
        rotation: rand() * 6,
        variant: Math.floor(rand() * 3),
        radius:
          kind === 'tree' ? (species < 1.25 ? 0.36 : species < 2 ? 0.24 : 0.46) * scale : scale,
        height: kind === 'tree' ? 7 * scale : 2 * scale,
        species:
          kind === 'tree' ? (species < 1.25 ? 'pine' : species < 2 ? 'birch' : 'oak') : undefined,
      });
    }
  for (const o of cache.coast) {
    yield;
    if (within(o) && o.y > w.settings.seaLevel) out.push(o);
  }
  if (w.creator?.scenery !== false)
    for (const node of cache.grounds) {
      yield;
      if (
        node.item === 'stone' &&
        node.x >= x0 - 4 &&
        node.x < x0 + 260 &&
        node.z >= z0 - 4 &&
        node.z < z0 + 260
      )
        for (const o of stoneGroundBoulders(w, node)) if (within(o)) out.push(o);
    }
  if (cache.chunks.size >= 256) {
    const oldest = cache.chunks.keys().next().value!;
    cache.chunks.delete(oldest);
    cache.buckets.delete(oldest);
  }
  cache.chunks.set(key, out);
  return out;
}
const bucketSize = 16;
/** Spatial buckets bound work to nearby objects, never the whole island. */
export function sceneryObstaclesNear(w: World, a: Point, b: Point, padding = 0): SceneryObstacle[] {
  return finishRoadWork(sceneryObstaclesNearSteps(w, a, b, padding));
}
export function* sceneryObstaclesNearSteps(
  w: World,
  a: Point,
  b: Point,
  padding = 0,
): RoadWork<SceneryObstacle[]> {
  const mode = obstacleRules(w.settings).solidScenery;
  if (mode === 'off') return [];
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length2 = dx * dx + dz * dz;
  const nearSegment = (x: number, z: number, radius: number) => {
    const t = length2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length2)) : 0;
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t) <= radius;
  };
  const cache = yield* layout(w),
    r = padding + 5,
    minX = Math.min(a.x, b.x) - r,
    maxX = Math.max(a.x, b.x) + r,
    minZ = Math.min(a.z, b.z) - r,
    maxZ = Math.max(a.z, b.z) + r,
    out: SceneryObstacle[] = [];
  for (let i = Math.floor(minX / 256); i <= Math.floor(maxX / 256); i++)
    for (let j = Math.floor(minZ / 256); j <= Math.floor(maxZ / 256); j++) {
      if (!nearSegment((i + 0.5) * 256, (j + 0.5) * 256, 128 * Math.SQRT2 + r)) continue;
      const key = `${i}:${j}`;
      let buckets = cache.buckets.get(key);
      if (!buckets) {
        buckets = new Map();
        for (const o of yield* sceneryChunkSteps(w, i, j)) {
          const k = `${Math.floor(o.x / bucketSize)}:${Math.floor(o.z / bucketSize)}`,
            list = buckets.get(k) ?? [];
          list.push(o);
          buckets.set(k, list);
        }
        cache.buckets.set(key, buckets);
      }
      for (
        let x = Math.max(i * 16, Math.floor(minX / 16));
        x <= Math.min(i * 16 + 15, Math.floor(maxX / 16));
        x++
      )
        for (
          let z = Math.max(j * 16, Math.floor(minZ / 16));
          z <= Math.min(j * 16 + 15, Math.floor(maxZ / 16));
          z++
        )
          if (nearSegment((x + 0.5) * 16, (z + 0.5) * 16, 8 * Math.SQRT2 + r))
            for (const o of buckets.get(`${x}:${z}`) ?? [])
              if (mode !== 'trunks' || o.kind === 'tree') out.push(o);
    }
  return out;
}

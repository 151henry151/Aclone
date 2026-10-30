// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { worldResources, resourceNode, type ResourceNode } from '../shared/resources';
import { terrainHalf, terrainHeight, terrainSeed } from '../shared/terrain';
import { highWater } from '../shared/ocean';
import { hash2 } from '../shared/noise';
import { bluffPoint } from '../shared/coastal-bluffs';
import { onAirfield } from '../shared/airfield';
import { onFarmLand } from '../shared/farm-land';
import { blocksBuilding } from '../shared/building-shapes';
import { dockReserved } from '../shared/boathouse';
import { barrierSegments, scatterObjects } from '../shared/landscape';
import { roadDistance, townRoads } from '../shared/town';

type Point = { x: number; z: number };
const apart = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** An additive public-world survey. Save coordinates once: no rerolls, relocations or resets. */
export function ensurePuddlewickResources(w: World) {
  if (
    w.id !== 'puddlewick' ||
    (w.owner !== 'server' && !w.publicParishVersion) ||
    w.template !== 'economy' ||
    w.resourceExpansionVersion === 1 ||
    terrainHalf(w) < 1000
  )
    return false;
  const existing = worldResources(w),
    added: ResourceNode[] = [];
  const half = terrainHalf(w),
    sea = highWater(w) + 1,
    seed = terrainSeed(w) ^ 0x64319;
  const roads = townRoads(w),
    barriers = barrierSegments(w).map((b) => ({ ...b, width: b.width ?? 0.2 }));
  const obstacles = [...(w.creator?.objects ?? []), ...scatterObjects(w)].filter((o) => o.solid);
  const clear = (p: Point) => {
    if (Math.max(Math.abs(p.x), Math.abs(p.z)) > half - 60) return false;
    const heights = [
      [0, 0],
      [8, 0],
      [-8, 0],
      [0, 8],
      [0, -8],
    ].map(([x, z]) => terrainHeight(w, p.x + x, p.z + z));
    if (Math.min(...heights) <= sea || Math.max(...heights) - Math.min(...heights) > 5)
      return false;
    if (
      roadDistance(roads, p.x, p.z) < 8 ||
      roadDistance(barriers, p.x, p.z) < 8 ||
      onAirfield(w, p.x, p.z, 15)
    )
      return false;
    if (
      onFarmLand(w, p.x, p.z, 12) ||
      w.buildings.some(
        (b) =>
          apart(b, p) < 20 || blocksBuilding(b, p.x, p.z, 0, 12) || dockReserved(b, p.x, p.z, 12),
      )
    )
      return false;
    return !obstacles.some((o) => apart(o, p) < o.radius + 12);
  };
  const available = (p: Point, others: Point[] = added) =>
    clear(p) && !existing.some((n) => apart(n, p) < 28) && !others.some((n) => apart(n, p) < 28);
  const candidates: Point[] = [];
  for (let z = -half + 240; z < half - 240; z += 400)
    for (let x = -half + 240; x < half - 240; x += 400) {
      const p = {
        x: Math.round(x + (hash2(x, z, seed) - 0.5) * 180),
        z: Math.round(z + (hash2(x, z, seed + 1) - 0.5) * 180),
      };
      if (Math.hypot(p.x, p.z) > 850 && clear(p)) candidates.push(p);
    }
  // Farthest-first sampling distributes concentrations across both arms and the northern land.
  const centres: Point[] = [{ x: 0, z: 0 }];
  for (let cluster = 0; cluster < 8;) {
    candidates.sort(
      (a, b) =>
        Math.min(...centres.map((c) => apart(b, c))) - Math.min(...centres.map((c) => apart(a, c))),
    );
    const centre = candidates.shift();
    if (!centre || Math.min(...centres.map((c) => apart(centre, c))) < 850) break;
    const trial: ResourceNode[] = [];
    for (let i = 0; i < 192 && trial.length < 16; i++) {
      const angle = i * 2.399963 + hash2(cluster, 0, seed) * Math.PI * 2;
      const radius = 35 + Math.sqrt(hash2(cluster, i, seed + 2)) * 145;
      const p = {
        x: Math.round(centre.x + Math.cos(angle) * radius),
        z: Math.round(centre.z + Math.sin(angle) * radius),
      };
      if (available(p, [...added, ...trial]))
        trial.push(
          resourceNode(
            `extra-cluster-${cluster}-${trial.length}`,
            ['logs', 'stone', 'gravel', 'dirt'][trial.length % 4],
            p.x,
            p.z,
          ),
        );
    }
    if (trial.length < 16) continue;
    added.push(...trial);
    centres.push(centre);
    cluster++;
  }
  // Four dozen extra clearings, dispersed independently of the denser mixed clusters.
  const woodland: Point[] = [];
  const trees = candidates.filter((p) => !centres.some((c) => apart(c, p) < 260));
  while (woodland.length < 48 && trees.length) {
    trees.sort(
      (a, b) =>
        Math.min(...[...centres, ...woodland].map((c) => apart(b, c))) -
        Math.min(...[...centres, ...woodland].map((c) => apart(a, c))),
    );
    const p = trees.shift()!;
    if (!available(p)) continue;
    added.push(resourceNode(`extra-woodland-${woodland.length}`, 'logs', p.x, p.z));
    woodland.push(p);
  }
  // Use the inland shoulders, never the cliff face or rocks below the tide line.
  for (const bluff of w.coastalBluffs ?? []) {
    let count = 0;
    for (let i = 0; i < 96 && count < 3; i++) {
      const p = bluffPoint(
        bluff,
        (hash2(bluff.seed, i, seed + 3) - 0.5) * bluff.width * 1.5,
        -45 - hash2(bluff.seed, i, seed + 4) * bluff.inland * 0.65,
      );
      p.x = Math.round(p.x);
      p.z = Math.round(p.z);
      if (available(p))
        added.push(resourceNode(`extra-cliff-${bluff.id}-${count++}`, 'stone', p.x, p.z));
    }
  }
  if (!added.length) return false;
  const ids = new Set(existing.map((n) => n.id));
  w.additionalResources = [
    ...(w.additionalResources ?? []),
    ...added.filter((n) => !ids.has(n.id)),
  ];
  w.resourceExpansionVersion = 1;
  w.revision++;
  return true;
}

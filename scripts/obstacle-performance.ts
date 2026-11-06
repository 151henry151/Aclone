// SPDX-License-Identifier: GPL-3.0-or-later
import { addPlayer, move } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
import { sceneryObstaclesNear } from '../src/shared/scenery-obstacles';
import type { World } from '../src/shared/types';
/** Isolated server-like movement; report cold placement separately from warmed ticks. */
export function obstaclePerformance(source: World, population = 32) {
  const w = structuredClone(source);
  w.players = {};
  w.maintenance = undefined;
  const centre = w.northernIsland?.regions.find((r) => r.forest > 0.5) ?? { x: 500, z: 500 };
  const players = Array.from({ length: population }, (_, i) => {
    const p = addPlayer(w, `movement-${i}`, `Driver ${i}`);
    p.x = centre.x + (i % 8) * 12;
    p.z = centre.z + Math.floor(i / 8) * 12;
    p.y = terrainHeight(w, p.x, p.z);
    Object.assign(p, { online: true, engine: true, fuel: 64, speed: 3 });
    return p;
  });
  const origins = players.map((p) => ({ x: p.x, z: p.z, y: p.y }));
  const coldAt = performance.now();
  for (const p of players) sceneryObstaclesNear(w, p, { x: p.x, z: p.z + 1 }, 2);
  const coldMs = performance.now() - coldAt;
  const ticks: number[] = [],
    queries: number[] = [];
  let candidates = 0;
  for (let t = 0; t < 200; t++) {
    w.time += 0.05;
    for (const [i, p] of players.entries()) Object.assign(p, origins[i], { speed: 3 });
    const queryAt = performance.now();
    for (const p of players)
      candidates = Math.max(
        candidates,
        sceneryObstaclesNear(w, p, { x: p.x, z: p.z + 1 }, 2).length,
      );
    queries.push(performance.now() - queryAt);
    const tickAt = performance.now();
    for (const p of players) move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    ticks.push(performance.now() - tickAt);
  }
  const stats = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      max: sorted.at(-1)!,
    };
  };
  const result = {
    population,
    centre,
    coldMs,
    ticks: stats(ticks),
    queries: stats(queries),
    maxCandidates: candidates,
  };
  if (result.ticks.p95 > 50 || candidates > 128)
    throw Error(`Obstacle movement budget exceeded: ${JSON.stringify(result)}`);
  return result;
}

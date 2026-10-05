// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types.ts';
import { canCarry, distance, terrainHeight } from './simulation.ts';
import { legacyHalf, mapHalf, terrainSeed, woodland } from './terrain.ts';
import { hash2 } from './noise.ts';
import { townRefusal } from './town-charter.ts';
export interface ResourceNode {
  id: string;
  item: string;
  name: string;
  x: number;
  z: number;
  capacity: number;
  regrowth: number;
}
/** Surveyed public gathering grounds; shared stable IDs make depletion survive restarts. */
const gatheringSites: Record<string, [number, number][]> = {
  logs: [
    [-204, -74],
    [-224, -118],
    [-179, -136],
    [-164, -194],
    [-216, -205],
    [-125, -199],
  ],
  stone: [
    [221, -170],
    [156, -200],
    [100, -174],
    [201, -45],
    [206, 20],
    [183, 38],
  ],
  gravel: [
    [-221, 125],
    [-184, 101],
    [-217, 4],
    [185, 104],
    [225, 84],
    [230, -83],
  ],
  dirt: [
    [-145, 126],
    [-150, -53],
    [-78, -224],
    [66, -229],
    [151, -151],
    [171, 61],
  ],
};
const names: Record<string, string> = {
  logs: 'Woodland clearing',
  stone: 'Stone outcrop',
  gravel: 'Gravel hollow',
  dirt: 'Exposed topsoil',
};
const node = (id: string, item: string, x: number, z: number): ResourceNode => ({
  id,
  item,
  name: names[item],
  x,
  z,
  capacity: item === 'logs' ? 18 : 30,
  regrowth: item === 'logs' ? 1800 : 600,
});
export const resourceNodes: ResourceNode[] = Object.entries(gatheringSites).flatMap(
  ([item, positions]) =>
    // Retain existing depletion/task/NPC IDs when relocating the old town grids.
    positions.map(([x, z], i) => node(`${item}-${i}`, item, x, z)),
);
/** Countryside patches on a 400 m lattice. Stable IDs are derived from the lattice
 * cell, so depletion, tasks and NPC plans survive restarts without storing positions. */
const patchCell = 400;
function countrysidePatches(w: World): ResourceNode[] {
  const half = mapHalf(w);
  if (half <= legacyHalf) return [];
  const seed = terrainSeed(w) ^ 0x5bd1e995,
    cells = Math.ceil(half / patchCell),
    out: ResourceNode[] = [];
  for (let cz = -cells; cz < cells; cz++)
    for (let cx = -cells; cx < cells; cx++) {
      if (hash2(cx, cz, seed) > 0.42) continue;
      const x = (cx + 0.5) * patchCell + (hash2(cx, cz, seed + 1) - 0.5) * 240,
        z = (cz + 0.5) * patchCell + (hash2(cx, cz, seed + 2) - 0.5) * 240;
      if (Math.abs(x) >= half - 40 || Math.abs(z) >= half - 40) continue;
      if (Math.max(Math.abs(x), Math.abs(z)) < 320) continue;
      const h = terrainHeight(w, x, z);
      if (h <= w.settings.seaLevel + 1.5) continue;
      const pick = hash2(cx, cz, seed + 3);
      const item =
        woodland(w, x, z) > 0.45
          ? 'logs'
          : h > 16
            ? pick < 0.6
              ? 'stone'
              : 'gravel'
            : pick < 0.5
              ? 'dirt'
              : 'gravel';
      out.push(node(`${item}-c${cx + cells}-${cz + cells}`, item, Math.round(x), Math.round(z)));
    }
  return out;
}
const resourceCache = new WeakMap<World, { key: string; nodes: ResourceNode[] }>();
/** Every gathering ground in this world: the surveyed village sites plus countryside patches. */
export function worldResources(w: World): ResourceNode[] {
  const key = `${w.id}:${mapHalf(w)}:${w.settings.seaLevel}:${w.landscape?.heightmap?.length ?? 0}:${w.terrain.length}`;
  const cached = resourceCache.get(w);
  if (cached?.key === key) return cached.nodes;
  const patches = countrysidePatches(w);
  const nodes = patches.length ? [...resourceNodes, ...patches] : resourceNodes;
  resourceCache.set(w, { key, nodes });
  return nodes;
}
export function resourceAmount(w: World, n: ResourceNode) {
  const saved = w.resources?.[n.id];
  return saved
    ? Math.min(
        n.capacity,
        saved.amount + Math.floor(Math.max(0, w.time - saved.updated) / n.regrowth) * 3,
      )
    : n.capacity;
}
/** Read-only eligibility shared by the HUD and authoritative gathering action. */
export function gatheringStatus(w: World, p: Player, n: ResourceNode) {
  const amount = p.skills.includes(n.item === 'logs' ? 'forester' : 'excavator') ? 6 : 3;
  const available = resourceAmount(w, n);
  let reason: string | undefined;
  if (distance(p, n) > 10 || Math.abs(p.y - terrainHeight(w, p.x, p.z)) > 3)
    reason = 'Move close to a marked gathering ground';
  else if (p.task || p.atHome || p.game || p.hitch || p.crowBody)
    reason = 'Finish your activity first';
  else if (w.buildings.some((b) => distance(b, n) < 12))
    reason = 'Buildings obstruct this gathering ground';
  else if (townRefusal(w, p.id, n.x, n.z, 'environment'))
    reason = townRefusal(w, p.id, n.x, n.z, 'environment');
  else if (n.item !== 'dirt' && !(p.inventory.tools > 0))
    reason = 'Carry tools to gather logs, gravel or stone';
  else if (available < amount) reason = 'This ground needs time to replenish';
  else if (!canCarry(p, n.item, amount, w)) reason = 'Make room in your cargo';
  return { amount, available, seconds: amount === 6 ? 12 : 20, reason };
}
export function gather(w: World, p: Player, id: string) {
  const n = worldResources(w).find((n) => n.id === id);
  if (!n) throw Error('Move close to a marked gathering ground');
  const { amount, available, seconds, reason } = gatheringStatus(w, p, n);
  if (reason) throw Error(reason);
  w.resources ??= {};
  w.resources[n.id] = { amount: available - amount, updated: w.time };
  p.task = {
    kind: 'gather',
    resource: n.id,
    item: n.item,
    amount,
    end: w.time + seconds,
  };
  p.speed = 0;
}
export function finishGather(p: Player, w?: World) {
  const t = p.task!;
  if (!t.item || !t.amount || !canCarry(p, t.item, t.amount, w)) return false;
  p.inventory[t.item] = (p.inventory[t.item] ?? 0) + t.amount;
  delete p.task;
  return true;
}

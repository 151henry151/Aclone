// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types.ts';
import { canCarry, distance, terrainHeight } from './simulation.ts';
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
export const resourceNodes: ResourceNode[] = Object.entries(gatheringSites).flatMap(
  ([item, positions], k) =>
    positions.map(([x, z], i) => ({
      // Retain existing depletion/task/NPC IDs when relocating the old town grids.
      id: `${item}-${i}`,
      item,
      name: ['Woodland clearing', 'Stone outcrop', 'Gravel hollow', 'Exposed topsoil'][k],
      x,
      z,
      capacity: item === 'logs' ? 18 : 30,
      regrowth: item === 'logs' ? 1800 : 600,
    })),
);
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
  else if (n.item !== 'dirt' && !(p.inventory.tools > 0))
    reason = 'Carry tools to gather logs, gravel or stone';
  else if (available < amount) reason = 'This ground needs time to replenish';
  else if (!canCarry(p, n.item, amount)) reason = 'Make room in your cargo';
  return { amount, available, seconds: amount === 6 ? 12 : 20, reason };
}
export function gather(w: World, p: Player, id: string) {
  const n = resourceNodes.find((n) => n.id === id);
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
export function finishGather(p: Player) {
  const t = p.task!;
  if (!t.item || !t.amount || !canCarry(p, t.item, t.amount)) return false;
  p.inventory[t.item] = (p.inventory[t.item] ?? 0) + t.amount;
  delete p.task;
  return true;
}

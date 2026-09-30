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
export const resourceNodes: ResourceNode[] = ['logs', 'stone', 'gravel', 'dirt'].flatMap(
  (item, k) =>
    Array.from({ length: 6 }, (_, i) => ({
      id: `${item}-${i}`,
      item,
      name: ['Woodland', 'Stone outcrop', 'Gravel bank', 'Topsoil patch'][k],
      x: [-118, 115, 110, -110][k] + (i % 3) * 9,
      z: [-80, -25, 92, 98][k] + Math.floor(i / 3) * 10,
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
export function gather(w: World, p: Player, id: string) {
  const n = resourceNodes.find((n) => n.id === id);
  if (!n || distance(p, n) > 10 || Math.abs(p.y - terrainHeight(w, p.x, p.z)) > 3)
    throw Error('Move close to a marked gathering ground');
  if (p.task || p.atHome || p.game || p.hitch || p.crowBody)
    throw Error('Finish your activity first');
  if (w.buildings.some((b) => distance(b, n) < 12))
    throw Error('Buildings obstruct this gathering ground');
  if (n.item !== 'dirt' && !(p.inventory.tools > 0))
    throw Error('Carry tools to gather logs, gravel or stone');
  const amount = p.skills.includes(n.item === 'logs' ? 'forester' : 'excavator') ? 6 : 3;
  const available = resourceAmount(w, n);
  if (available < amount) throw Error('This ground needs time to replenish');
  if (!canCarry(p, n.item, amount)) throw Error('Make room in your cargo');
  w.resources ??= {};
  w.resources[n.id] = { amount: available - amount, updated: w.time };
  p.task = {
    kind: 'gather',
    resource: n.id,
    item: n.item,
    amount,
    end: w.time + (amount === 6 ? 12 : 20),
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

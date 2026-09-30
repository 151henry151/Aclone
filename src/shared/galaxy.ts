// SPDX-License-Identifier: GPL-3.0-or-later
import { galaxy, items } from './catalog.ts';
export const spaceGoods = ['electronics', 'rareEarth', 'shipParts'];
export function shipStats(a: { ship: string; upgrades?: Record<string, number> }) {
  const ship = galaxy.ships.find((s) => s.id === a.ship) ?? galaxy.ships[0];
  return {
    ...ship,
    range: ship.range + (a.upgrades?.drive ?? 0) * 2,
    capacity: ship.capacity + (a.upgrades?.hold ?? 0) * 20,
  };
}
export function route(from: string, to: string, range: number): string[] {
  const queue = [[from]],
    visited = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!,
      last = galaxy.systems.find((s) => s.id === path.at(-1))!;
    if (last.id === to) return path;
    for (const s of galaxy.systems)
      if (!visited.has(s.id) && Math.hypot(s.x - last.x, s.y - last.y) <= range) {
        visited.add(s.id);
        queue.push([...path, s.id]);
      }
  }
  return [];
}
export function stationPrice(system: string, item: string) {
  const index = galaxy.systems.findIndex((s) => s.id === system),
    good = spaceGoods.indexOf(item);
  const multiplier = [0.7, 1, 1.5][(((index - good) % 3) + 3) % 3];
  const buy = Math.ceil(((items[item]?.price ?? 10000) / 1000) * multiplier);
  return { buy, sell: Math.max(1, buy - 2) };
}

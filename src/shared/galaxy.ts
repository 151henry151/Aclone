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

/** Predictable shield expenditure, not random damage or combat. */
export function jumpQuote(
  a: { ship: string; upgrades?: Record<string, number> },
  fromId: string,
  toId: string,
) {
  const from = galaxy.systems.find((s) => s.id === fromId),
    to = galaxy.systems.find((s) => s.id === toId);
  if (!from || !to || from === to) throw Error('Choose another star system');
  const ship = shipStats(a),
    distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance > ship.range) throw Error('Outside your ship’s jump range');
  const hazard = Math.max(from.hazard, to.hazard),
    hazardCost = Math.ceil(hazard * 2 * (1 - ship.shield));
  return {
    distance,
    hazard,
    hazardCost,
    cost: Math.max(1, Math.ceil(distance * ship.fuelPerPc)) + hazardCost,
    seconds: 6 + Math.ceil(Math.ceil(distance) * ship.secondsPerPc),
  };
}
/** Fewest-jump route with every leg priced using the same rule as the server. */
export function routeQuote(
  a: { ship: string; upgrades?: Record<string, number> },
  from: string,
  to: string,
) {
  const path = route(from, to, shipStats(a).range);
  if (!path.length) return;
  let cost = 0,
    seconds = 0;
  for (let i = 1; i < path.length; i++) {
    const leg = jumpQuote(a, path[i - 1], path[i]);
    cost += leg.cost;
    seconds += leg.seconds;
  }
  return { path, cost, seconds };
}

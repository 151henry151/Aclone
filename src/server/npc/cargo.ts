// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';
import { vehicles } from '../../shared/catalog.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { carry, canCarry, distance } from '../../shared/simulation.ts';
import type { Step } from './decision.ts';

/** A portable reserve, not an unlimited stockpile. Home stores are separate. */
export function portableReserve(item: string, w?: World) {
  const def = worldItems(w)[item];
  if (!def) return 0;
  if (item === 'water') return 6;
  if (item === 'bread') return 3;
  if (def.food || def.drink)
    return Math.min(12, Math.max(3, Math.ceil(24000 / Math.max(def.food ?? 0, def.drink ?? 0, 1))));
  return ['tools', 'tackle', 'pickaxe', 'chainsaw', 'shovel', 'fuel'].includes(item) ? 1 : 0;
}

export function canKeepFishing(w: World, p: Player) {
  return canCarry(p, 'fish', 1, w) && (p.inventory.fish ?? 0) < portableReserve('fish', w) + 3;
}

/** Last resort when an empty tank and a heavy load prevent walking. Use nearby
 * storage/buyers first; otherwise abandon only enough surplus to carry on foot.
 * Every step is an ordinary player action; no teleport, free fuel or cash. */
export function strandedCargo(p: Player, w?: World): Step[] {
  if (p.vehicle === 5 || p.fuel > 0 || p.crowBody) return [];
  const catalogue = worldItems(w);
  if (Object.entries(p.inventory).some(([id, n]) => n > 0 && catalogue[id]?.fuel)) return [];
  let excessWeight = carry(p, w) - vehicles[5].capacity;
  if (excessWeight <= 0) return [];
  const plan: Step[] = [];
  const freight = Object.entries(p.inventory)
    .filter(([id, n]) => catalogue[id]?.weight > 0 && n > portableReserve(id, w))
    .sort(
      ([a], [b]) =>
        catalogue[a].price / catalogue[a].weight - catalogue[b].price / catalogue[b].weight,
    );
  for (const [item, count] of freight) {
    if (excessWeight <= 0) break;
    const n = Math.min(
      10000,
      count - portableReserve(item, w),
      Math.ceil(excessWeight / catalogue[item].weight),
    );
    const b = w?.buildings.find(
      (b) =>
        !b.construction &&
        distance(p, b) < 18 &&
        b.capacity - (b.stock[item] ?? 0) >= n &&
        (b.owner === p.id || (b.buy[item] > 0 && b.investment >= n * b.buy[item])),
    );
    plan.push({
      kind: 'act',
      action: b
        ? b.owner === p.id
          ? { type: 'stock', building: b.id, item, quantity: n, direction: 'deposit' }
          : { type: 'trade', building: b.id, item, quantity: n, direction: 'sell' }
        : { type: 'discard', item, quantity: n },
    });
    excessWeight -= n * catalogue[item].weight;
  }
  return plan;
}

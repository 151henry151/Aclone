// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Stock } from './types';
import type { TrailerKind } from './trailer-definitions';
import { worldItems } from './world-catalogue';
import { stockWeight } from './fishing-expedition';
const animals: Record<string, number> = { cows: 1, sheep: 0.25, pigs: 0.35, chickens: 0.05 };
const seafood = ['fish', 'largeFish', 'cod', 'halibut', 'tuna'];
export function cargoAccepts(
  w: World,
  t: { kind: TrailerKind; cargo: Stock },
  capacity: number,
  item: string,
  n: number,
) {
  const items = worldItems(w),
    cargo = { ...t.cargo, [item]: (t.cargo[item] ?? 0) + n };
  if (!items[item] || stockWeight(w, cargo) > capacity) return false;
  if (t.kind === 'livestock')
    return (
      !!animals[item] &&
      Object.entries(cargo).reduce((s, [id, q]) => s + q * (animals[id] ?? Infinity), 0) <= 6
    );
  if (t.kind === 'tanker')
    return (
      ['water', 'milk'].includes(item) &&
      Object.entries(t.cargo).every(([id, q]) => !q || id === item)
    );
  if (t.kind === 'fuel') return item === 'fuel';
  if (t.kind === 'fish') return seafood.includes(item);
  if (t.kind === 'logs') return ['logs', 'wood'].includes(item);
  if (t.kind === 'dump') return ['stone', 'gravel', 'sand', 'ore', 'topsoil'].includes(item);
  if (animals[item] || ['water', 'milk'].includes(item) || seafood.includes(item)) return false;
  if (t.kind === 'hay')
    return (
      stockWeight(w, Object.fromEntries(Object.entries(cargo).filter(([id]) => id !== 'hay'))) <= 60
    );
  return true;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building } from './types.ts';
import { accounts, addQuantities, recordLife } from './reports.ts';
/** Two milking stalls; reserve cattle still incur maintenance. */
export function herdNeeds(b: Building) {
  const cows = Math.max(0, b.stock.cows ?? 0);
  return { feed: cows, water: cows };
}
export function herdReady(b: Building) {
  return b.kind !== 'dairy' || ((b.stock.cows ?? 0) >= 2 && (b.herdCondition ?? 100) >= 40);
}
export function tendHerd(w: World, b: Building, staff: number, at = w.time) {
  if (b.kind !== 'dairy') return true;
  const cows = b.stock.cows ?? 0;
  if (!cows) {
    b.herdCondition = 100;
    return false;
  }
  const needs = herdNeeds(b),
    fed = Object.entries(needs).every(([id, n]) => (b.stock[id] ?? 0) >= n);
  if (fed) {
    for (const [id, n] of Object.entries(needs)) b.stock[id] -= n;
    addQuantities(accounts(w, b).consumed, needs);
  }
  b.herdCondition = Math.max(
    0,
    Math.min(100, (b.herdCondition ?? 100) + (fed ? (staff > 0 ? 4 : -0.1) : -8)),
  );
  if (b.herdCondition === 0) {
    b.stock.cows = Math.max(0, cows - 1);
    b.herdCondition = 50;
    const owner = b.owner && w.players[b.owner];
    if (owner)
      recordLife(
        w,
        owner,
        {
          kind: 'livestock',
          building: b.id,
          text: `A cow died at ${b.name}. Keep feed, water and qualified care available.`,
        },
        at,
      );
  }
  return fed && herdReady(b);
}
export function breedHerd(w: World, p: import('./types.ts').Player, b: Building) {
  if (
    b.kind !== 'dairy' ||
    b.construction ||
    !(b.owner === p.id || p.job === b.id) ||
    !p.skills.includes('livestock farmer')
  )
    throw Error('The owner or an employed livestock farmer can arrange breeding here');
  if (b.breedingEnd) throw Error('A calf is already on the way');
  if ((b.stock.cows ?? 0) < 2 || (b.herdCondition ?? 100) < 80)
    throw Error('Breeding requires two healthy cows and 80% herd condition');
  if ((b.stock.feed ?? 0) < 4 || (b.stock.water ?? 0) < 4 || b.investment < 2000)
    throw Error('Breeding requires 4 feed, 4 water and 20d investment');
  if ((b.stock.cows ?? 0) >= b.capacity) throw Error('No room for a calf');
  b.stock.feed -= 4;
  b.stock.water -= 4;
  b.investment -= 2000;
  b.breedingEnd = w.time + 3600;
  addQuantities(accounts(w, b).consumed, { feed: 4, water: 4 });
  return 2000;
}
export function birthHerd(w: World, b: Building, at: number) {
  if (!b.breedingEnd || at < b.breedingEnd) return;
  const born =
    (b.stock.cows ?? 0) >= 2 && (b.herdCondition ?? 100) >= 60 && (b.stock.cows ?? 0) < b.capacity;
  if (born) {
    b.stock.cows++;
    addQuantities(accounts(w, b).produced, { cows: 1 });
  }
  delete b.breedingEnd;
  const owner = b.owner && w.players[b.owner];
  if (owner)
    recordLife(
      w,
      owner,
      {
        kind: 'livestock',
        building: b.id,
        text: born
          ? `A calf joined the herd at ${b.name}.`
          : `Breeding at ${b.name} failed: maintain healthy parents and space for the calf.`,
      },
      at,
    );
}

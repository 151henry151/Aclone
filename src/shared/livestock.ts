// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building } from './types.ts';
import { accounts, addQuantities, recordLife } from './reports.ts';
export const livestock = {
  dairy: {
    animal: 'cows',
    singular: 'cow',
    young: 'calf',
    minimum: 2,
    feed: 1,
    water: 1,
    seconds: 3600,
    fee: 2000,
    output: 'milk',
  },
  sheepfold: {
    animal: 'sheep',
    singular: 'sheep',
    young: 'lamb',
    minimum: 2,
    feed: 1,
    water: 1,
    seconds: 3000,
    fee: 1800,
    output: 'wool',
  },
  piggery: {
    animal: 'pigs',
    singular: 'pig',
    young: 'piglet',
    minimum: 2,
    feed: 2,
    water: 1,
    seconds: 2400,
    fee: 2000,
    output: 'compost',
  },
  henhouse: {
    animal: 'chickens',
    singular: 'chicken',
    young: 'chick',
    minimum: 4,
    feed: 0.5,
    water: 0.5,
    seconds: 1800,
    fee: 600,
    output: 'eggs',
  },
} as const;
export type AnimalKind = (typeof livestock)[keyof typeof livestock]['animal'];
export function herdSpec(b: Pick<Building, 'kind'>) {
  return Object.hasOwn(livestock, b.kind) ? livestock[b.kind as keyof typeof livestock] : undefined;
}
/** Rounded up whole sacks/buckets; all residents, including reserves, need care. */
export function herdNeeds(b: Building) {
  const spec = herdSpec(b),
    count = spec ? Math.max(0, b.stock[spec.animal] ?? 0) : 0;
  return {
    feed: Math.ceil(count * (spec?.feed ?? 0)),
    water: Math.ceil(count * (spec?.water ?? 0)),
  };
}
export function herdReady(b: Building) {
  const spec = herdSpec(b);
  return !spec || ((b.stock[spec.animal] ?? 0) >= spec.minimum && (b.herdCondition ?? 100) >= 40);
}
export function tendHerd(w: World, b: Building, staff: number, at = w.time) {
  const spec = herdSpec(b);
  if (!spec) return true;
  const count = b.stock[spec.animal] ?? 0;
  if (!count) {
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
    b.stock[spec.animal] = Math.max(0, count - 1);
    b.herdCondition = 50;
    const owner = b.owner && w.players[b.owner];
    if (owner)
      recordLife(
        w,
        owner,
        {
          kind: 'livestock',
          building: b.id,
          text: `A ${spec.singular} died at ${b.name}. Keep feed, water and qualified care available.`,
        },
        at,
      );
  }
  return fed && herdReady(b);
}
export function breedHerd(w: World, p: import('./types.ts').Player, b: Building) {
  const spec = herdSpec(b);
  if (
    !spec ||
    b.construction ||
    !(b.owner === p.id || p.job === b.id) ||
    !p.skills.includes('livestock farmer')
  )
    throw Error('The owner or an employed livestock farmer can arrange breeding here');
  if (b.breedingEnd) throw Error('An offspring is already on the way');
  if ((b.stock[spec.animal] ?? 0) < spec.minimum || (b.herdCondition ?? 100) < 80)
    throw Error(`Breeding requires ${spec.minimum} ${spec.animal} and 80% herd condition`);
  if ((b.stock.feed ?? 0) < 4 || (b.stock.water ?? 0) < 4 || b.investment < spec.fee)
    throw Error(`Breeding requires 4 feed, 4 water and ${spec.fee / 100}d investment`);
  if ((b.stock[spec.animal] ?? 0) >= b.capacity) throw Error(`No room for a ${spec.young}`);
  b.stock.feed -= 4;
  b.stock.water -= 4;
  b.investment -= spec.fee;
  b.breedingEnd = w.time + spec.seconds;
  addQuantities(accounts(w, b).consumed, { feed: 4, water: 4 });
  return spec.fee;
}
export function birthHerd(w: World, b: Building, at: number) {
  if (!b.breedingEnd || at < b.breedingEnd) return;
  const spec = herdSpec(b);
  if (!spec) {
    delete b.breedingEnd;
    return;
  }
  const born =
    (b.stock[spec.animal] ?? 0) >= spec.minimum &&
    (b.herdCondition ?? 100) >= 60 &&
    (b.stock[spec.animal] ?? 0) < b.capacity;
  if (born) {
    b.stock[spec.animal]++;
    addQuantities(accounts(w, b).produced, { [spec.animal]: 1 });
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
          ? `A ${spec.young} joined the herd at ${b.name}.`
          : `Breeding at ${b.name} failed: maintain healthy parents and space for the ${spec.young}.`,
      },
      at,
    );
}

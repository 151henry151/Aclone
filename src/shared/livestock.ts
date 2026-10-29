import { pastureCapacity } from './pasture-land';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building, Stock } from './types.ts';
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
/** Cattle and sheep can replace one sack of feed with one bale. Other animals need feed. */
export const acceptsHay = (b: Pick<Building, 'kind'>) => ['dairy', 'sheepfold'].includes(b.kind);
export function herdRation(
  b: Building,
  feed = herdNeeds(b).feed,
  water = herdNeeds(b).water,
): Stock {
  const hay = acceptsHay(b) ? Math.min(feed, Math.max(0, b.stock.hay ?? 0)) : 0;
  return { ...(hay ? { hay } : {}), ...(feed > hay ? { feed: feed - hay } : {}), water };
}
/** Upkeep replaces the legacy recipe feed/water, including surplus animals. */
export function livestockInputs(b: Building, inputs: Stock): Stock {
  if (!herdSpec(b)) return inputs;
  const { feed: _feed, water: _water, ...other } = inputs;
  return { ...other, ...herdRation(b) };
}
/** A bounded restocking target, using only the caller's observed market view. */
export function livestockSupplyInputs(w: World, b: Building, inputs: Stock): Stock {
  if (!herdSpec(b)) return inputs;
  const target = livestockInputs(b, inputs);
  if (!acceptsHay(b)) return target;
  const cheapest = (item: string) =>
    Math.min(
      ...w.buildings
        .filter((s) => !s.construction && s.stock[item] > 0 && s.sell[item] > 0)
        .map((s) => s.sell[item]),
    );
  const hay = cheapest('hay'),
    feed = cheapest('feed');
  if (Number.isFinite(hay) && hay <= feed) {
    delete target.feed;
    target.hay = herdNeeds(b).feed;
  } else if (Number.isFinite(feed)) {
    delete target.hay;
    target.feed = herdNeeds(b).feed;
  }
  return target;
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
  const needs = herdRation(b),
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
  const ration = herdRation(b, 4, 4);
  if (
    Object.entries(ration).some(([item, n]) => (b.stock[item] ?? 0) < n) ||
    b.investment < spec.fee
  )
    throw Error(
      `Breeding requires 4 ${acceptsHay(b) ? 'hay or feed' : 'feed'}, 4 water and ${spec.fee / 100}d investment`,
    );
  if (
    (b.stock[spec.animal] ?? 0) >=
    Math.min(b.capacity, pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1))
  )
    throw Error(`Not enough grazing area for a ${spec.young}; expand the pasture`);
  for (const [item, n] of Object.entries(ration)) b.stock[item] -= n;
  b.investment -= spec.fee;
  b.breedingEnd = w.time + spec.seconds;
  addQuantities(accounts(w, b).consumed, ration);
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
    (b.stock[spec.animal] ?? 0) <
      Math.min(b.capacity, pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1));
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

/** Pasture bounds productive herd size; legacy excess animals survive but cannot boost yield. */
export function livestockOutputs(b: Building, outputs: Stock, multiplier = 1): Stock {
  const spec = herdSpec(b);
  if (!spec) return outputs;
  const capacity = b.pasture ? pastureCapacity(b, multiplier) : spec.minimum;
  const productive = Math.min(capacity, Math.max(0, b.stock[spec.animal] ?? 0));
  return Object.fromEntries(
    Object.entries(outputs).map(([id, n]) => [id, Math.floor((n * productive) / spec.minimum)]),
  );
}

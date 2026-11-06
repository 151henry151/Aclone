import { pastureCapacity } from './pasture-land';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building, Stock } from './types.ts';
import { accounts, addQuantities, recordLife } from './reports.ts';
import { livestockRules, type LivestockRules } from './livestock-rules';
import { npcBusinessRules } from './npc-business-rules';
const species = {
  dairy: {
    animal: 'cows',
    singular: 'cow',
    young: 'calf',
    youngItem: 'calves',
    output: 'milk',
    prefix: 'cow',
    maturity: 'calfMaturityDays',
  },
  sheepfold: {
    animal: 'sheep',
    singular: 'sheep',
    young: 'lamb',
    youngItem: 'lambs',
    output: 'wool',
    prefix: 'sheep',
    maturity: 'lambMaturityDays',
  },
  piggery: {
    animal: 'pigs',
    singular: 'pig',
    young: 'piglet',
    youngItem: 'piglets',
    output: 'compost',
    prefix: 'pig',
    maturity: 'pigletMaturityDays',
  },
  henhouse: {
    animal: 'chickens',
    singular: 'chicken',
    young: 'chick',
    youngItem: 'chicks',
    output: 'eggs',
    prefix: 'chicken',
    maturity: 'chickMaturityDays',
  },
} as const;
export type AnimalKind = (typeof species)[keyof typeof species]['animal'];
export interface YoungCohort {
  item: string;
  born: number;
  count: number;
  grownDays: number;
  /** Arrival at this herd; travelling and time in stores never earn growth. */
  careSince?: number;
}
export const youngAnimals = Object.fromEntries(
  Object.values(species).map((s) => [s.youngItem, s.animal]),
) as Record<string, AnimalKind>;
export function herdSpec(b: Pick<Building, 'kind'>, settings: Partial<LivestockRules> = {}) {
  if (!Object.hasOwn(species, b.kind)) return undefined;
  const spec = species[b.kind as keyof typeof species],
    r = livestockRules(settings),
    prefix = spec.prefix;
  return {
    ...spec,
    minimum: r[`${prefix}BreedingMinimum`],
    feed: r[`${prefix}FeedRation`],
    water: r[`${prefix}WaterRation`],
    seconds: r[`${prefix}BreedingSeconds`] / r.livestockBreedingMultiplier,
    fee: r[`${prefix}BreedingFee`],
    maturityDays: r[spec.maturity],
  };
}
/** Default species facts remain available to existing catalogue/model consumers. */
export const livestock = Object.fromEntries(
  Object.keys(species).map((kind) => [kind, herdSpec({ kind })!]),
) as Record<keyof typeof species, NonNullable<ReturnType<typeof herdSpec>>>;
export function herdShares(b: Building, settings: Partial<LivestockRules> = {}) {
  const spec = herdSpec(b, settings);
  return spec
    ? Math.max(0, b.stock[spec.animal] ?? 0) +
        Math.max(0, b.stock[spec.youngItem] ?? 0) *
          livestockRules(settings).livestockYoungPastureShare
    : 0;
}
/** Young feed is fractional; the care ledger settles whole sacks across cycles. */
export function herdNeeds(b: Building, settings: Partial<LivestockRules> = {}) {
  const spec = herdSpec(b, settings),
    r = livestockRules(settings);
  if (!spec) return { feed: 0, water: 0 };
  const adults = Math.max(0, b.stock[spec.animal] ?? 0),
    young = Math.max(0, b.stock[spec.youngItem] ?? 0) * r.livestockYoungRationShare;
  return {
    feed: Math.ceil(adults * spec.feed) + young * spec.feed,
    water: Math.ceil(adults * spec.water) + young * spec.water,
  };
}
function rationCharge(b: Building, kind: 'feed' | 'water', amount: number) {
  return Math.floor(amount + (b.herdRationCredit?.[kind] ?? 0) + 1e-9);
}
export function normalizeYoung(b: Pick<Building, 'stock' | 'young'>, at: number) {
  const result: YoungCohort[] = [];
  for (const spec of Object.values(species)) {
    let remaining = Math.max(0, b.stock[spec.youngItem] ?? 0);
    for (const cohort of b.young ?? []) {
      if (cohort.item !== spec.youngItem || remaining <= 0) continue;
      const count = Math.min(remaining, cohort.count);
      if (count > 0) result.push({ ...cohort, count });
      remaining -= count;
    }
    if (remaining) result.push({ item: spec.youngItem, born: at, count: remaining, grownDays: 0 });
  }
  if (result.length || b.young) b.young = result;
}
function growYoung(w: World, b: Building, at: number, healthy: boolean, mature = true) {
  const spec = herdSpec(b, w.settings)!;
  const r = livestockRules(w.settings);
  for (const cohort of b.young ?? []) {
    if (cohort.item !== spec.youngItem) continue;
    const elapsed = Math.max(
      0,
      at - Math.max(cohort.born, cohort.careSince ?? cohort.born, b.youngCareAt ?? cohort.born),
    );
    if (healthy && w.settings.dayLength > 0)
      cohort.grownDays += (elapsed / w.settings.dayLength) * r.livestockGrowthMultiplier;
    if (!mature || !healthy || cohort.grownDays + 1e-9 < spec.maturityDays) continue;
    const capacity = Math.min(
      b.capacity,
      pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1),
    );
    const room = capacity - herdShares(b, w.settings);
    const available =
      r.livestockYoungPastureShare === 1
        ? room >= 0
          ? cohort.count
          : 0
        : Math.floor((room + 1e-9) / (1 - r.livestockYoungPastureShare));
    const count = Math.max(0, Math.min(cohort.count, available));
    if (!count) continue;
    b.stock[spec.youngItem] -= count;
    b.stock[spec.animal] = (b.stock[spec.animal] ?? 0) + count;
    cohort.count -= count;
  }
  if (b.young) b.young = b.young.filter((c) => c.count > 0);
  b.youngCareAt = at;
}
/** Settle the old clock before changing growth/calendar rules; care and births
 * still run only on the ordinary production cycle. */
export function settleYoungGrowth(w: World) {
  for (const b of w.buildings) {
    if (!herdSpec(b) || !b.young?.length) continue;
    const needs = herdNeeds(b, w.settings),
      fed =
        (!needs.feed ||
          (b.stock.feed ?? 0) + (acceptsHay(b) ? (b.stock.hay ?? 0) : 0) >= needs.feed) &&
        (!needs.water || (b.stock.water ?? 0) >= needs.water);
    growYoung(
      w,
      b,
      w.time,
      fed && (b.herdCondition ?? 100) >= livestockRules(w.settings).livestockGrowthCondition,
      false,
    );
  }
}
/** Cattle and sheep can replace one sack of feed with one bale. Other animals need feed. */
export const acceptsHay = (b: Pick<Building, 'kind'>) => ['dairy', 'sheepfold'].includes(b.kind);
export function herdRation(
  b: Building,
  feed?: number,
  water?: number,
  settings: Partial<LivestockRules> = {},
): Stock {
  const needs = herdNeeds(b, settings);
  feed ??= rationCharge(b, 'feed', needs.feed);
  water ??= rationCharge(b, 'water', needs.water);
  const hay = acceptsHay(b) ? Math.min(feed, Math.max(0, b.stock.hay ?? 0)) : 0;
  return { ...(hay ? { hay } : {}), ...(feed > hay ? { feed: feed - hay } : {}), water };
}
/** Upkeep replaces the legacy recipe feed/water, including surplus animals. */
export function livestockInputs(
  b: Building,
  inputs: Stock,
  settings: Partial<LivestockRules> = {},
): Stock {
  if (!herdSpec(b)) return inputs;
  const { feed: _feed, water: _water, ...other } = inputs;
  return { ...other, ...herdRation(b, undefined, undefined, settings) };
}
/** A bounded restocking target, using only the caller's observed market view. */
export function livestockSupplyInputs(w: World, b: Building, inputs: Stock): Stock {
  if (!herdSpec(b)) return inputs;
  const target = livestockInputs(b, inputs, w.settings);
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
    target.hay = Math.ceil(herdNeeds(b, w.settings).feed);
  } else if (Number.isFinite(feed)) {
    delete target.hay;
    target.feed = Math.ceil(herdNeeds(b, w.settings).feed);
  }
  return target;
}
export function herdReady(b: Building, settings: Partial<LivestockRules> = {}) {
  const spec = herdSpec(b, settings);
  return (
    !spec ||
    ((b.stock[spec.animal] ?? 0) >= spec.minimum &&
      (b.herdCondition ?? 100) >= livestockRules(settings).livestockGrowthCondition)
  );
}
export function tendHerd(w: World, b: Building, staff: number, at = w.time) {
  const spec = herdSpec(b, w.settings);
  if (!spec) return true;
  const rules = livestockRules(w.settings);
  normalizeYoung(b, at);
  const count = b.stock[spec.animal] ?? 0,
    young = b.stock[spec.youngItem] ?? 0;
  if (!count && !young) {
    b.herdCondition = 100;
    b.youngCareAt = at;
    return false;
  }
  const exact = herdNeeds(b, w.settings),
    needs = herdRation(b, undefined, undefined, w.settings);
  const fed =
    Object.entries(needs).every(([id, n]) => (b.stock[id] ?? 0) >= n) &&
    (!exact.feed || (b.stock.feed ?? 0) + (acceptsHay(b) ? (b.stock.hay ?? 0) : 0) > 0) &&
    (!exact.water || (b.stock.water ?? 0) > 0);
  if (fed) {
    for (const [id, n] of Object.entries(needs)) if (n) b.stock[id] -= n;
    b.herdRationCredit = {
      feed: exact.feed + (b.herdRationCredit?.feed ?? 0) - (needs.feed ?? 0) - (needs.hay ?? 0),
      water: exact.water + (b.herdRationCredit?.water ?? 0) - (needs.water ?? 0),
    };
    addQuantities(accounts(w, b).consumed, needs);
  }
  b.herdCondition = Math.max(
    0,
    Math.min(
      100,
      (b.herdCondition ?? 100) +
        (fed
          ? staff > 0
            ? rules.livestockHealthyGain
            : -rules.livestockUnstaffedLoss
          : -rules.livestockHungryLoss),
    ),
  );
  let loss: string | undefined;
  if (young && b.herdCondition < rules.livestockYoungLossCondition) {
    b.stock[spec.youngItem]--;
    const cohort = b.young!.find((c) => c.item === spec.youngItem && c.count > 0)!;
    cohort.count--;
    loss = spec.young;
  } else if (b.herdCondition === 0 && count && !young) {
    b.stock[spec.animal] = Math.max(0, count - 1);
    b.herdCondition = rules.livestockDeathResetCondition;
    loss = spec.singular;
  }
  if (loss) {
    const owner = b.owner && w.players[b.owner];
    if (owner)
      recordLife(
        w,
        owner,
        {
          kind: 'livestock',
          building: b.id,
          text: `A ${loss} died at ${b.name}. Keep feed, water and qualified care available.`,
        },
        at,
      );
  }
  growYoung(w, b, at, fed && b.herdCondition >= rules.livestockGrowthCondition);
  return fed && herdReady(b, w.settings);
}
/** Ordinary breeding costs, shared by validation, execution and planning. */
export const breedingRation = (b: Building, settings: Partial<LivestockRules> = {}) => {
  const r = livestockRules(settings);
  return herdRation(b, r.livestockBreedingFeed, r.livestockBreedingWater, settings);
};
export function breedingBlocker(w: World, p: import('./types.ts').Player, b: Building) {
  const spec = herdSpec(b, w.settings),
    rules = livestockRules(w.settings);
  if (
    !spec ||
    b.construction ||
    !(b.owner === p.id || p.job === b.id) ||
    !p.skills.includes('livestock farmer')
  )
    return 'The owner or an employed livestock farmer can arrange breeding here';
  if (b.breedingEnd) return 'An offspring is already on the way';
  if (
    (b.stock[spec.animal] ?? 0) < spec.minimum ||
    (b.herdCondition ?? 100) < rules.livestockBreedingCondition
  )
    return `Breeding requires ${spec.minimum} ${spec.animal} and ${rules.livestockBreedingCondition}% herd condition`;
  const ration = breedingRation(b, w.settings);
  if (
    Object.entries(ration).some(([item, n]) => (b.stock[item] ?? 0) < n) ||
    b.investment < spec.fee
  )
    return `Breeding requires ${(ration.hay ?? 0) + (ration.feed ?? 0)} ${acceptsHay(b) ? 'hay or feed' : 'feed'}, ${ration.water} water and ${spec.fee / 100}d investment`;
  if (
    herdShares(b, w.settings) + rules.livestockYoungPastureShare >
    Math.min(b.capacity, pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1))
  )
    return `Not enough grazing area for a ${spec.young}; expand the pasture`;
}
/** Continuous mode retains the NPC owner's existing safety budgets. */
export function npcBreedingBudgetAllows(w: World, b: Building) {
  const spec = herdSpec(b, w.settings),
    budget = npcBusinessRules(w.settings);
  return (
    !!spec &&
    (b.stock[spec.animal] ?? 0) + (b.stock[spec.youngItem] ?? 0) <
      spec.minimum + budget.npcBreedingSpareAnimals &&
    b.investment > budget.npcBreedingCashThreshold &&
    (b.stock.feed ?? 0) + (acceptsHay(b) ? (b.stock.hay ?? 0) : 0) >=
      budget.npcBreedingFeedReserve &&
    (b.stock.water ?? 0) >= budget.npcBreedingWaterReserve
  );
}
export function breedHerd(w: World, p: import('./types.ts').Player, b: Building, at = w.time) {
  const blocker = breedingBlocker(w, p, b);
  if (blocker) throw Error(blocker);
  const spec = herdSpec(b, w.settings)!,
    ration = breedingRation(b, w.settings);
  for (const [item, n] of Object.entries(ration)) if (n) b.stock[item] -= n;
  b.investment -= spec.fee;
  b.breedingEnd = at + spec.seconds;
  addQuantities(accounts(w, b).consumed, ration);
  return spec.fee;
}
export function birthHerd(w: World, b: Building, at: number) {
  if (!b.breedingEnd || at < b.breedingEnd) return;
  const spec = herdSpec(b, w.settings),
    rules = livestockRules(w.settings);
  if (!spec) {
    delete b.breedingEnd;
    return;
  }
  const born =
    (b.stock[spec.animal] ?? 0) >= spec.minimum &&
    (b.herdCondition ?? 100) >= rules.livestockBirthCondition &&
    herdShares(b, w.settings) + rules.livestockYoungPastureShare <=
      Math.min(b.capacity, pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1));
  if (born) {
    b.stock[spec.youngItem] = (b.stock[spec.youngItem] ?? 0) + 1;
    b.young ??= [];
    b.young.push({ item: spec.youngItem, born: at, count: 1, grownDays: 0 });
    addQuantities(accounts(w, b).produced, { [spec.youngItem]: 1 });
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
export function livestockOutputs(
  b: Building,
  outputs: Stock,
  multiplier = 1,
  settings: Partial<LivestockRules> = {},
): Stock {
  const spec = herdSpec(b, settings);
  if (!spec) return outputs;
  const capacity = b.pasture ? pastureCapacity(b, multiplier) : spec.minimum;
  const productive = Math.min(capacity, Math.max(0, b.stock[spec.animal] ?? 0));
  return Object.fromEntries(
    Object.entries(outputs).map(([id, n]) => [id, Math.floor((n * productive) / spec.minimum)]),
  );
}

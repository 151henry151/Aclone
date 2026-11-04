import { farmYieldRules } from './farm-yield-rules';
import { validateFarmPolicy, farmStaffBlocker, recordFarmStaffSpending } from './farm-policy';
import { recordGathered } from './player-statistics.ts';
import { farmPlotCount, farmExpansionCost, farmExpansionBlocker } from './farm-land.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings, items, defaults } from './catalog.ts';
import data from '../../data/crops.json';
import { calendar, DAY_SECONDS, worldWeather } from './environment.ts';
import type { World, Building, Player, Action } from './types.ts';
import { distance, log, say } from './simulation.ts';
export const crops: Record<
  string,
  {
    name: string;
    days: number;
    yield: number;
    seed: number;
    seasons: string[];
    family: string;
    thirst: number;
    frost: number;
    rot: number;
    description: string;
  }
> = data;
/** Imported fertilizer is a fallback; locally produced compost should be cheaper. */
export const fertilizerPrice = buildings.market.sell.compost;
export interface Plot {
  crop?: string;
  planted: number;
  ready: number;
  water: number;
  fertilized: boolean;
  previous?: string;
  drainage?: boolean;
  improved?: boolean;
  winterLoss?: string;
  harvest?: { player: string; amount: number; wage: number };
}
/** First winter boundary after planting; independent of visual clock/weather overrides. */
export function winterDeadline(planted: number) {
  const date = calendar({ time: planted });
  if (date.season === 'Winter') return planted;
  const winterDay = date.absoluteDay - date.dayOfYear + 334;
  return (winterDay - 59 - defaults.time / 86400) * DAY_SECONDS;
}

/** Clear losses even when catch-up skipped the whole winter. Stored produce is unaffected. */
export function expireFarmCrops(w: World, b: Building) {
  for (const [index, plot] of (b.plots ?? []).entries()) {
    if (!plot.crop || w.time < winterDeadline(plot.planted)) continue;
    const worker = plot.harvest && w.players[plot.harvest.player];
    if (worker?.task?.kind === 'harvest' && worker.task.building === b.id) {
      if (worker.task.plots?.includes(index)) {
        worker.task.plots = worker.task.plots.filter((plot) => plot !== index);
        if (!worker.task.plots.length) delete worker.task;
      } else if (worker.task.plot === index) delete worker.task;
    }
    b.plots![index] = {
      planted: 0,
      ready: 0,
      water: 0,
      fertilized: false,
      previous: plot.crop,
      drainage: plot.drainage,
      winterLoss: plot.crop,
    };
  }
}

export function cropStatus(w: World, b: Building, index: number) {
  const p = b.plots?.[index];
  if (!p?.crop) return { state: 'empty', progress: 0, yield: 0, water: 0, days: 0 };
  if (w.time >= winterDeadline(p.planted))
    return { state: 'withered', progress: 0, yield: 0, water: 0, days: 0 };
  const c = crops[p.crop];
  let rain = 0,
    frost = 0;
  const first = calendar({ time: p.planted }).absoluteDay;
  for (let day = 0; day < c.days; day++) {
    const v = worldWeather(w, first + day, 0.5);
    rain += v.precipitation === 'rain' ? 1 : 0;
    frost += v.temperature < 0 ? 1 : 0;
  }
  const moisture = Math.min(1, ((rain / c.days) * 0.9 + 0.25 + p.water * 0.25) / c.thirst);
  const rules = farmYieldRules(w.settings);
  const rotation =
    p.previous && crops[p.previous].family === c.family ? 1 - rules.farmRotationYieldPenalty : 1;
  const late = Math.max(0.65, 1 - Math.max(0, (w.time - p.ready) / DAY_SECONDS - 36) * 0.005);
  return {
    state: w.time >= p.ready ? 'ripe' : 'growing',
    progress: Math.max(0, Math.min(1, (w.time - p.planted) / (p.ready - p.planted))),
    yield: Math.max(
      1,
      Math.floor(
        c.yield *
          (0.6 + 0.4 * moisture) *
          (p.fertilized ? 1 + rules.farmCompostYieldBonus : 1) *
          rotation *
          Math.max(0.35, 1 - (frost / c.days) * c.frost) *
          (p.drainage ? 1 : 1 - Math.max(0, rain / c.days - 0.35) * c.rot) *
          late,
      ),
    ),
    water: moisture,
    days: Math.max(0, Math.ceil((p.ready - w.time) / DAY_SECONDS)),
  };
}

/** One plot's harvest. Harvest all takes half again this long for every plot it cuts. */
export const HARVEST_SECONDS = 15;

export interface HarvestOffer {
  /** Ripe plots this action will reserve, in field order. */
  plots: number[];
  ripe: number;
  percent: number;
  seconds: number;
  note: string;
}

function harvestSeconds(count: number) {
  return (count * HARVEST_SECONDS * 3) / 2;
}

function harvestDuration(seconds: number) {
  return `${seconds} seconds`;
}

/** Ripe plots that fit the stockroom and, for a paid hand, the till. */
export function harvestOffer(w: World, b: Building, p: Player): HarvestOffer {
  const ripe: { index: number; crop: string; amount: number }[] = [];
  for (let index = 0; index < farmPlotCount(b); index++) {
    const plot = b.plots?.[index];
    if (!plot?.crop || plot.harvest) continue;
    if (w.time < plot.ready || w.time >= winterDeadline(plot.planted)) continue;
    ripe.push({ index, crop: plot.crop, amount: cropStatus(w, b, index).yield });
  }
  const wageEach = b.owner !== p.id && b.employees.includes(p.id) ? b.wage : 0;
  let wageLeft = b.investment;
  const room: Record<string, number> = {};
  const taken: typeof ripe = [];
  const heldStorage: typeof ripe = [];
  const heldWages: typeof ripe = [];
  for (const row of ripe) {
    room[row.crop] ??= Math.max(0, b.capacity - (b.stock[row.crop] ?? 0));
    if (row.amount > room[row.crop]) {
      heldStorage.push(row);
      continue;
    }
    if (wageEach > wageLeft) {
      heldWages.push(row);
      continue;
    }
    room[row.crop] -= row.amount;
    wageLeft -= wageEach;
    taken.push(row);
  }
  const ripeYield = ripe.reduce((sum, row) => sum + row.amount, 0);
  const takenYield = taken.reduce((sum, row) => sum + row.amount, 0);
  const share = (amount: number) =>
    ripeYield === 0 ? 0 : amount === ripeYield ? 100 : Math.floor((amount * 100) / ripeYield);
  const percent = share(takenYield);
  const storageYield = takenYield + heldWages.reduce((sum, row) => sum + row.amount, 0);
  const storagePercent = share(storageYield);
  const seconds = harvestSeconds(taken.length);
  const takenCrops = new Set(taken.map((row) => row.crop));
  const names = [...new Set(heldStorage.map((row) => row.crop))].map((crop) =>
    takenCrops.has(crop) ? `Some ${crops[crop].name}` : crops[crop].name,
  );
  const named =
    names.length === 0
      ? ''
      : names.length === 1
        ? `${names[0]} will not fit. `
        : `${names.slice(0, -1).join(', ')} and ${names.at(-1)} will not fit. `;
  let note = '';
  if (ripe.length && !taken.length && heldStorage.length && !heldWages.length)
    note =
      'Storage has room for 0% of the ripe crops. Make room in the stockroom before harvesting all.';
  else if (ripe.length && !taken.length) note = 'Fund harvest wages before harvesting all.';
  else if (taken.length) {
    const time =
      taken.length === ripe.length
        ? `Harvest all takes ${harvestDuration(seconds)}, half again as long as harvesting ${taken.length === 1 ? 'that plot' : 'those plots'} one by one.`
        : `It takes ${harvestDuration(seconds)}, half again as long as harvesting ${taken.length === 1 ? 'that plot' : 'those plots'} one by one.`;
    const storage =
      heldStorage.length > 0
        ? `Storage has room for ${storagePercent}% of the ripe crops (${storageYield} of ${ripeYield} units). ${named}${heldWages.length ? '' : 'Harvest all will take only that share. '}`
        : '';
    const wages =
      heldWages.length > 0
        ? `The till covers wages for ${taken.length} of ${ripe.length} ripe plots. Harvest all will take only those. `
        : '';
    note = `${storage}${wages}${time}`;
  }
  return { plots: taken.map((row) => row.index), ripe: ripe.length, percent, seconds, note };
}

export function farmAction(w: World, p: Player, b: Building, a: Action) {
  const check = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  check(b.kind === 'farm' && !b.construction && distance(p, b) < 18, 'Visit a completed farm');
  check(
    b.owner === p.id || (w.settings.jobsEnabled !== false && b.employees.includes(p.id)),
    'Only the farmer or farm staff can tend plots',
  );
  if (a.operation === 'policy') {
    check(b.owner === p.id, 'Only the farm owner can set staff rules');
    if (a.policy === null) delete b.farmPolicy;
    else b.farmPolicy = validateFarmPolicy(a.policy);
    return 'Farm staff rules saved.';
  }
  if (a.operation === 'expand') {
    check(b.owner === p.id, 'Only the owner can buy more farmland');
    check(!p.task, 'Finish your current activity first');
    const blocker = farmExpansionBlocker(w, b);
    check(!blocker, blocker ?? 'Cannot expand here');
    const cost = farmExpansionCost(b);
    check(p.cash >= cost, 'Not enough personal cash to buy this parcel');
    p.cash -= cost;
    b.farmPlots = farmPlotCount(b) + 4;
    b.plots = Array.from(
      { length: b.farmPlots },
      (_, i) => b.plots?.[i] ?? { planted: 0, ready: 0, water: 0, fertilized: false },
    );
    b.price += cost;
    b.farmLandCost = (b.farmLandCost ?? 0) + cost;
    log(w, 'sink', cost, p.id, 'land-registry', 'farm land purchase');
    return `Purchased four more plots; this farm now has ${b.farmPlots}.`;
  }
  if (a.operation === 'harvestAll') {
    check(p.skills.includes('farmer'), 'Learn Farmer at the school');
    check(!p.task, 'Finish your current task first');
    expireFarmCrops(w, b);
    const offer = harvestOffer(w, b, p);
    check(offer.plots.length > 0, offer.note);
    const wage = b.owner !== p.id && b.employees.includes(p.id) ? b.wage : 0;
    for (const index of offer.plots) {
      const plot = b.plots![index];
      plot.harvest = { player: p.id, amount: cropStatus(w, b, index).yield, wage };
    }
    p.task = { kind: 'harvest', building: b.id, plots: offer.plots, end: w.time + offer.seconds };
    p.speed = 0;
    return offer.note;
  }
  check(p.skills.includes('farmer'), 'Learn Farmer at the school');
  check(typeof a.plot === 'number', 'Choose a plot');
  const index = a.plot as number;
  check(Number.isInteger(index) && index >= 0 && index < farmPlotCount(b), 'Choose a plot');
  check(!p.task, 'Finish your current task first');
  expireFarmCrops(w, b);
  const old = b.plots?.[index],
    op = a.operation;
  check(!old?.harvest, 'Someone is already harvesting this plot');
  // Staff may consume supplies for farm work, never withdraw them personally.
  const available = (item: string) => (b.stock[item] ?? 0) + (p.inventory[item] ?? 0);
  const consume = (item: string, n: number) => {
    const stored = Math.min(n, b.stock[item] ?? 0);
    if (stored) b.stock[item] -= stored;
    if (n > stored) p.inventory[item] = (p.inventory[item] ?? 0) - (n - stored);
  };
  if (op === 'drain' || op === 'improve') {
    check(old && !old!.crop, 'Improve an empty plot after its first harvest');
    if (op === 'drain') {
      check(
        !old!.drainage && available('gravel') >= 6,
        'Stock or carry six gravel; drainage is permanent',
      );
      consume('gravel', 6);
      old!.drainage = true;
    } else {
      check(
        !old!.improved && available('dirt') >= 6 && available('compost') >= 1,
        'Stock or carry six topsoil and one compost; improve once between crops',
      );
      consume('dirt', 6);
      consume('compost', 1);
      delete old!.previous;
      old!.improved = true;
    }
    return;
  }
  if (op === 'plant') {
    const key = String(a.crop),
      c = crops[key];
    check(Object.hasOwn(crops, key), 'Unknown crop');
    check(!old?.crop, 'Harvest this plot first');
    check(c.seasons.includes(calendar(w).season), 'Wrong planting season');
    const blocked = farmStaffBlocker(w, p, b, c.seed, key);
    check(!blocked, blocked ?? 'Staff planting is restricted');
    check(b.investment >= c.seed, 'Fund the farm investment account for seeds');
    recordFarmStaffSpending(w, p, b, c.seed);
    b.investment -= c.seed;
    log(w, 'sink', c.seed, b.id, 'seed merchant', 'crop seed');
    b.plots ??= Array.from({ length: farmPlotCount(b) }, () => ({
      planted: 0,
      ready: 0,
      water: 0,
      fertilized: false,
    }));
    b.plots[index] = {
      crop: key,
      planted: w.time,
      ready: w.time + c.days * DAY_SECONDS,
      water: 0,
      fertilized: false,
      previous: old?.previous,
      drainage: old?.drainage,
    };
    b.sell[key] ??= buildings.farm.sell[key] ?? items[key].price;
    return;
  }
  check(old?.crop, 'This plot is empty');
  const plot = old!;
  if (op === 'water') {
    check(w.time < plot.ready, 'This crop is already ripe');
    check(plot.water < 3, 'This plot has enough irrigation');
    check(available('water') >= 3, 'Stock or carry three water');
    consume('water', 3);
    plot.water++;
  } else if (op === 'fertilize') {
    check(w.time < plot.ready && !plot.fertilized, 'Fertilize once during growth');
    if (available('compost') > 0) consume('compost', 1);
    else {
      check(
        b.investment >= fertilizerPrice,
        `Stock or carry compost or fund ${fertilizerPrice / 100}d of fertilizer`,
      );
      const blocked = farmStaffBlocker(w, p, b, fertilizerPrice);
      check(!blocked, blocked ?? 'Staff spending is restricted');
      recordFarmStaffSpending(w, p, b, fertilizerPrice);
      b.investment -= fertilizerPrice;
      log(w, 'sink', fertilizerPrice, b.id, 'merchant', 'fertilizer');
    }
    plot.fertilized = true;
  } else if (op === 'harvest') {
    check(w.time >= plot.ready, 'The crop is not ripe yet');
    const n = cropStatus(w, b, index).yield,
      key = plot.crop!;
    check((b.stock[key] ?? 0) + n <= b.capacity, 'Make room in the stockroom');
    const wage = b.owner !== p.id && b.employees.includes(p.id) ? b.wage : 0;
    check(b.investment >= wage, 'Fund harvest wages first');
    plot.harvest = { player: p.id, amount: n, wage };
    p.task = { kind: 'harvest', building: b.id, plot: index, end: w.time + HARVEST_SECONDS };
    p.speed = 0;
  } else throw Error('Unknown farm operation');
}

export function finishHarvest(w: World, p: Player, building: string, index: number, at = w.time) {
  const b = w.buildings.find((b) => b.id === building),
    plot = b?.plots?.[index];
  if (!b || !plot?.crop || plot.harvest?.player !== p.id) return;
  // A pre-winter completion still counts when the server catches up past the deadline.
  if (at >= winterDeadline(plot.planted)) return;
  const { amount } = plot.harvest;
  const wage = b.owner === p.id ? 0 : plot.harvest.wage;
  delete plot.harvest;
  if (
    (b.owner !== p.id && (w.settings.jobsEnabled === false || !b.employees.includes(p.id))) ||
    b.investment < wage ||
    (b.stock[plot.crop] ?? 0) + amount > b.capacity
  ) {
    say(
      w,
      'Farm',
      'Harvest paused: check permission, stockroom space and wages. The crop is still here.',
      'system',
      p.id,
    );
    return;
  }
  b.stock[plot.crop] = (b.stock[plot.crop] ?? 0) + amount;
  recordGathered(w, p, plot.crop, amount, true);
  if (wage) {
    const tax = Math.floor(wage * w.settings.wageTax);
    b.investment -= wage;
    p.cash += wage - tax;
    log(w, 'transfer', wage - tax, b.id, p.id, 'harvest wage');
    log(w, 'sink', tax, b.id, 'treasury', 'wage tax');
  }
  p.kudos++;
  b.plots![index] = {
    planted: 0,
    ready: 0,
    water: 0,
    fertilized: false,
    previous: plot.crop,
    drainage: plot.drainage,
  };
  say(w, 'Farm', `${p.name} harvested ${amount} ${plot.crop}.`);
}

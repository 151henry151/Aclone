// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings, items } from './catalog.ts';
import data from '../../data/crops.json';
import { calendar, DAY_SECONDS, weatherAt } from './environment.ts';
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
  harvest?: { player: string; amount: number; wage: number };
}
export function cropStatus(w: World, b: Building, index: number) {
  const p = b.plots?.[index];
  if (!p?.crop) return { state: 'empty', progress: 0, yield: 0, water: 0, days: 0 };
  const c = crops[p.crop];
  let rain = 0,
    frost = 0;
  const first = calendar({ time: p.planted }).absoluteDay;
  for (let day = 0; day < c.days; day++) {
    const v = weatherAt(w.id, first + day);
    rain += v.precipitation === 'rain' ? 1 : 0;
    frost += v.temperature < 0 ? 1 : 0;
  }
  const moisture = Math.min(1, ((rain / c.days) * 0.9 + 0.25 + p.water * 0.25) / c.thirst);
  const rotation = p.previous && crops[p.previous].family === c.family ? 0.8 : 1;
  const late = Math.max(0.65, 1 - Math.max(0, (w.time - p.ready) / DAY_SECONDS - 36) * 0.005);
  return {
    state: w.time >= p.ready ? 'ripe' : 'growing',
    progress: Math.max(0, Math.min(1, (w.time - p.planted) / (p.ready - p.planted))),
    yield: Math.max(
      1,
      Math.floor(
        c.yield *
          (0.6 + 0.4 * moisture) *
          (p.fertilized ? 1.33 : 1) *
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
export function farmAction(w: World, p: Player, b: Building, a: Action) {
  const check = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  check(b.kind === 'farm' && !b.construction && distance(p, b) < 18, 'Visit a completed farm');
  check(
    b.owner === p.id || b.employees.includes(p.id),
    'Only the farmer or farm staff can tend plots',
  );
  check(p.skills.includes('farmer'), 'Learn Farmer at the school');
  check(typeof a.plot === 'number', 'Choose a plot');
  const index = a.plot as number;
  check(Number.isInteger(index) && index >= 0 && index < 4, 'Choose a plot');
  check(!p.task, 'Finish your current task first');
  const old = b.plots?.[index],
    op = a.operation;
  check(!old?.harvest, 'Someone is already harvesting this plot');
  if (op === 'drain' || op === 'improve') {
    check(old && !old!.crop, 'Improve an empty plot after its first harvest');
    const stock = p.inventory;
    if (op === 'drain') {
      check(!old!.drainage && (stock.gravel ?? 0) >= 6, 'Carry six gravel; drainage is permanent');
      stock.gravel -= 6;
      old!.drainage = true;
    } else {
      check(
        !old!.improved && (stock.dirt ?? 0) >= 6 && (stock.compost ?? 0) >= 1,
        'Carry six topsoil and one compost; improve once between crops',
      );
      stock.dirt -= 6;
      stock.compost -= 1;
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
    check(b.investment >= c.seed, 'Fund the farm investment account for seeds');
    b.investment -= c.seed;
    log(w, 'sink', c.seed, b.id, 'seed merchant', 'crop seed');
    b.plots ??= Array.from({ length: 4 }, () => ({
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
    check((p.inventory.water ?? 0) >= 3, 'Carry three water');
    p.inventory.water -= 3;
    plot.water++;
  } else if (op === 'fertilize') {
    check(w.time < plot.ready && !plot.fertilized, 'Fertilize once during growth');
    if ((p.inventory.compost ?? 0) > 0) p.inventory.compost--;
    else {
      check(
        b.investment >= fertilizerPrice,
        `Carry compost or fund ${fertilizerPrice / 100}d of fertilizer`,
      );
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
    p.task = { kind: 'harvest', building: b.id, plot: index, end: w.time + 15 };
    p.speed = 0;
  } else throw Error('Unknown farm operation');
}

export function finishHarvest(w: World, p: Player, building: string, index: number) {
  const b = w.buildings.find((b) => b.id === building),
    plot = b?.plots?.[index];
  if (!b || !plot?.crop || plot.harvest?.player !== p.id) return;
  const { amount } = plot.harvest;
  const wage = b.owner === p.id ? 0 : plot.harvest.wage;
  delete plot.harvest;
  if (
    (b.owner !== p.id && !b.employees.includes(p.id)) ||
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

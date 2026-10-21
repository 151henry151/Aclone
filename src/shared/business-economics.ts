// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog';
import { worldItems } from './world-catalogue';
import { livestockSupplyInputs, herdSpec } from './livestock';
import { productionStaffing, productionEfficiency } from './sound-state';
import { productionInterval } from './simulation';
import { staffingEfficiency } from './staffing';
import { salesReceipt } from './taxes';
import type { World, Building } from './types';

export const ECONOMICS_ASSUMPTIONS =
  'Potential operating contribution if every output sells at current posted prices and inputs are replenished at the listed bids (saved bids/catalogue when closed). Sales taxes included; wages paid per completed batch. Excludes repairs, rent, finance, travel and unsold stock. One batch-sized sale per output is assumed; transaction rounding can differ.';

/** Conditional replacement-cost estimate, NOT recorded profit or guaranteed sales. */
export function businessEconomics(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm') return null;
  const crew = b.staffing ?? productionStaffing(w, b);
  const paid = Math.max(0, crew.active - Number(crew.ownerOperating));
  const inputCosts = Object.entries(livestockSupplyInputs(w, b, recipe.inputs)).map(([id, n]) => ({
    item: id,
    quantity: n,
    price: b.buy[id] || b.pausedPrices?.buy?.[id] || worldItems(w)[id]?.price || 0,
    estimated: b.buy[id] === undefined,
  }));
  const inputs = inputCosts.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const outputs = Object.entries(recipe.outputs);
  const unlisted = outputs.filter(([id]) => b.sell[id] === undefined).map(([id]) => id);
  const gross = outputs.reduce((sum, [id, n]) => sum + n * (b.sell[id] ?? 0), 0);
  const revenue = outputs.reduce(
    (sum, [id, n]) => sum + salesReceipt(w, b, n * (b.sell[id] ?? 0)).net,
    0,
  );
  const interval = productionInterval(w, b);
  const scenario = (workers: number) => {
    const total = workers + Number(crew.ownerOperating);
    const efficiency = total
      ? staffingEfficiency(total, crew.ideal)
      : b.government
        ? 1
        : w.settings.offlineEfficiency;
    const payroll = workers * b.wage;
    const margin = revenue - inputs - payroll;
    return {
      paidWorkers: workers,
      ownerOperating: crew.ownerOperating,
      efficiency,
      payroll,
      margin,
      batchesPerHour: (efficiency * 3600) / interval,
      profitPerHour: (margin * efficiency * 3600) / interval,
    };
  };
  const current = scenario(paid);
  const scenarios = [...new Set([paid, ...Array.from({ length: crew.ideal + 1 }, (_, n) => n)])]
    .sort((a, b) => a - b)
    .map(scenario);
  const animal = !!herdSpec(b);
  return {
    gross,
    revenue,
    inputs,
    inputCosts,
    unlisted,
    intervalSeconds: interval,
    ideal: crew.ideal,
    current,
    scenarios,
    bestPaidWorkers:
      animal || unlisted.length
        ? null
        : (scenarios
            .filter((s) => s.paidWorkers + Number(crew.ownerOperating) > 0)
            .sort((a, b) => b.profitPerHour - a.profitPerHour || a.paidWorkers - b.paidWorkers)[0]
            ?.paidWorkers ?? null),
    actualEfficiency: productionEfficiency(w, b, paid),
    basis: ECONOMICS_ASSUMPTIONS,
    hourlyReliable: !animal && !unlisted.length,
    caveat: animal
      ? 'Livestock upkeep is charged on production checks, including checks without output; these batch figures are not a full livestock hourly forecast.'
      : unlisted.length
        ? 'Some outputs have no sale listing; revenue is incomplete.'
        : null,
  };
}

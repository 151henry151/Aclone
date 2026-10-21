// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog';
import { worldItems } from './world-catalogue';
import { productionStaffing } from './sound-state';
import { cashFlow, productionReport } from './reports';
import { livestockSupplyInputs } from './livestock';
import type { Building, World } from './types';

/** A diagnosis, not a promise of customers or an appraisal of realizable wealth.
 * Reads only this building's stock/accounts and the world's public catalogue. */
export function businessHealth(w: World, b: Building) {
  const catalogue = worldItems(w);
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  const crew = b.staffing ?? productionStaffing(w, b);
  const payroll = Math.max(0, crew.active - Number(crew.ownerOperating)) * b.wage;
  const inputs = Object.entries(recipe ? livestockSupplyInputs(w, b, recipe.inputs) : {});
  const outputs = Object.entries(recipe?.outputs ?? {});
  const inputBatches = inputs.length
    ? Math.min(...inputs.map(([id, n]) => Math.floor((b.stock[id] ?? 0) / n)))
    : null;
  const outputRoom = outputs.length
    ? Math.max(
        0,
        Math.min(...outputs.map(([id, n]) => Math.floor((b.capacity - (b.stock[id] ?? 0)) / n))),
      )
    : null;
  const replacementInputs = inputs.reduce(
    (sum, [id, n]) =>
      sum + n * (b.buy[id] || b.pausedPrices?.buy?.[id] || catalogue[id]?.price || 0),
    0,
  );
  const a = b.accounts;
  const elapsed = a ? Math.max(0, w.time - a.since) : 0;
  const flow = a ? cashFlow(a) : null;
  const sales = Object.values(a?.sold ?? {}).reduce((sum, n) => sum + n, 0);
  const stockReferenceValue = Object.entries(b.stock).reduce(
    (sum, [id, n]) => sum + n * (catalogue[id]?.price ?? 0),
    0,
  );
  const messages = [...(b.productionStatus ?? productionReport(w, b))];
  if (
    a &&
    elapsed >= 3600 &&
    outputs.some(([id]) => (b.stock[id] ?? 0) > 0) &&
    !outputs.some(([id]) => (a.sold[id] ?? 0) > 0)
  )
    messages.push(
      'Output is stored but no output sales have been recorded; find buyers before buying more inputs.',
    );
  if (flow !== null && flow < 0)
    messages.push(
      'Lifetime operating cash flow is negative. This includes past input purchases; it does not show current till cash or prove that current production loses money.',
    );
  return {
    messages,
    crew,
    payroll,
    inputBatches,
    outputRoom,
    replacementInputs,
    fundedReplacementBatches:
      replacementInputs + payroll > 0
        ? Math.floor(b.investment / (replacementInputs + payroll))
        : null,
    operatingCashFlow: flow,
    capitalAdded: a?.capitalIn ?? 0,
    capitalWithdrawn: a?.capitalOut ?? 0,
    financingIn: a?.financingIn ?? 0,
    financingOut: a?.financingOut ?? 0,
    stockReferenceValue,
    observedSalesPerHour: elapsed >= 300 ? (sales * 3600) / elapsed : null,
    cashRunwayHours:
      elapsed >= 300 && flow !== null && flow < 0
        ? b.investment / ((-flow * 3600) / elapsed)
        : null,
    basis:
      'Lifetime recorded cash flow and unit sales, not a demand forecast. Stock value uses catalogue prices, not guaranteed proceeds. Replacement costs use posted bids or catalogue estimates when bids are closed.',
  };
}

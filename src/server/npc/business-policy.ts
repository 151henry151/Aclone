import { businessEconomics } from '../../shared/business-economics.ts';
import { journeyEstimate } from './projects.ts';
import { travelVehicle } from './travel.ts';
import { hiringLimit } from '../../shared/staffing.ts';
import { settleBusinessProceeds } from './business-freight.ts';
import { farmPlotCount } from '../../shared/farm-land.ts';
import { livestockSupplyInputs, herdSpec } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../../shared/types.ts';
import { worldBuildings } from '../../shared/world-catalogue.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { crops } from '../../shared/farming.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { portableReserve } from './cargo.ts';
import { recipes } from '../../shared/catalog.ts';
import {
  productionStaff,
  productionStaffing,
  productionEfficiency,
} from '../../shared/sound-state.ts';
import { salesReceipt } from '../../shared/taxes.ts';
import { productionInterval, distance, canCarry } from '../../shared/simulation.ts';
import { household, householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import { blockedStep } from './recovery.ts';
import type { ResidentState } from './memory.ts';
import type { Step } from './decision.ts';
import { operation } from './player-operations.ts';

/** Keep raw materials separate from finished stock. Ordinary shelf stock is not
 * a reason to close the supply chain. Proven sales increase the working buffer;
 * genuinely backed-up joint outputs stop further purchases before storage fills. */
export function inputStockTarget(b: Building, item: string, w?: World) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm' || herdSpec(b) || !recipe.inputs[item]) return undefined;
  const outputs = Object.entries(recipe.outputs);
  if (!outputs.length) return undefined;
  const hours = w && b.accounts ? Math.max(1, (w.time - b.accounts.since) / 3600) : 1;
  const salesBatches = Math.min(
    ...outputs.map(([id, n]) => (w ? (b.accounts?.sold[id] ?? 0) / hours / n : 0)),
  );
  const batches = Math.min(24, Math.max(6, Math.ceil(salesBatches * 2)));
  if (
    outputs.some(
      ([id, n]) => (b.stock[id] ?? 0) >= Math.min(b.capacity * 0.75, Math.max(12, batches * 2) * n),
    )
  )
    return 0;
  const room = Math.min(
    ...outputs.map(([id, n]) => Math.floor((b.capacity - (b.stock[id] ?? 0)) / n)),
  );
  return Math.max(0, Math.min(b.capacity, Math.min(batches, room) * recipe.inputs[item]));
}

/** Supplies may be bought directly as well as through a posted bid. Include
 * livestock feed and replacement breeding animals in that shared stock limit. */
export function procurementTarget(w: World, b: Building, item: string) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe) return 0;
  const herd = herdSpec(b);
  return Math.min(
    b.capacity,
    inputStockTarget(b, item, w) ??
      (herd?.animal === item
        ? herd.minimum
        : (livestockSupplyInputs(w, b, recipe.inputs)[item] ?? 0) * 6),
  );
}

/** Cash earmarked for inputs can become those inputs, but may not consume the
 * remaining operating reserve. Plans and execution use the same calculation. */
export function procurementDraw(
  w: World,
  p: Player,
  b: Building,
  item: string,
  quantity: number,
  price: number,
) {
  if (quantity <= 0 || price < 0 || quantity > procurementTarget(w, b, item) - (b.stock[item] ?? 0))
    return;
  const draw = Math.max(
    0,
    quantity * price - Math.max(0, p.cash - householdBudget(w, p, 86400).reserve),
  );
  const supplied = { ...b, stock: { ...b.stock, [item]: (b.stock[item] ?? 0) + quantity } };
  const available = Math.min(
    10_000_000,
    ownerWithdrawable(w, b),
    Math.max(0, b.investment - remainingClaim(b) - retainedCapital(w, supplied)),
  );
  if (draw <= available) return draw;
}

/** The same quote powers maintenance and experiments. Only observed suppliers
 * count; never fabricate a source or pay an uneconomic bid to force activity. */
export function inputBidQuote(w: World, p: Player, b: Building, item: string, remembered = 0) {
  const target = inputStockTarget(b, item, w);
  if (!target || (b.stock[item] ?? 0) >= target) return;
  const viable = (price: number) => {
    const budget = productionBudget(w, { ...b, buy: { ...b.buy, [item]: price } });
    return budget && budget.margin >= 0 && budget.idealMargin > 0;
  };
  const quotes = w.buildings
    .flatMap((s) => {
      if (s.id === b.id || s.construction || !(s.stock[item] > 0) || !(s.sell[item] > 0)) return [];
      const carrier = { ...p, x: s.x, z: s.z, vehicle: travelVehicle(p), inventory: {} };
      let load = Math.min(target - (b.stock[item] ?? 0), s.stock[item]);
      while (load > 0 && !canCarry(carrier, item, load, w)) load--;
      if (!load) return [];
      const trip = journeyEstimate(w, carrier, [b, s]);
      const allowance = Math.max(
        Math.ceil(s.sell[item] * 0.08),
        Math.ceil((trip.cost + trip.seconds * 5) / load),
        100,
      );
      const price = Math.max(100, s.sell[item] + allowance);
      return price <= 10_000_000 && viable(price)
        ? [{ price, supplier: s.id, load, allowance }]
        : [];
    })
    .sort((a, b) => a.price - b.price);
  if (quotes.length) return quotes[0];
  // A remembered quote remains usable when no stocked source is known. If a
  // source IS known but delivery cannot be profitable, don't advertise a dud route.
  const knownSource = w.buildings.some(
    (s) => s.id !== b.id && !s.construction && s.stock[item] > 0 && s.sell[item] > 0,
  );
  if (!knownSource && remembered > 0 && viable(remembered))
    return { price: remembered, supplier: undefined, load: 0, allowance: 0 };
}

/** Manage paid bids through the same administration action as a human owner.
 * Suspended bids accept no deliveries and retain their previous price. */
export function ownerBidRoutine(w: World, p: Player, state: ResidentState): Step[] {
  if (state.pausedInputBids?.world !== w.id || state.pausedInputBids.deaths !== p.deaths)
    state.pausedInputBids = { world: w.id, deaths: p.deaths, bids: {} };
  const owned = w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government);
  const validKeys = new Set(
    owned.flatMap((b) =>
      [
        ...new Set([
          ...Object.keys(b.buy),
          ...Object.keys(b.pausedPrices?.buy ?? {}),
          ...Object.keys((b.production ?? recipes[b.recipe ?? ''])?.inputs ?? {}),
        ]),
      ].map((item) => `${b.id}:${item}`),
    ),
  );
  for (const key of Object.keys(state.pausedInputBids.bids))
    if (!validKeys.has(key)) delete state.pausedInputBids.bids[key];
  for (const key of Object.keys(state.pausedInputBids.manual ?? {}))
    if (!validKeys.has(key)) delete state.pausedInputBids.manual![key];
  for (const b of owned) {
    for (const item of Object.keys((b.production ?? recipes[b.recipe ?? ''])?.inputs ?? {})) {
      const target = inputStockTarget(b, item, w);
      if (target === undefined) continue;
      const key = `${b.id}:${item}`,
        stock = b.stock[item] ?? 0;
      const bid = b.buy[item] ?? 0;
      if (state.pausedInputBids.manual?.[key]) {
        // An explicit agreed pause survives routine maintenance and restarts.
        if (bid === 0) continue;
        delete state.pausedInputBids.manual[key];
      }
      if (bid > 0 && stock >= target) {
        state.pausedInputBids.bids[key] = bid;
        return visitBuilding(p, b, [
          operation('buildingAdmin', { building: b.id, item, side: 'buy', enabled: false }),
        ]);
      }
      // Forget a completed reopening, including a later manual price change.
      if (bid > 0) delete state.pausedInputBids.bids[key];
      // Hysteresis avoids changing the price after every single consumed unit.
      const remembered = state.pausedInputBids.bids[key] || b.pausedPrices?.buy?.[item] || 0;
      const quote = inputBidQuote(w, p, b, item, remembered || bid);
      if (quote && stock < target / 2 && (bid === 0 || bid < quote.price)) {
        const proposed = { ...b, buy: { ...b.buy, [item]: quote.price } };
        const budget = productionBudget(w, proposed)!;
        const funding = Math.max(0, budget.reserve + remainingClaim(b) - b.investment);
        const deposit = Math.min(
          10_000_000,
          funding,
          Math.max(0, p.cash - householdBudget(w, p).reserve),
        );
        // A published bid needs cash for a useful delivery and protected payroll.
        const minimum =
          quote.price * Math.max(1, quote.load) +
          b.wage * Math.max(budget.idealWorkers, budget.activeWorkers) * 3;
        if (b.investment + deposit - remainingClaim(b) < minimum) continue;
        return visitBuilding(p, b, [
          ...(deposit > 0
            ? [
                {
                  kind: 'act' as const,
                  action: {
                    type: 'investment' as const,
                    building: b.id,
                    direction: 'deposit' as const,
                    amount: deposit,
                  },
                },
              ]
            : []),
          operation('buildingAdmin', { building: b.id, item, side: 'buy', price: quote.price }),
        ]);
      }
    }
  }
  return [];
}

/** Separate shop retail receipts from direct wholesale export. Tax is withheld
 * from shop receipts, not added to a player's posted purchase price. */
export function productionBudget(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm') return;
  const inputs = Object.entries(livestockSupplyInputs(w, b, recipe.inputs)).reduce(
    (sum, [item, n]) =>
      sum + n * (b.buy[item] || b.pausedPrices?.buy?.[item] || worldItems(w)[item]?.price || 0),
    0,
  );
  const retailReceipts = Object.entries(recipe.outputs).reduce(
    (sum, [item, n]) => sum + salesReceipt(w, b, n * (b.sell[item] ?? 0)).net,
    0,
  );
  const next = (Math.floor(w.time / productionInterval(w, b)) + 1) * productionInterval(w, b);
  const staff = productionStaff(w, b, next).length;
  const payroll = b.wage * staff;
  const idealWorkers = productionStaffing(w, b, staff, next).ideal;
  return {
    inputs,
    retailReceipts,
    payroll,
    margin: retailReceipts - inputs - payroll,
    oneWorkerMargin: retailReceipts - inputs - b.wage,
    reserve: Math.ceil(
      Object.entries(livestockSupplyInputs(w, b, recipe.inputs)).reduce(
        (sum, [item, n]) =>
          sum +
          Math.max(0, (inputStockTarget(b, item, w) ?? n * 6) - (b.stock[item] ?? 0)) *
            (b.buy[item] || b.pausedPrices?.buy?.[item] || worldItems(w)[item]?.price || 0),
        0,
      ) +
        b.wage * Math.max(idealWorkers, staff) * 6,
    ),
    activeWorkers: staff,
    idealWorkers,
    idealMargin:
      retailReceipts -
      inputs -
      b.wage *
        Math.max(0, idealWorkers - Number(productionStaffing(w, b, staff, next).ownerOperating)),
    economics: businessEconomics(w, b),
    efficiency: productionEfficiency(w, b, staff, next),
  };
}
/** Renew useful workers; fill vacancies only up to the ideal active crew. Farms
 * have independent manual tasks rather than an automatic batch-efficiency curve. */
export function usefulShift(w: World, p: Player, b: Building) {
  if (b.kind === 'farm') return true;
  const interval = productionInterval(w, b),
    next = (Math.floor(w.time / interval) + 1) * interval;
  const staff = productionStaff(w, b, next);
  const index = staff.findIndex((q) => q.id === p.id);
  const current = productionStaffing(w, b, staff.length, next);
  if (index >= 0) return index < current.ideal - Number(current.ownerOperating);
  const others = staff.length;
  const crew = productionStaffing(w, b, others, next);
  return crew.active < crew.ideal;
}

/** Keep enough cash in the business before paying its owner for household needs. */
export function retainedCapital(w: World, b: Building) {
  if (b.kind === 'haybarn') return Math.max(2000, 40 * (b.buy.hay ?? 0));
  return b.kind === 'farm'
    ? farmPlotCount(b) * Math.max(b.wage, ...Object.values(crops).map((c) => c.seed + b.wage))
    : (productionBudget(w, b)?.reserve ?? Math.max(2000, b.wage * 3));
}
export function ownerLivingDraw(w: World, p: Player, b: Building) {
  if (b.owner !== p.id || b.construction || b.government) return 0;
  let target = householdBudget(w, p, 86400).reserve;
  // A viable owner needs somewhere to live. Save toward a modest cottage rather
  // than reinvesting every penny forever; this is a savings target, not a quote.
  const home = worldBuildings(w).home;
  if (!household(w, p) && home)
    target +=
      home.price +
      Object.entries(home.materials ?? {}).reduce(
        (n, [id, quantity]) => n + quantity * (worldItems(w)[id]?.price ?? 0),
        0,
      );
  return Math.min(
    10_000_000,
    Math.max(0, target - p.cash),
    ownerWithdrawable(w, b),
    Math.max(0, b.investment - remainingClaim(b) - retainedCapital(w, b)),
  );
}

/** Maintain a solvent business before discretionary personal spending. */
export function ownerRoutine(w: World, p: Player, state?: ResidentState): Step[] {
  if (p.task || p.learning) return [];
  const bids = state ? ownerBidRoutine(w, p, state) : [];
  if (bids.length) return bids;
  const staffing = ownerStaffingRoutine(w, p);
  if (staffing.length) return staffing;
  const settlement = state ? settleBusinessProceeds(w, p, state) : [];
  if (settlement.length) return settlement;
  const living = householdBudget(w, p).reserve;
  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    const draw = ownerLivingDraw(w, p, b);
    if (draw > 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'withdraw', amount: draw },
        },
      ]);
    const budget = productionBudget(w, b);
    if (!budget) continue;
    // Never pour fresh capital into production with a structurally negative margin.
    const amount = Math.min(
      10_000_000,
      Math.max(0, budget.reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (amount > 0 && budget.idealMargin >= 0 && budget.margin >= 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'deposit', amount },
        },
      ]);
  }
  return [];
}

/** Unload surplus provisions, or ordinary freight that prevents buying a meal.
 * Uses known buyers/owned storage; keeps tools and emergency supplies. */
export function cargoRelief(w: World, p: Player, state?: ResidentState): Step[] {
  const catalogue = worldItems(w);
  const crowded = !canCarry(p, 'water', 2, w) || !canCarry(p, 'bread', 1, w);
  const candidates = Object.entries(p.inventory)
    .flatMap(([item, count]) => {
      const def = catalogue[item];
      if (!def || !count) return [];
      const keep = portableReserve(item, w);
      const excess = count - keep;
      if (excess <= 0 || (!crowded && (!(def.food || def.drink) || excess < 3))) return [];
      return [{ item, excess, weight: def.weight }];
    })
    .sort((a, b) => b.weight * b.excess - a.weight * a.excess);
  for (const { item, excess } of candidates) {
    const candidates = w.buildings
      .filter(
        (b) =>
          !b.construction &&
          !blockedStep(state?.recovery, { kind: 'travel', destination: b.id }, w.time) &&
          (b.stock[item] ?? 0) < b.capacity &&
          (b.owner === p.id || (b.buy[item] > 0 && b.investment >= b.buy[item])),
      )
      .sort((a, b) => distance(p, a) - distance(p, b));
    const b = candidates[0];
    if (!b) continue;
    const own = b.owner === p.id;
    const n = Math.min(
      excess,
      20,
      b.capacity - (b.stock[item] ?? 0),
      own ? Infinity : Math.floor(b.investment / b.buy[item]),
    );
    if (n > 0)
      return visitBuilding(p, b, [
        {
          kind: 'act',
          action: own
            ? { type: 'stock', building: b.id, item, quantity: n, direction: 'deposit' }
            : { type: 'trade', building: b.id, item, quantity: n, direction: 'sell' },
        },
      ]);
  }
  return [];
}

/** Manage paid places by hourly contribution, never batch margin alone. */
export function ownerStaffingRoutine(w: World, p: Player): Step[] {
  if (p.task || p.learning) return [];
  if (w.settings.ownerOperation && w.settings.activeWork) {
    for (const b of w.buildings.filter(
      (b) => b.owner === p.id && !b.construction && !b.government && b.kind !== 'farm',
    )) {
      const recipe = b.production ?? recipes[b.recipe ?? ''];
      const next = (Math.floor(w.time / productionInterval(w, b)) + 1) * productionInterval(w, b);
      if (
        recipe &&
        p.skills.includes(recipe.skill) &&
        (b.ownerActiveUntil ?? -1) < next &&
        Object.entries(recipe.inputs).every(([id, n]) => (b.stock[id] ?? 0) >= n) &&
        Object.entries(recipe.outputs).every(([id, n]) => (b.stock[id] ?? 0) + n <= b.capacity)
      )
        return visitBuilding(p, b, [{ kind: 'act', action: { type: 'work', building: b.id } }]);
    }
  }
  if (w.settings.jobsEnabled === false) return [];
  for (const b of w.buildings.filter((b) => b.owner === p.id && !b.construction && !b.government)) {
    const e = businessEconomics(w, b);
    if (!e || e.bestPaidWorkers === null) continue;
    // Do not optimize a loss-making line into an empty speculation business.
    const best = e.scenarios.find((s) => s.paidWorkers === e.bestPaidWorkers)!;
    const target =
      best.profitPerHour > 0
        ? best.paidWorkers
        : Math.max(0, e.ideal - Number(e.current.ownerOperating));
    const excess = b.employees.slice(target).filter((id) => !w.players[id]?.task);
    const steps: Step[] = [];
    if (hiringLimit(w, b) !== target)
      steps.push(operation('staffing', { building: b.id, limit: target }));
    for (const id of excess) steps.push(operation('staffing', { building: b.id, dismiss: id }));
    // Fill vacancies with a competitive, affordable offer. Never ratchet wages
    // upward on every review or assume staff will appear without a funded job.
    const budget = productionBudget(w, b);
    if (target > b.employees.length && budget && best.profitPerHour > 0) {
      const recipe = b.production ?? recipes[b.recipe ?? ''];
      const peers = w.buildings
        .filter(
          (other) =>
            other.id !== b.id &&
            !other.construction &&
            (other.production ?? recipes[other.recipe ?? ''])?.skill === recipe?.skill &&
            other.investment >= other.wage * 3 &&
            other.wage > 0,
        )
        .map((other) => other.wage)
        .sort((a, b) => a - b);
      const reference = Math.max(
        worldBuildings(w)[b.templateId ?? b.kind]?.wage ?? 0,
        peers.length ? peers[Math.floor(peers.length / 2)] : 0,
      );
      const ceiling = Math.max(
        0,
        Math.floor(((budget.retailReceipts - budget.inputs) * 0.8) / target),
      );
      const wage = Math.max(b.wage, Math.min(ceiling, reference));
      const proposed = { ...b, wage };
      const reserve = productionBudget(w, proposed)!.reserve + remainingClaim(b);
      const deposit = Math.min(
        10_000_000,
        Math.max(0, reserve - b.investment),
        Math.max(0, p.cash - householdBudget(w, p).reserve),
      );
      if (b.investment + deposit >= reserve) {
        if (deposit > 0)
          steps.push({
            kind: 'act',
            action: { type: 'investment', building: b.id, direction: 'deposit', amount: deposit },
          });
        if (wage > b.wage) steps.push(operation('buildingAdmin', { building: b.id, wage }));
      }
    }
    if (steps.length) return visitBuilding(p, b, steps);
  }
  return [];
}

/** A business owner checks back at least every half hour rather than leaving a
 * closed bid until tomorrow. Only ordinary visits/actions perform maintenance. */
export function businessReturnDelay(w: World, p: Player, plannedSeconds: number) {
  return w.buildings.some(
    (b) => b.owner === p.id && !b.construction && !b.government && (b.recipe || b.production),
  )
    ? Math.min(plannedSeconds, 1800)
    : plannedSeconds;
}

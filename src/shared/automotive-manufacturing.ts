import { automotiveExport } from './automotive-exports';
import { automotiveSale, automotivePriceAction } from './automotive-sales';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Building, Player, Stock, World } from './types';
import { automotiveConfig, automotiveProducts, type AutomotiveProduct } from './automotive-config';
import { log } from './simulation';
import { factoryIdealEmployees } from './staffing';
import { accounts } from './reports';
import { taxRatesAt } from './taxes';
import { taxTown, payTown } from './civics';

export interface AssemblyOrder {
  id: string;
  product: AutomotiveProduct;
  inputs: Stock;
  seconds: number;
  skill: string;
  idealEmployees: number;
  wage: number;
  payroll: number;
  worked: number;
  workers: Record<string, number>;
}
export interface ManufacturedUnit {
  id: string;
  product: AutomotiveProduct;
  completedAt: number;
}
export interface Manufacturing {
  /** Missing asks follow world defaults; null closes a product. */
  prices?: Partial<Record<AutomotiveProduct, number | null>>;
  orders: AssemblyOrder[];
  ready: ManufacturedUnit[];
}
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function manufacturingSkill(w: World, b: Building) {
  return b.manufacturing?.orders[0]?.skill ?? automotiveConfig(w).factory.skill;
}
export function manufacturingAction(w: World, p: Player, a: Action) {
  const b = w.buildings.find((b) => b.id === a.building);
  need(
    b?.kind === 'automotiveFactory' &&
      Math.hypot(p.x - b.x, p.z - b.z) < automotiveConfig(w).delivery.range,
    'Visit the automotive factory',
  );
  if (a.op === 'export') return automotiveExport(w, p, b, a);
  if (a.op === 'buy') return automotiveSale(w, p, b, a);
  if (a.op === 'price') return automotivePriceAction(w, p, b, a);
  need(b.owner === p.id, 'Only the factory owner can manage assembly');
  need(!b.construction, 'Finish construction first');
  const state = b.manufacturing ?? { orders: [], ready: [] };
  if (a.op === 'cancel') {
    const order = state.orders.find((o) => o.id === a.order);
    need(order, 'Assembly order not found');
    need(order.worked === 0, 'Assembly has started; finish this order');
    need(
      Object.entries(order.inputs).every(([id, n]) => (b.stock[id] ?? 0) + n <= b.capacity),
      'Make room in the stockroom before cancelling',
    );
    for (const [id, n] of Object.entries(order.inputs)) b.stock[id] = (b.stock[id] ?? 0) + n;
    b.investment += order.payroll;
    state.orders = state.orders.filter((o) => o !== order);
    return 'Cancelled untouched assembly order; inputs and payroll returned.';
  }
  need(a.op === 'queue', 'Unknown manufacturing operation');
  const rules = automotiveConfig(w);
  need(rules.enabled, 'Automotive manufacturing is disabled in this world');
  need(b.condition > 0, 'Repair the factory first');
  need(automotiveProducts.includes(a.product as AutomotiveProduct), 'Choose an assembly product');
  need(
    state.orders.length + state.ready.length < rules.factory.readyCapacity,
    'Completed and reserved vehicle storage is full',
  );
  const product = a.product as AutomotiveProduct,
    recipe = rules.products[product];
  for (const [id, n] of Object.entries(recipe.inputs))
    need((b.stock[id] ?? 0) >= n, `Assembly needs ${n} ${id} in the stockroom`);
  const idealEmployees = factoryIdealEmployees(w, b),
    payroll = b.wage * idealEmployees;
  need(
    Number.isSafeInteger(payroll) && b.investment >= payroll,
    'Fund the full assembly payroll in the business investment till',
  );
  const order: AssemblyOrder = {
    id: 'assembly:' + b.id + ':' + ((w.manufacturingSequence ?? 0) + 1),
    product,
    inputs: { ...recipe.inputs },
    seconds: recipe.seconds,
    skill: rules.factory.skill,
    idealEmployees,
    wage: b.wage,
    payroll,
    worked: 0,
    workers: {},
  };
  w.manufacturingSequence = (w.manufacturingSequence ?? 0) + 1;
  for (const [id, n] of Object.entries(order.inputs)) b.stock[id] -= n;
  b.investment -= payroll;
  state.orders.push(order);
  b.manufacturing = state;
  return `Queued ${recipe.name}. Inputs and maximum crew payroll reserved.`;
}
function crew(
  w: World,
  b: Building,
  o: Pick<AssemblyOrder, 'skill' | 'idealEmployees'>,
  at: number,
) {
  const workers =
    w.settings.jobsEnabled === false
      ? []
      : b.employees
          .map((id) => w.players[id])
          .filter(
            (p): p is Player =>
              !!p &&
              p.id !== b.owner &&
              p.job === b.id &&
              p.health > 0 &&
              p.skills.includes(o.skill) &&
              (!w.settings.activeWork || p.activeUntil > at),
          );
  const owner = b.owner && w.players[b.owner];
  const operating =
    w.settings.ownerOperation &&
    owner &&
    owner.health > 0 &&
    owner.skills.includes(o.skill) &&
    (!w.settings.activeWork || (b.ownerActiveUntil ?? -1) > at)
      ? owner
      : undefined;
  return [...workers, ...(operating ? [operating] : [])].slice(0, o.idealEmployees);
}
function settlePayroll(w: World, b: Building, o: AssemblyOrder) {
  const rates = taxRatesAt(w, b),
    town = taxTown(w, b.x, b.z);
  let paid = 0;
  for (const [id, earned] of Object.entries(o.workers)) {
    const p = w.players[id];
    if (!p) continue;
    const gross = Math.min(o.payroll - paid, Math.floor(earned + 1e-7));
    const tax = Math.floor(gross * rates.worldWage),
      local = Math.min(gross - tax, Math.floor(gross * rates.townWage));
    p.cash += gross - tax - local;
    paid += gross;
    log(w, 'transfer', gross - tax - local, b.id, id, 'wage');
    log(w, 'sink', tax, b.id, 'treasury', 'wage tax');
    if (town) payTown(w, town, b.id, local, 'wage tax');
  }
  b.investment += o.payroll - paid;
}
/** Earned wages survive estate closure; unused escrow joins the ordinary estate till. */
export function clearManufacturingEstate(w: World, b: Building) {
  for (const order of b.manufacturing?.orders ?? []) settlePayroll(w, b, order);
  delete b.manufacturing;
}
function finish(w: World, b: Building, o: AssemblyOrder, at: number) {
  settlePayroll(w, b, o);
  b.manufacturing!.orders.shift();
  b.manufacturing!.ready.push({ id: o.id, product: o.product, completedAt: at });
  const statement = accounts(w, b);
  statement.batches++;
  for (const [id, n] of Object.entries(o.inputs))
    statement.consumed[id] = (statement.consumed[id] ?? 0) + n;
  statement.produced['automotive:' + o.product] =
    (statement.produced['automotive:' + o.product] ?? 0) + 1;
}
/** Bounded by reserved orders and crew shift boundaries, never one iteration per tick/second. */
export function advanceManufacturing(w: World, start: number, end: number) {
  if (!automotiveConfig(w).enabled) return;
  for (const b of w.buildings) {
    if (
      b.kind !== 'automotiveFactory' ||
      b.construction ||
      b.condition <= 0 ||
      !b.manufacturing?.orders.length
    )
      continue;
    let at = start;
    while (at < end && b.manufacturing.orders.length) {
      const o = b.manufacturing.orders[0],
        people = crew(w, b, o, at);
      if (!people.length) break;
      const efficiency = people.length / o.idealEmployees;
      const until = Math.min(
        end,
        at + (o.seconds - o.worked) / efficiency,
        ...people.map((p) =>
          w.settings.activeWork
            ? p.id === b.owner
              ? b.ownerActiveUntil!
              : p.activeUntil
            : Infinity,
        ),
      );
      if (until <= at) break;
      const elapsed = until - at,
        work = Math.min(o.seconds - o.worked, elapsed * efficiency);
      for (const p of people)
        if (p.id !== b.owner)
          o.workers[p.id] = (o.workers[p.id] ?? 0) + (work / o.seconds) * o.wage;
      o.worked += work;
      at = until;
      if (o.worked >= o.seconds - 1e-7) finish(w, b, o, at);
    }
  }
}

export function manufacturingCrew(w: World, b: Building, at = w.time) {
  const order = b.manufacturing?.orders[0] ?? {
    skill: automotiveConfig(w).factory.skill,
    idealEmployees: factoryIdealEmployees(w, b),
  };
  return crew(w, b, order, at);
}

export function manufacturingStaffing(w: World, b: Building) {
  const rules = automotiveConfig(w).factory;
  const order = b.manufacturing?.orders[0] ?? {
    skill: rules.skill,
    idealEmployees: factoryIdealEmployees(w, b),
  };
  const people = crew(w, b, order, w.time);
  return {
    active: people.length,
    ideal: order.idealEmployees,
    ownerOperating: people.some((p) => p.id === b.owner),
  };
}

export function manufacturingActivity(w: World, b: Building) {
  if (
    !automotiveConfig(w).enabled ||
    b.construction ||
    b.condition <= 0 ||
    !b.manufacturing?.orders.length
  )
    return 0;
  const s = b.staffing ?? manufacturingStaffing(w, b);
  return Math.min(1, s.active / s.ideal);
}
export function manufacturingReport(w: World, b: Building) {
  if (b.construction) return ['Construction is unfinished'];
  if (!automotiveConfig(w).enabled) return ['Manufacturing is disabled; reserved work is paused'];
  if (b.condition <= 0) return ['Repair the factory before continuing assembly'];
  const order = b.manufacturing?.orders[0];
  if (!order) return ['No assembly orders; deliver inputs and reserve payroll to start'];
  const s = b.staffing ?? manufacturingStaffing(w, b);
  return s.active
    ? [
        `${s.active} qualified crew / ${s.ideal} assembly places; ${Math.floor((order.worked / order.seconds) * 100)}% complete`,
      ]
    : ['Waiting for qualified staff; inputs and payroll remain reserved'];
}

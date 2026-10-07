import { herdSpec, herdNeeds } from './livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from './catalog.ts';
import { productionStaff, productionEfficiency } from './sound-state.ts';
import { waterworksSite } from './shoreline.ts';
import type { World, Player, Building, Stock, Ledger } from './types.ts';
export interface BusinessAccounts {
  since: number;
  receipts: number;
  materials: number;
  wages: number;
  tax: number;
  imports: number;
  capitalIn: number;
  capitalOut: number;
  otherIn: number;
  otherOut: number;
  batches: number;
  produced: Stock;
  consumed: Stock;
  bought: Stock;
  sold: Stock;
}
export interface LifeEvent {
  time: number;
  kind: 'death' | 'estate' | 'property' | 'trade' | 'job' | 'qualification' | 'livestock';
  text: string;
  building?: string;
  item?: string;
  quantity?: number;
  amount?: number;
  cause?: string;
  x?: number;
  z?: number;
}
export interface Departure {
  time: number;
  cash: number;
  bank: number;
  businesses: Record<string, BusinessAccounts>;
}
export interface AwayReport {
  from: number;
  until: number;
  cashChange: number;
  bankChange: number;
  events: LifeEvent[];
  businesses: { id: string; name: string; cashFlow: number; batches: number }[];
}
export function accounts(w: World, b: Building): BusinessAccounts {
  return (b.accounts ??= {
    since: w.time,
    receipts: 0,
    materials: 0,
    wages: 0,
    tax: 0,
    imports: 0,
    capitalIn: 0,
    capitalOut: 0,
    otherIn: 0,
    otherOut: 0,
    batches: 0,
    produced: {},
    consumed: {},
    bought: {},
    sold: {},
  });
}
export function cashFlow(a: BusinessAccounts) {
  return a.receipts - a.materials - a.wages - a.tax - a.imports + a.otherIn - a.otherOut;
}
/** Operating cash flow, not accrual profit: unsold inventory and owner capital are separate. */
export function recordMoney(w: World, e: Ledger) {
  const outgoing = w.buildings.find((b) => b.id === e.from);
  const incoming = w.buildings.find((b) => b.id === e.to);
  if (outgoing) {
    const a = accounts(w, outgoing);
    if (['sale', 'crop seed', 'fertilizer'].includes(e.reason)) a.materials += e.amount;
    else if (['wage', 'harvest wage'].includes(e.reason)) a.wages += e.amount;
    else if (e.reason === 'wage tax') a.tax += e.amount;
    else if (e.to === 'imports') a.imports += e.amount;
    else if (e.reason === 'withdrawal') a.capitalOut += e.amount;
    else a.otherOut += e.amount;
  }
  if (incoming) {
    const a = accounts(w, incoming);
    if (['purchase', 'room booking'].includes(e.reason)) a.receipts += e.amount;
    else if (e.reason === 'investment' || e.reason === 'outside stake') a.capitalIn += e.amount;
    else if (e.reason === 'investor return') a.capitalOut += e.amount;
    else a.otherIn += e.amount;
  }
}
export function recordLife(w: World, p: Player, event: Omit<LifeEvent, 'time'>, time = w.time) {
  p.history ??= [];
  p.history.push({ ...event, time });
  if (p.history.length > 80) p.history.splice(0, p.history.length - 80);
}
export function addQuantities(target: Stock, stock: Stock) {
  for (const [item, n] of Object.entries(stock)) target[item] = (target[item] ?? 0) + n;
}
export function productionReport(w: World, b: Building) {
  const r = b.production ?? recipes[b.recipe ?? ''];
  if (b.construction) return ['Construction is unfinished'];
  if (b.kind === 'farm') return ['Seasonal plots need tending and manual harvest'];
  if (!r) return ['No automatic production recipe'];
  const blockers: string[] = [];
  if (herdSpec(b)) {
    const spec = herdSpec(b)!;
    if ((b.stock[spec.animal] ?? 0) < spec.minimum)
      blockers.push(
        spec.animal === 'cows'
          ? 'Two cows are required for the milking stalls'
          : `${spec.minimum} ${spec.animal} are required for production`,
      );
    if ((b.herdCondition ?? 100) < 40)
      blockers.push('Herd condition is too low: fund feed, water and qualified care');
    for (const [item, n] of Object.entries(herdNeeds(b)))
      if ((b.stock[item] ?? 0) < n)
        blockers.push(`Herd maintenance needs ${n} ${item} each check, even when output is full`);
  }
  if (b.kind === 'waterworks' && !waterworksSite(w, b, b.rotation))
    blockers.push('Water intake is dry or the pump house is flooded');
  for (const [item, n] of Object.entries(r.inputs))
    if ((b.stock[item] ?? 0) < n) blockers.push(`Missing ${n - (b.stock[item] ?? 0)} ${item}`);
  for (const [item, n] of Object.entries(r.outputs))
    if ((b.stock[item] ?? 0) + n > b.capacity) blockers.push(`No room for ${n} ${item}`);
  const staff = productionStaff(w, b, w.time);
  if (b.investment < staff.length * b.wage)
    blockers.push(
      `Wages need ${staff.length * b.wage - b.investment} more hundredths of a denarius`,
    );
  const efficiency = productionEfficiency(w, b, staff.length);
  if (!staff.length && !b.government)
    blockers.push(
      `No active workers: unattended production runs at ${Math.round(efficiency * 100)}%`,
    );
  return blockers.length
    ? blockers
    : ['Supplied and staffed; waiting for the next production check'];
}
export function leaveReport(w: World, p: Player) {
  p.departure = {
    time: w.time,
    cash: p.cash,
    bank: p.bank,
    businesses: Object.fromEntries(
      w.buildings
        .filter((b) => b.owner === p.id)
        .map((b) => [b.id, structuredClone(accounts(w, b))]),
    ),
  };
}
export function returnReport(w: World, p: Player) {
  const d = p.departure;
  if (!d) return;
  p.awayReport = {
    from: d.time,
    until: w.time,
    cashChange: p.cash - d.cash,
    bankChange: p.bank - d.bank,
    events: (p.history ?? []).filter((e) => e.time >= d.time).slice(-30),
    businesses: w.buildings
      .filter((b) => b.owner === p.id && d.businesses[b.id])
      .map((b) => {
        const a = accounts(w, b),
          before = d.businesses[b.id];
        return {
          id: b.id,
          name: b.name,
          cashFlow: cashFlow(a) - cashFlow(before),
          batches: a.batches - before.batches,
        };
      }),
  };
  delete p.departure;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import { items } from './catalog.ts';
import { canCarry, log } from './simulation.ts';
import type { World, Player, Building, Action, Stock } from './types.ts';
export const roomCount = (b: Building) => (b.kind === 'hotel' ? 8 : b.kind === 'bnb' ? 3 : 0);
export function shelter(w: World, p: Player) {
  if (!p.atHome) return;
  const b = w.buildings.find((b) => b.id === p.home && !b.construction);
  if (!b) return;
  if (b.kind === 'home' && b.owner === p.id) return { b, stock: b.stock, until: Infinity };
  const guest = b.lodging?.guests[p.id];
  if (guest && guest.until > w.time) return { b, stock: guest.stock, until: guest.until };
}
export function lodgingAction(w: World, p: Player, b: Building, a: Action) {
  const check = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  check(roomCount(b) && !b.construction, 'Visit a finished hotel or bed & breakfast');
  const l = b.lodging ?? { open: false, rate: 600, guests: {} };
  if (a.operation === 'configure') {
    check(
      b.owner === p.id && p.skills.includes('innkeeper'),
      'The owner must learn innkeeper at school',
    );
    check(
      typeof a.rate === 'number' &&
        Number.isSafeInteger(a.rate) &&
        a.rate >= 0 &&
        a.rate <= 1000000 &&
        typeof a.open === 'boolean',
      'Choose a valid hourly rate and open status',
    );
    l.rate = a.rate as number;
    l.open = a.open as boolean;
  } else if (a.operation === 'rent') {
    check(l.open && b.owner, 'This lodging is not accepting bookings');
    const hours = a.hours as number;
    check(Number.isInteger(hours) && hours >= 1 && hours <= 24, 'Book one to 24 real hours');
    const guest = l.guests[p.id];
    check(!guest || guest.until <= w.time, 'Your room is already booked');
    check(
      Object.values(l.guests).filter((g) => g.until > w.time).length < roomCount(b),
      'All rooms are booked',
    );
    const cost = hours * l.rate;
    check(p.cash >= cost, 'Not enough cash');
    p.cash -= cost;
    b.investment += cost;
    log(w, 'transfer', cost, p.id, b.id, 'room booking');
    l.guests[p.id] = { until: w.time + hours * 3600, stock: guest?.stock ?? {} };
  } else if (a.operation === 'store') {
    const guest = l.guests[p.id];
    check(guest, 'Book a room first; only your own supplies are accessible');
    const item = String(a.item),
      n = a.quantity as number;
    check(
      Object.hasOwn(items, item) && (items[item].food || items[item].drink),
      'Rooms store food and drink',
    );
    check(Number.isInteger(n) && n > 0 && n <= 500, 'Choose a positive quantity');
    check(a.direction === 'deposit' || a.direction === 'withdraw', 'Choose a transfer direction');
    const deposit = a.direction === 'deposit',
      from = deposit ? p.inventory : guest.stock,
      to = deposit ? guest.stock : p.inventory;
    check((from[item] ?? 0) >= n, 'Not enough supplies');
    check(deposit ? (to[item] ?? 0) + n <= 100 : canCarry(p, item, n), 'Storage full');
    if (deposit) check(guest.until > w.time, 'Renew your booking before storing more supplies');
    from[item] -= n;
    to[item] = (to[item] ?? 0) + n;
  } else if (a.operation === 'checkout') {
    check(l.guests[p.id], 'No booking here');
    l.guests[p.id].until = w.time;
    if (p.home === b.id) p.atHome = false;
  } else throw Error('Unknown lodging operation');
  b.lodging = l;
}
/** Bounded threshold feeding; returns the seconds before either need reaches starvation. */
export function feedAtHome(
  p: Player,
  stock: Stock,
  seconds: number,
  hungerRate: number,
  thirstRate: number,
) {
  let healthySeconds = seconds;
  for (const [need, nutrient, rate] of [
    ['hunger', 'food', hungerRate],
    ['thirst', 'drink', thirstRate],
  ] as const) {
    let value = p[need] + seconds * rate * 0.8;
    for (const [key, def] of Object.entries(items)) {
      if (!def[nutrient] || value < 30000) continue;
      const count = Math.min(stock[key] ?? 0, Math.floor((value - 30000) / def[nutrient]!) + 1);
      stock[key] = (stock[key] ?? 0) - count;
      value -= count * def[nutrient]!;
    }
    const effectiveRate = rate * 0.8;
    const healthy =
      effectiveRate > 0 ? (50000 - value) / effectiveRate + seconds : value >= 50000 ? 0 : seconds;
    healthySeconds = Math.min(healthySeconds, Math.max(0, healthy));
    p[need] = Math.max(0, Math.min(50000, value));
  }
  return healthySeconds;
}

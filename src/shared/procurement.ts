// SPDX-License-Identifier: GPL-3.0-or-later
import { items } from './catalog.ts';
import { log } from './simulation.ts';
import { recordLife } from './reports.ts';
import type { World, Player, Action } from './types.ts';
export const ORDER_PERIOD = 3600;
const projects = [
  ['gravel', 'Repair parish paths'],
  ['wood', 'Replace public benches'],
  ['blocks', 'Repair harbour walls'],
  ['bricks', 'Maintain public chimneys'],
  ['tools', 'Replace maintenance equipment'],
  ['furniture', 'Furnish community rooms'],
  ['concrete', 'Repair landing aprons'],
] as const;
export interface SupplyOrder {
  id: string;
  item: string;
  project: string;
  unitPrice: number;
  quantity: number;
  delivered: number;
  contributions: Record<string, number>;
}
export interface Procurement {
  period: number;
  building: string;
  opensAt: number;
  expiresAt: number;
  remainingBudget: number;
  paid: number;
  orders: SupplyOrder[];
}
export function migrateProcurement(w: World) {
  if (w.procurementVersion) return;
  if (w.id === 'puddlewick' && w.owner === 'server' && w.template === 'economy')
    w.settings.parishOrders = true;
  w.procurementVersion = 1;
}
/** Fund only the current hour. Expired escrow is retired, never rolled into a windfall. */
export function refreshOrders(w: World) {
  if (!w.settings.parishOrders) return;
  const period = Math.floor(w.time / ORDER_PERIOD);
  if (w.procurement && w.procurement.period >= period) return;
  const building = w.buildings.find((b) => b.government && b.kind === 'market' && !b.construction);
  if (!building) return;
  const budget = w.settings.parishOrderBudget;
  const prior = w.procurement;
  if (prior?.remainingBudget)
    log(
      w,
      'sink',
      prior.remainingBudget,
      'parish-orders',
      'treasury',
      'expired procurement budget',
    );
  const orders: SupplyOrder[] = [];
  for (let i = 0; i < 3; i++) {
    const [item, project] = projects[(period * 3 + i) % projects.length];
    const unitPrice = Math.ceil((items[item].price * 110) / 100);
    const quantity = Math.min(80, Math.floor(budget / 3 / unitPrice));
    if (quantity > 0)
      orders.push({
        id: `${period}:${i}`,
        item,
        project,
        unitPrice,
        quantity,
        delivered: 0,
        contributions: {},
      });
  }
  const funded = orders.reduce((n, o) => n + o.quantity * o.unitPrice, 0);
  w.procurement = {
    period,
    building: building.id,
    opensAt: period * ORDER_PERIOD,
    expiresAt: (period + 1) * ORDER_PERIOD,
    remainingBudget: funded,
    paid: 0,
    orders,
  };
  log(w, 'faucet', funded, 'treasury', 'parish-orders', 'parish procurement budget');
}
export function orderAllowance(w: World, p: Player, o: SupplyOrder) {
  const c = w.procurement;
  if (!c || w.time >= c.expiresAt || !w.settings.parishOrders) return 0;
  const individual =
    w.time < (c.opensAt + c.expiresAt) / 2
      ? Math.max(0, Math.ceil(o.quantity / 2) - (o.contributions[p.id] ?? 0))
      : Infinity;
  return Math.max(
    0,
    Math.min(o.quantity - o.delivered, individual, Math.floor(c.remainingBudget / o.unitPrice)),
  );
}
export function fulfilOrder(w: World, p: Player, a: Action) {
  const check = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  check(w.settings.parishOrders, 'Parish orders are disabled');
  const c = w.procurement;
  check(c && w.time < c.expiresAt, 'These parish orders have expired');
  const b = w.buildings.find(
    (b) => b.id === c!.building && b.government && b.kind === 'market' && !b.construction,
  );
  check(
    b && a.building === b.id && Math.hypot(p.x - b.x, p.z - b.z) < 18,
    'Drive near the public Harbour collection point',
  );
  const o = c!.orders.find((o) => o.id === a.order);
  check(o, 'Order no longer available');
  const n = Number(a.quantity);
  check(
    Number.isSafeInteger(n) && n > 0 && n <= orderAllowance(w, p, o!),
    'Quantity exceeds your current order allowance',
  );
  check((p.inventory[o!.item] ?? 0) >= n, 'Carry the requested goods before delivering');
  const amount = n * o!.unitPrice;
  // Goods are consumed by the public project. No goods or cash can be delivered twice.
  p.inventory[o!.item] -= n;
  p.cash += amount;
  o!.delivered += n;
  o!.contributions[p.id] = (o!.contributions[p.id] ?? 0) + n;
  c!.remainingBudget -= amount;
  c!.paid += amount;
  log(w, 'transfer', amount, 'parish-orders', p.id, 'parish supply delivery', {
    building: b!.id,
    item: o!.item,
    quantity: n,
  });
  recordLife(w, p, {
    kind: 'trade',
    text: `Supplied ${n} ${items[o!.item].name} for ${o!.project}`,
    item: o!.item,
    quantity: n,
    amount,
    building: b!.id,
  });
  return `Delivered ${n} ${items[o!.item].name} for ${(amount / 100).toFixed(2)}d.`;
}

// SPDX-License-Identifier: GPL-3.0-or-later
import { orderAllowance } from '../shared/procurement';
import { items } from '../shared/catalog';
import { money, distance } from '../shared/simulation';
import type { World, Player } from '../shared/types';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function procurementHtml(w: World, p: Player) {
  const c = w.procurement;
  if (!w.settings.parishOrders) return '<p>Parish supply orders are disabled in this world.</p>';
  if (!c || w.time >= c.expiresAt)
    return '<p>No current orders. The public Harbour posts the next funded round when available.</p>';
  const building = w.buildings.find((b) => b.id === c.building);
  const near = building && !building.construction && distance(p, building) < 18;
  return `<p>Deliver carried goods at the public Harbour. Supplies are consumed by community maintenance projects. Budget remaining: <b>${money(c.remainingBudget)}</b>; suppliers paid: ${money(c.paid)}. Orders expire in <span data-parish-expires>${Math.ceil((c.expiresAt - w.time) / 60)}</span> minutes.</p><p>For the first half-hour each player can fill at most half an order (rounded up); remaining demand opens to everyone afterward. Payments have no additional tax. ${near ? '' : 'Drive to the Harbour collection point to deliver.'}</p>${c.orders
    .map((o) => {
      const allowance = orderAllowance(w, p, o),
        carry = p.inventory[o.item] ?? 0;
      return `<section><h3>${esc(o.project)}</h3><p>${esc(items[o.item].name)}: ${o.delivered}/${o.quantity} supplied · ${money(o.unitPrice)} each. Your remaining allowance: ${allowance}; carried: ${carry}.</p><form data-action="fulfilOrder"><input type="hidden" name="building" value="${esc(c.building)}"><input type="hidden" name="order" value="${esc(o.id)}"><label>Quantity<input name="quantity" type="number" min="1" max="${Math.min(carry, allowance)}" value="1" required></label><button ${!near || !allowance || !carry ? 'disabled' : ''}>Deliver ${esc(items[o.item].name)}</button></form></section>`;
    })
    .join('')}`;
}

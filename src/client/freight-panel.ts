import { itemEntries } from './item-order';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Stock } from '../shared/types';
import { vehicleDef } from '../shared/vehicle-config';
import { freightAccess } from '../shared/boat-hold';
import { boatNavigationRules } from '../shared/boat-navigation-rules';
import { worldItems } from '../shared/world-catalogue';
import { stockWeight } from '../shared/fishing-expedition';
import { economyRules } from '../shared/economy-rules';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (k: string, v: unknown) => `<input type="hidden" name="${k}" value="${esc(v)}">`;
export function freightPanel(w: World, p: Player) {
  const slots = (p.fleet ?? []).filter((slot) => vehicleDef(w, slot).holdCapacity),
    items = worldItems(w),
    rules = boatNavigationRules(w.settings);
  if (!slots.length) return '';
  return slots
    .map((slot) => {
      const v = vehicleDef(w, slot),
        active = p.vehicle === slot,
        cargo = active
          ? (p.boatHold ?? {})
          : (p.boatHolds?.[slot] ?? w.mooredBoats?.[`${p.id}:${slot}`]?.cargo ?? {});
      let html = `<section class="notice" data-freight-slot="${slot}"><h3>${esc(v.name)} freight hold</h3><p>${active ? 'Aboard' : 'Moored'} · ${stockWeight(w, cargo)} / ${v.holdCapacity} weight · ${esc(v.cargoKind ?? 'box')} cargo</p><p>${
        itemEntries(cargo, items, cargo)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `${esc(items[id]?.name ?? id)}: ${n}`)
          .join(' · ') || 'Hold empty'
      }</p><p>${rules.freightTransferRate} weight per second. Shops within ${rules.freightShopRange} m of the shore entrance can trade directly with this hold. Freight stays on the boat when you step ashore.</p>`;
      if (p.task?.kind === 'freight' && p.task.freight?.action.slot === slot)
        return (
          html +
          `<p role="status">Transfer in progress · ${Math.max(0, p.task.end - w.time).toFixed(1)} seconds remaining. Stock and cash move on completion.</p><form data-action="boatHold">${hidden('operation', 'cancel')}<button>Cancel transfer</button></form></section>`
        );
      let landing;
      try {
        landing = freightAccess(w, { ...p }, slot).landing;
      } catch (e) {
        return html + `<p>${esc(e instanceof Error ? e.message : e)}</p></section>`;
      }
      const quantity = `<label>Quantity<input name="quantity" type="number" min="1" max="${economyRules(w.settings).transactionItemLimit}" value="1" required></label>`;
      const stockOptions = (stock: Stock) =>
        itemEntries(stock, items, stock)
          .filter(([, n]) => n > 0)
          .map(
            ([id, n]) => `<option value="${esc(id)}">${esc(items[id]?.name ?? id)} (${n})</option>`,
          )
          .join('');
      const transfer = (operation: string, stock: Stock, label: string, building?: string) => {
        const choices = stockOptions(stock);
        return choices
          ? `<form data-action="boatHold">${hidden('operation', operation)}${hidden('slot', slot)}${building ? hidden('building', building) : ''}<label>${label}<select name="item">${choices}</select></label>${quantity}<button>${label}</button></form>`
          : `<p>${label}: no stock available.</p>`;
      };
      html +=
        transfer('load', p.inventory, 'Load inventory') +
        transfer('unload', cargo, 'Unload to inventory');
      const shops = w.buildings.filter(
        (b) =>
          !b.construction &&
          Math.hypot(b.x - landing.land.x, b.z - landing.land.z) <= rules.freightShopRange,
      );
      if (!shops.length) html += '<p>No dockside shops within reach.</p>';
      for (const b of shops) {
        html += `<h4>${esc(b.name)}</h4>`;
        if (b.owner === p.id) {
          html +=
            transfer('load', b.stock, 'Load stockroom', b.id) +
            transfer('unload', cargo, 'Unload to stockroom', b.id);
          continue;
        }
        for (const direction of ['buy', 'sell']) {
          const prices = direction === 'buy' ? b.sell : b.buy,
            label = direction === 'buy' ? 'Buy into hold' : 'Sell from hold';
          const options = itemEntries(prices, items, direction === 'buy' ? b.stock : cargo)
            .filter(([id, price]) => items[id] && Number.isFinite(price) && price >= 0)
            .map(
              ([id, price]) =>
                `<option value="${esc(id)}" data-price="${price}">${esc(items[id].name)} · ${money(price, w.settings.denariiPerSheckle)} each · ${direction === 'buy' ? (b.stock[id] ?? 0) + ' in shop' : (cargo[id] ?? 0) + ' in hold'}</option>`,
            )
            .join('');
          html += options
            ? `<form data-action="trade">${hidden('storage', 'hold')}${hidden('slot', slot)}${hidden('building', b.id)}${hidden('direction', direction)}<label>${label}<select name="item">${options}</select></label>${quantity}<button>${label}</button></form>`
            : `<p>${label}: no prices posted.</p>`;
        }
      }
      return html + '</section>';
    })
    .join('');
}

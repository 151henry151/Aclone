import { trailerStorage } from '../shared/stored-trailers';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { fuelRules } from '../shared/fuel-rules';
import { fuelTrailerQuote } from '../shared/fuel-sales';
import { money } from '../shared/simulation';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (key: string, value: string | number) =>
  `<input type="hidden" name="${key}" value="${esc(String(value))}">`;
export function fuelPanel(w: World, p: Player) {
  const rules = fuelRules(w.settings),
    near = Object.values(w.trailers ?? {}).filter(
      (t) =>
        !trailerStorage(w, t) &&
        t.kind === 'fuel' &&
        Math.hypot(t.x - p.x, t.z - p.z) < rules.refuelRange,
    );
  if (!near.length) return '<div class="fuel-services"></div>';
  return `<div class="fuel-services"><h3>Roadside fuel</h3>${near
    .map((t) => {
      const own = t.owner === p.id,
        owner =
          w.players[t.owner] ??
          (t.fuelService
            ? { name: t.fuelService.ownerName, online: t.fuelService.ownerOnline }
            : undefined),
        stock = p.trailerCargo?.[t.id]?.fuel ?? t.cargo.fuel ?? 0,
        price = t.sellPrice ?? 0;
      let html = `<section class="notice fuel-tanker-sales"><h4>Dales fuel tanker · ${esc(owner?.name ?? 'Unavailable owner')}</h4><p>${t.attached ? 'Hitched' : 'Parked'} · ${stock} Fuel available · ${price ? money(price, w.settings.denariiPerSheckle) + ' per Fuel' : 'Public sales closed'}</p><p>${own ? 'Your tanker: pumping and inventory transfers are free.' : owner?.online ? 'Owner receives the payment after tax.' : 'Offline owner: payment goes to their bank after tax.'} Posted prices include tax. Pumping consumes whole Fuel items, with no partial-item refund for the last top-up.</p>`;
      if (own)
        html += `<form data-action="fuelTrailer">${hidden('id', t.id)}${hidden('operation', 'price')}<label>Sale price in denarii (0 = closed)<input type="number" name="priceDenarii" min="0" max="1000000" step="0.01" value="${price / 100}" required></label><button>Save tanker price</button></form>`;
      for (const operation of ['pump', 'buy'] as const) {
        let reason = '';
        try {
          fuelTrailerQuote(w, p, { ...t, cargo: { fuel: stock } }, operation, 1, undefined, true);
        } catch (e) {
          reason = (e as Error).message;
        }
        html += `<form data-action="fuelTrailer">${hidden('id', t.id)}${hidden('operation', operation)}${hidden('expectedPrice', own ? 0 : price)}<label>${operation === 'pump' ? 'Maximum Fuel to pump' : 'Fuel to buy into inventory'}<input type="number" name="quantity" min="1" max="${rules.fuelTankerTransactionLimit}" value="1" required></label><button ${reason ? 'disabled' : ''}>${operation === 'pump' ? 'Pump into vehicle' : own ? 'Transfer Fuel to inventory' : 'Buy Fuel into inventory'}</button>${reason ? `<p>${esc(reason)}</p>` : ''}</form>`;
      }
      return html + '</section>';
    })
    .join('')}</div>`;
}

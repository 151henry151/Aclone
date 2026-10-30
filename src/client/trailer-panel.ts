// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../shared/types';
import { trailerDefs, trailerAccepts } from '../shared/trailers';
import { worldItems } from '../shared/world-catalogue';
import { stockWeight } from '../shared/fishing-expedition';
import { money } from '../shared/simulation';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (k: string, v: string) => `<input type="hidden" name="${k}" value="${esc(v)}">`;
export function trailerPanel(w: World, p: Player, b?: Building) {
  const owned = Object.values(w.trailers ?? {}).filter((t) => t.owner === p.id);
  let html = '';
  if (b?.kind === 'garage' && !b.aircraftHangar) {
    html +=
      '<h3>Specialist trailers</h3><p>Bring your tractor with clear space behind it. Trailers stay where you unhitch them, with their cargo.</p><div class="directory">';
    for (const [kind, d] of Object.entries(trailerDefs))
      html += `<section><h4>${d.name} · ${money(d.price, w.settings.denariiPerSheckle)}</h4><p>${d.description} ${d.capacity} weight capacity.</p><form data-action="trailer">${hidden('operation', 'buy')}${hidden('kind', kind)}${hidden('building', b.id)}<button>Buy &amp; hitch</button></form></section>`;
    html += '</div>';
  }
  if (!owned.length) return html;
  html +=
    '<h3>Your trailers</h3><p>Unhitch before changing vehicles. To reconnect, reverse your tractor up to the drawbar. Loads slow travel and increase fuel use.</p>';
  const items = worldItems(w);
  for (const publicTrailer of owned) {
    const t = {
        ...publicTrailer,
        cargo: p.trailerCargo?.[publicTrailer.id] ?? publicTrailer.cargo,
      },
      d = trailerDefs[t.kind],
      distance = Math.hypot(t.x - p.x, t.z - p.z);
    html += `<section class="notice"><h4>${d.name}</h4><p>${Math.round(distance)}m away · ${t.attached ? 'Hitched' : 'Parked'} · ${stockWeight(w, t.cargo).toFixed(0)} / ${d.capacity} weight</p>`;
    if (distance > d.length / 2 + 9) {
      html += '</section>';
      continue;
    }
    html += `<form data-action="trailer">${hidden('id', t.id)}${hidden('operation', t.attached ? 'unhitch' : 'hitch')}<button>${t.attached ? 'Unhitch here' : 'Hitch trailer'}</button></form>`;
    html += `<p>${
      Object.entries(t.cargo)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${esc(items[id]?.name ?? id)}: ${n}`)
        .join(' · ') || 'Empty'
    }</p>`;
    const source = b?.owner === p.id ? b.stock : p.inventory,
      storage = b?.owner === p.id ? hidden('building', b.id) : '';
    for (const [operation, stock, label] of [
      ['load', source, 'Load'],
      ['unload', t.cargo, 'Unload'],
    ] as const) {
      const choices = Object.entries(stock).filter(
        ([id, n]) => n > 0 && (operation === 'unload' || trailerAccepts(w, t, id, 1)),
      );
      if (choices.length)
        html += `<form data-action="trailer">${hidden('id', t.id)}${hidden('operation', operation)}${storage}<label>${label} ${b?.owner === p.id ? 'building stock' : 'inventory'}<select name="item">${choices.map(([id, n]) => `<option value="${esc(id)}">${esc(items[id]?.name ?? id)} (${n})</option>`).join('')}</select></label><label>Quantity<input type="number" name="quantity" min="1" max="10000" value="1" required></label><button>${label}</button></form>`;
    }
    if (b && b.owner !== p.id && t.attached === p.id) {
      for (const direction of ['buy', 'sell']) {
        const prices = direction === 'buy' ? b.sell : b.buy;
        const choices = Object.entries(prices).filter(
          ([id, price]) =>
            Number.isFinite(price) &&
            price >= 0 &&
            (direction === 'buy' ? trailerAccepts(w, t, id, 1) : (t.cargo[id] ?? 0) > 0),
        );
        if (choices.length)
          html += `<form data-action="trade">${hidden('storage', 'trailer')}${hidden('building', b.id)}${hidden('direction', direction)}<label>${direction === 'buy' ? 'Buy into' : 'Sell from'} trailer<select name="item">${choices.map(([id, price]) => `<option value="${esc(id)}">${esc(items[id]?.name ?? id)} · ${money(price, w.settings.denariiPerSheckle)} each${direction === 'sell' ? ` · ${t.cargo[id]} carried` : ''}</option>`).join('')}</select></label><label>Quantity<input type="number" name="quantity" min="1" max="10000" value="1" required></label><button>${direction === 'buy' ? 'Buy into' : 'Sell from'} trailer</button></form>`;
      }
    }
    html += '</section>';
  }
  return html;
}

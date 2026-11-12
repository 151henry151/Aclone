import { itemEntries } from './item-order';
import { trailerStorage } from '../shared/stored-trailers';
import { automotiveConfig } from '../shared/automotive-config';
import { coolingInterval } from '../shared/highway-refrigeration';
import { isSemitrailer } from '../shared/highway-definitions';
import { economyRules } from '../shared/economy-rules';
import { fuelPanel } from './fuel-panel';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../shared/types';
import {
  trailerHandlingReach,
  trailerHandlingReason,
  hitchRefusal,
  trailerDefs,
  trailerDef,
  trailerAccepts,
  type TrailerKind,
} from '../shared/trailers';
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
  let html = fuelPanel(w, p);
  if (b?.kind === 'garage' && !b.aircraftHangar) {
    html += `<details data-fleet-disclosure="trailer-shop"><summary>Specialist trailers (${Object.keys(trailerDefs).filter((kind) => !isSemitrailer(kind as TrailerKind)).length})</summary><p>Bring your tractor with clear space behind it. Trailers stay where you unhitch them, with their cargo.</p><div class="directory">`;
    for (const kind of Object.keys(trailerDefs) as TrailerKind[]) {
      if (isSemitrailer(kind)) continue;
      const d = trailerDef(w, kind);
      html += `<section><h4>${d.name} · ${money(d.price, w.settings.denariiPerSheckle)}</h4><p>${d.description} ${d.capacity} weight capacity.</p><form data-action="trailer">${hidden('operation', 'buy')}${hidden('kind', kind)}${hidden('building', b.id)}<button>Buy &amp; hitch</button></form></section>`;
    }
    html += '</div></details>';
  }
  if (!owned.length) return html;
  html += `<details data-fleet-disclosure="owned-trailers"><summary>Your trailers (${owned.length})</summary><p>Unhitch before changing vehicles. To reconnect, reverse the matching tractor to the drawbar or semitrailer kingpin. Loads slow travel and increase fuel use.</p>`;
  const items = worldItems(w);
  for (const publicTrailer of owned) {
    const t = {
        ...publicTrailer,
        cargo: p.trailerCargo?.[publicTrailer.id] ?? publicTrailer.cargo,
      },
      d = trailerDef(w, t.kind),
      distance = Math.hypot(t.x - p.x, t.z - p.z);
    const stored = trailerStorage(w, t);
    if (stored) {
      html += `<section class="notice"><h4>${esc(d.name)}</h4><p>Stored in ${esc(w.buildings.find((b) => b.id === stored)?.name ?? 'tractor garage storage')} · ${stockWeight(w, t.cargo).toFixed(0)} / ${d.capacity} weight. Retrieve at the garage before hitching or handling cargo.</p></section>`;
      continue;
    }
    html += `<section class="notice"><h4>${d.name}</h4><p><span data-trailer-distance="${esc(t.id)}">${Math.round(distance)}</span>m away · ${t.attached ? 'Hitched' : 'Parked'} · ${stockWeight(w, t.cargo).toFixed(0)} / ${d.capacity} weight</p>`;
    if (distance > trailerHandlingReach(w, t)) {
      html += '</section>';
      continue;
    }
    const handling = trailerHandlingReason(p),
      hitchReason = t.attached ? handling : hitchRefusal(w, p, t);
    html += `<form data-action="trailer">${hidden('id', t.id)}${hidden('operation', t.attached ? 'unhitch' : 'hitch')}<button${hitchReason ? ' disabled' : ''}>${t.attached ? 'Unhitch here' : 'Hitch trailer'}</button></form>${hitchReason ? `<p>${esc(hitchReason)}</p>` : ''}`;
    html += `<p>${
      itemEntries(t.cargo, items, t.cargo)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${esc(items[id]?.name ?? id)}: ${n}`)
        .join(' · ') || 'Empty'
    }</p>`;
    if (t.kind === 'semiRefrigerated') {
      const r = automotiveConfig(w).refrigeration,
        fuel = coolingInterval(w, t).fuel,
        running = t.cooling?.running ?? false,
        units = items.fuel.fuel ?? 0,
        moving = Math.abs(p.speed) >= 0.5,
        reason = moving
          ? 'Stop before handling refrigeration'
          : !r.enabled
            ? 'Refrigeration is disabled in this world'
            : fuel <= 0
              ? 'Add refrigeration fuel first'
              : '';
      html += `<h5>Refrigeration</h5><p>${fuel.toFixed(2)} / ${r.fuelCapacity} refrigeration fuel · ${running && r.enabled && fuel > 0 ? 'Cooling' : running ? 'Waiting for fuel or enabled world rules' : 'Off'}</p>
      <p>Separate from engine fuel. While powered, raw meat ages at ${Math.round(r.ageingMultiplier * 100)}% of its ordinary rate; cooling uses ${r.fuelPerHour} tank units per real hour. Fish has no general expiry timer. Refilling never resets cargo age.</p>
      <form data-action="trailer">${hidden('id', t.id)}${hidden('operation', 'cooling')}${hidden('running', String(!running))}<button ${moving || (!running && reason) ? 'disabled' : ''}>${running ? 'Stop refrigeration' : 'Start refrigeration'}</button>${reason ? `<p>${esc(reason)}</p>` : ''}</form>
      <form data-action="trailer">${hidden('id', t.id)}${hidden('operation', 'coolingRefuel')}<label>Fuel cans for refrigeration<input name="quantity" type="number" min="1" max="${Math.max(1, Math.floor((r.fuelCapacity - fuel) / Math.max(units, 1e-9)))}" value="1" required></label><button ${moving || !p.inventory.fuel || units <= 0 || fuel + units > r.fuelCapacity + 1e-9 ? 'disabled' : ''}>Refuel refrigeration</button><p>Each carried Fuel can supplies ${units} tank units; leave enough room for a whole can.</p></form>`;
    }
    const source = b?.owner === p.id ? b.stock : p.inventory,
      storage = b?.owner === p.id ? hidden('building', b.id) : '';
    for (const [operation, stock, label] of [
      ['load', source, 'Load'],
      ['unload', t.cargo, 'Unload'],
    ] as const) {
      const choices = itemEntries(stock, items, stock).filter(
        ([id, n]) => n > 0 && (operation === 'unload' || trailerAccepts(w, t, id, 1)),
      );
      if (choices.length)
        html += `<form data-action="trailer">${hidden('id', t.id)}${hidden('operation', operation)}${storage}<label>${label} ${b?.owner === p.id ? 'building stock' : 'inventory'}<select name="item">${choices.map(([id, n]) => `<option value="${esc(id)}">${esc(items[id]?.name ?? id)} (${n})</option>`).join('')}</select></label><label>Quantity<input type="number" name="quantity" min="1" max="10000" value="1" required></label><button${handling ? ' disabled' : ''}>${label}</button></form>`;
    }
    if (b && b.owner !== p.id && t.attached === p.id) {
      for (const direction of ['buy', 'sell']) {
        const prices = direction === 'buy' ? b.sell : b.buy;
        const choices = itemEntries(prices, items, direction === 'buy' ? b.stock : t.cargo).filter(
          ([id, price]) =>
            Number.isFinite(price) &&
            price >= 0 &&
            (direction === 'buy' ? trailerAccepts(w, t, id, 1) : (t.cargo[id] ?? 0) > 0),
        );
        if (choices.length)
          html += `<form data-action="trade">${hidden('storage', 'trailer')}${hidden('trailer', t.id)}${hidden('building', b.id)}${hidden('direction', direction)}<label>${direction === 'buy' ? 'Buy into' : 'Sell from'} trailer<select name="item">${choices.map(([id, price]) => `<option value="${esc(id)}">${esc(items[id]?.name ?? id)} · ${money(price, w.settings.denariiPerSheckle)} each${direction === 'sell' ? ` · ${t.cargo[id]} carried` : ''}</option>`).join('')}</select></label><label>Quantity<input type="number" name="quantity" min="1" max="${economyRules(w.settings).transactionItemLimit}" value="1" required></label><button>${direction === 'buy' ? 'Buy into' : 'Sell from'} trailer</button></form>`;
      }
    }
    html += '</section>';
  }
  return html + '</details>';
}

/** A change in handling reach changes available controls; ordinary movement changes only text. */
export function trailerWithinReach(w: World, p: Player, id: string) {
  const t = w.trailers?.[id];
  return !!t && Math.hypot(t.x - p.x, t.z - p.z) <= trailerHandlingReach(w, t);
}
export function refreshTrailerDistances(host: HTMLElement, w: World, p: Player) {
  for (const el of host.querySelectorAll<HTMLElement>('[data-trailer-distance]')) {
    const t = w.trailers?.[el.dataset.trailerDistance!];
    if (!t) continue;
    const text = String(Math.round(Math.hypot(t.x - p.x, t.z - p.z)));
    if (el.textContent !== text) el.textContent = text;
  }
}

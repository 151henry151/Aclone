// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { FISHING_BOAT } from '../shared/boats';
import { boatLanding } from '../shared/boathouse';
import { worldItems } from '../shared/world-catalogue';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const button = (text: string, op: string, attrs = '') =>
  `<button data-do="expedition" data-id="${op}" ${attrs}>${text}</button>`;
function expeditionContent(w: World, p: Player) {
  let html = '';
  for (const offer of p.crewOffers ?? [])
    html += `<p>${esc(offer.name)} offers ${offer.share}% of expedition profit after fuel and consumed provisions. No guaranteed pay. Meals aboard are supplied. You remain aboard until return.</p>${button('Accept at the dock', 'accept', `data-captain="${esc(offer.captain)}"`)}${button('Decline', 'decline', `data-captain="${esc(offer.captain)}"`)}`;
  if (p.crewBerth)
    html += `<p>Deckhand for ${esc(p.crewBerth.name)} · ${p.crewBerth.share}% profit share. Meals are automatic, online or offline. Shared stores: ${
      Object.entries(p.crewBerth.stores)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${n} ${esc(worldItems(w)[id]?.name ?? id)}`)
        .join(', ') || 'empty'
    }.</p>`;
  if (p.crewBerth && p.hitch) {
    const captain = w.players[p.hitch];
    if (captain && boatLanding(w, captain, true) && Math.abs(captain.speed) < 0.5)
      html += '<button data-do="detach">Step ashore (keep agreed profit share)</button>';
  }
  if (p.vehicle !== FISHING_BOAT || p.hitch) return html;
  const defs = worldItems(w),
    v = p.fishingVoyage;
  if ((p.inventory.fuel ?? 0) > 0) html += button('Fill tank from carried Fuel', 'refuel');
  html +=
    '<h3>Boat provisions & crew</h3><p>Stores share the cargo hold. Deckhands eat and drink automatically, online or offline. While online, take provisions into your inventory and use them yourself. You eat automatically from these stores only while offline.</p><label>Quantity <input id="boat-store-quantity" type="number" min="1" max="10000" value="1"></label>';
  for (const [id, d] of Object.entries(defs).filter(([, d]) => d.food || d.drink)) {
    const held = p.inventory[id] ?? 0,
      stored = p.boatStores?.[id] ?? 0;
    if (!held && !stored) continue;
    html += `<p>${esc(d.name)}: carrying ${held}, stored ${stored} ${held ? button('Store', 'store', `data-item="${esc(id)}"`) : ''}${stored ? button('Take', 'take', `data-item="${esc(id)}"`) : ''}</p>`;
  }
  if (v)
    html += `<p>Expedition expenses so far: ${(v.expenses / 100).toFixed(2)}d. Fuel is valued at the departure quote (${((v.fuelPrice * 8) / 100).toFixed(2)}d per Fuel); consumed provisions at departure prices, using catalogue prices when unavailable. Unused supplies are not charged. Profit shares are paid on settlement of landed expedition fish.</p><p>Crew: ${
      Object.entries(v.members)
        .map(([id, n]) => `${esc(w.players[id]?.name ?? id)} (${n}%)`)
        .join(', ') || 'none'
    }.</p>`;
  if (boatLanding(w, p, true) && Math.abs(p.speed) < 0.5) {
    if (!v?.departed && Object.keys(v?.members ?? {}).length < 2) {
      html +=
        '<label>Offer profit share (%) <input id="crew-share" type="number" min="5" max="25" value="15"></label>';
      for (const q of Object.values(w.players).filter(
        (q) => q.online && q.id !== p.id && !v?.members[q.id],
      ))
        html += button(`Offer ${esc(q.name)} a berth`, 'offer', `data-player="${esc(q.id)}"`);
    }
    if (v) html += button('Sell expedition catch, settle shares & put crew ashore', 'finish');
  }
  if (p.lastFishingSettlement) html += `<p>${esc(p.lastFishingSettlement)}</p>`;
  return html;
}

export function expeditionPanel(w: World, p: Player) {
  return `<section class="expedition-panel">${expeditionContent(w, p)}</section>`;
}

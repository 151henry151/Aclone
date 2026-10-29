// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { CHARTER_BOAT } from '../shared/boats';
import { boatLanding } from '../shared/boathouse';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const button = (label: string, op: string, attrs = '') =>
  `<button data-do="charter" data-id="${op}" ${attrs}>${label}</button>`;
export function charterPanel(w: World, p: Player) {
  let html = '';
  for (const offer of p.charterOffers ?? [])
    html += `<h3>Charter invitation</h3><p>${esc(offer.name)} · ${offer.minutes} real minutes including travel · ${(offer.fare / 100).toFixed(2)}d total fare. Bring tackle, food and water; keep your catches. Fare is held until return. Early return refunds unused time; cancellation refunds all. You must return to a dock to leave.</p>${button('Accept & board', 'accept', `data-captain="${esc(offer.captain)}"`)}${button('Decline', 'decline', `data-captain="${esc(offer.captain)}"`)}`;
  if (p.charterPassage) {
    const t = p.charterPassage,
      c = w.players[t.captain],
      elapsed = p.charterElapsed ?? 0;
    html += `<h3>Your charter</h3><p>Captain ${esc(c?.name ?? t.captain)} · ${Math.floor(elapsed / 60)} of ${t.minutes} agreed minutes · ${(t.fare / 100).toFixed(2)}d fare held. No overtime charge. Cast when the boat stops. Fish go into your own inventory; bring enough carrying space and provisions.</p>${button('Ask captain to return', 'requestReturn')}`;
    if (c && boatLanding(w, c, true) && Math.abs(c.speed) < 0.5)
      html += '<button data-do="detach">Settle fare & step ashore</button>';
  }
  if (p.vehicle === CHARTER_BOAT && !p.hitch) {
    const v = p.charter,
      dock = boatLanding(w, p, true);
    html += `<h3>Coastal Belle charters</h3><p>Six passenger places. W/S sets throttle (including reverse); A/D steers; B idles. Stop the engine while fishing to save fuel. Agree a total fare and trip duration including travel. Passengers keep their own fish. Fares are held until return to the departure dock; early return pays only elapsed time. A different dock or cancellation refunds all fares.</p><button data-do="boatIdle">Idle throttle</button><p>Throttle ${Math.round((p.boatThrottle ?? 0) * 100)}% · Tank ${p.fuel.toFixed(1)}/192 · Passengers ${Object.values(w.players).filter((q) => q.hitch === p.id).length}/6.</p>`;
    if (v)
      html +=
        `<p>${v.returned ? 'Returned — settle before another trip' : v.departed ? 'At sea' : 'Boarding'} · ${Math.floor(v.elapsed / 60)} minutes away · ${Object.keys(v.tickets).length} paid bookings.</p>` +
        Object.entries(v.tickets)
          .map(
            ([id, t]) =>
              `<p>${esc(w.players[id]?.name ?? id)}: ${(t.fare / 100).toFixed(2)}d / ${t.minutes} minutes${v.elapsed >= t.minutes * 60 ? ' · Return due' : ''}</p>`,
          )
          .join('');
    if (dock && Math.abs(p.speed) < 0.5) {
      if (!v?.departed) {
        html +=
          '<label>Fare per passenger (d) <input id="charter-fare" type="number" min="0" max="1000" step="0.01" value="75"></label><label>Trip length (real minutes, including travel) <input id="charter-minutes" type="number" min="15" max="180" value="60"></label>';
        const candidates = Object.values(w.players).filter(
          (q) => q.id !== p.id && q.online && !q.hitch && boatLanding(w, q, false, dock.id),
        );
        html += candidates.length
          ? candidates
              .map((q) => button(`Invite ${esc(q.name)}`, 'offer', `data-player="${esc(q.id)}"`))
              .join('')
          : '<p>No passengers waiting on shore at this dock.</p>';
      }
      if (v)
        html +=
          button('Settle trip & put passengers ashore', 'finish') +
          button('Cancel & refund everyone', 'cancel');
    }
    html +=
      '<p>Passengers need their own Fishing tackle. There is no guaranteed catch or passenger demand. Carry food, water and a return fuel reserve.</p>';
  }
  return `<section class="charter-panel">${html}</section>`;
}

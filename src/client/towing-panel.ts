// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { TUGBOAT } from '../shared/boats';
import { vehicleDef } from '../shared/vehicle-config';
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const action = (owner: string, operation: string, label: string) =>
  `<form data-action="tow"><input type="hidden" name="owner" value="${esc(owner)}"><input type="hidden" name="operation" value="${operation}"><button>${label}</button></form>`;
export function towingPanel(w: World, p: Player) {
  let html =
    '<h3>Boat rescue &amp; towing</h3><p>Tug captains can agree a fee with a stranded captain. Acceptance holds the fee; delivery to a boatyard or pier pays it. Either captain may cancel for a full refund. Cargo stays aboard.</p>';
  const jobs = Object.values(w.towJobs ?? {}).filter((j) => j.owner === p.id || j.tug === p.id);
  for (const j of jobs) {
    const boat = w.boatRescues?.[j.owner]?.boat ?? w.players[j.owner];
    html += `<p>${esc(w.players[j.tug]?.name ?? j.tug)} → ${esc(w.players[j.owner]?.name ?? j.owner)} · ${esc(vehicleDef(w, j.slot).name)} · ${(j.fee / 100).toFixed(2)}d · ${j.state}${boat ? ` · ${Math.round(Math.hypot(boat.x - p.x, boat.z - p.z))} m away` : ''}</p>`;
    if (j.owner === p.id && j.state === 'offered')
      html += action(j.owner, 'accept', 'Accept rescue fee');
    if (j.tug === p.id && j.state === 'accepted') html += action(j.owner, 'hook', 'Secure towline');
    if (j.tug === p.id && j.state === 'towing')
      html += action(j.owner, 'deliver', 'Deliver at dock');
    html += action(j.owner, 'cancel', 'Cancel agreement');
  }
  if ((p.fleet ?? []).includes(TUGBOAT) && !jobs.some((j) => j.tug === p.id)) {
    const own = w.boatRescues?.[p.id];
    if (own && !own.landing && own.boat.slot !== TUGBOAT)
      html += action(p.id, 'self', 'Plan free recovery of your boat');
    const candidates = Object.values(w.players).filter(
      (q) => q.id !== p.id && q.canBeTowed && !w.towJobs?.[q.id],
    );
    if (candidates.length)
      html += `<form data-action="tow"><input type="hidden" name="operation" value="offer"><label>Stranded captain<select name="owner">${candidates.map((q) => `<option value="${esc(q.id)}">${esc(q.name)}</option>`).join('')}</select></label><label>Rescue fee in denarii<input name="feeDenarii" type="number" min="0" max="100000" step="0.01" value="200" required></label><button>Offer tow</button></form>`;
    else html += '<p>No other stranded captains are currently available.</p>';
  }
  if (p.vehicle === TUGBOAT)
    html +=
      '<p>W/S sets throttle, A/D steers, B idles. Stop a hull length ahead of the casualty to secure the line. Towing halves top speed; take wide turns and keep both hulls clear of the shore.</p>';
  return html;
}

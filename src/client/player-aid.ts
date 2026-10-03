// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { giftAmount, moneyGiftReason, refuellingStatus } from '../shared/player-aid';
import { money } from '../shared/simulation';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function playerAidPanel(target: Player) {
  const name = escape(target.name),
    id = escape(target.id);
  return `<p id="aid-location"></p><button type="button" data-do="player-chat" data-id="${id}">Private chat with ${name}</button>
    <h3>Give money</h3><p>Send cash in hand directly to ${name}, anywhere in this parish. No fee or tax. This is a gift, not a loan.</p><p id="aid-cash"></p>
    <form id="money-gift-form" data-player="${id}"><label>Amount in denarii (d)<input name="denarii" type="number" min="0.01" max="1000000" step="0.01" inputmode="decimal" value="10" required></label><p id="gift-status" role="status"></p><button type="submit" class="primary" aria-describedby="gift-status">Give money to ${name}</button></form>
    <h3>Roadside refuelling</h3><p>Stop within 15 metres of their vehicle. Uses 1 Fuel from your inventory and adds up to 8 tank units. Any excess is used up, as when refuelling your own vehicle.</p><p id="refuel-status" role="status"></p><button type="button" data-do="refuelPlayer" data-id="${id}" aria-describedby="refuel-status">Use 1 Fuel to refuel ${name}</button>`;
}
export function refreshPlayerAid(host: HTMLElement, w: World, p: Player, id: string) {
  const form = host.querySelector<HTMLFormElement>('#money-gift-form');
  if (!form) return;
  const target = w.players[id];
  host.querySelector('#aid-location')!.textContent = target?.online
    ? `${target.name} · ${Math.round(Math.hypot(p.x - target.x, p.z - target.z))} metres away${target.npc ? ' · AI resident' : ''}`
    : 'This player has left the parish.';
  host.querySelector('#aid-cash')!.textContent =
    `Your cash in hand: ${money(p.cash, w.settings.denariiPerSheckle)}`;
  let reason = moneyGiftReason(w, p, target);
  try {
    const amount = giftAmount((form.elements.namedItem('denarii') as HTMLInputElement).value);
    if (!reason && amount > p.cash) reason = 'Not enough cash in hand';
  } catch (e) {
    reason ??= (e as Error).message;
  }
  host.querySelector('#gift-status')!.textContent = reason ?? 'Ready to send this gift.';
  form.querySelector('button')!.disabled = !!reason;
  const refuel = refuellingStatus(w, p, target, true);
  host.querySelector('#refuel-status')!.textContent =
    refuel.reason ?? `Ready · You carry ${p.inventory.fuel} Fuel.`;
  host.querySelector<HTMLButtonElement>('[data-do=refuelPlayer]')!.disabled = !!refuel.reason;
}

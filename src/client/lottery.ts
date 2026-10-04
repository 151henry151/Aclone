// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { money } from '../shared/simulation';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function lotteryPanel(w: World, p: Player) {
  const l = w.lottery,
    enabled = w.settings.lotteryEnabled,
    tickets = Object.values(l?.tickets ?? {}).reduce((n, q) => n + q, 0),
    own = l?.tickets[p.id] ?? 0;
  return `<p>In-game money only. Every ticket and voluntary contribution goes into the jackpot; there is no house cut or generated subsidy. Each ticket has an equal chance. Maximum 100 per player and 10,000 per draw.</p><div class="notice">Jackpot: <b>${money(l?.pot ?? 0, w.settings.denariiPerSheckle)}</b><br>Tickets: ${tickets} total · ${own} yours${tickets ? ` · ${((own / tickets) * 100).toFixed(2)}% chance` : ''}<br>${l ? `Draw in ${Math.max(0, Math.ceil((l.drawAt - w.time) / 600))} game days · round ${l.round}` : 'First draw at the end of the world’s current year.'}</div>${enabled ? `<form data-action="lottery"><input name="operation" type="hidden" value="tickets"><label>Tickets to buy<input name="amount" type="number" min="1" max="${Math.max(1, 100 - own)}" value="1"></label><button ${own >= 100 ? 'disabled' : ''}>Buy tickets (${money(l?.price ?? w.settings.lotteryTicketPrice, w.settings.denariiPerSheckle)} each)</button></form><form data-action="lottery"><input name="operation" type="hidden" value="fund"><label>Jackpot contribution in denarii<input name="amount" type="number" min="0.01" max="1000000" step="0.01" value="1"></label><button>Contribute own cash</button></form>` : '<p>New entries are disabled. Existing tickets will still be honoured at the draw.</p>'}<p>Draws occur every 365 game days (about 61 real hours). No-ticket jackpots carry forward. Winners receive cash even offline or after death; leaving this galaxy keeps local funds here. Ticket price changes apply next round. World owners can disable new entries.</p><h3>Recent draws</h3>${
    [...(l?.history ?? [])]
      .reverse()
      .map(
        (h) =>
          `<p>Round ${h.round}: ${h.winner ? esc(w.players[h.winner]?.name ?? h.winner) + ' · ' + money(h.amount, w.settings.denariiPerSheckle) : 'No tickets · carried forward'}</p>`,
      )
      .join('') || '<p>No draws yet.</p>'
  }`;
}

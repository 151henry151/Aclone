// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../shared/types';
import { money } from '../shared/simulation';
import { worldItems } from '../shared/world-catalogue';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const hidden = (name: string, value: string) =>
  `<input type="hidden" name="${name}" value="${esc(value)}">`;
export function socialHtml(w: World, p: Player) {
  const known = Object.values(w.players).filter((q) => q.id !== p.id),
    family = p.family ? w.families?.[p.family] : undefined;
  const name = (id: string) => w.players[id]?.name ?? w.familyNames?.[id] ?? id;
  const recipients = `<datalist id="social-residents">${known.map((q) => `<option value="${esc(q.name)}">`).join('')}</datalist>`;
  const recipient =
    '<label>Resident name<input name="player" list="social-residents" required maxlength="100" placeholder="Exact pilot name"></label>';
  const inbox = (p.mail ?? [])
    .slice()
    .reverse()
    .map(
      (m) =>
        `<article><h3>${esc(m.subject)}</h3><p>From ${esc(m.fromName)} · ${Math.floor((w.time - m.time) / 60)} minutes ago</p><p style="white-space:pre-wrap">${esc(m.text)}</p><form id="mail-reply-${m.id}" data-action="postMail">${hidden('player', m.from)}${hidden('subject', ('Re: ' + m.subject).slice(0, 80))}<label>Reply<textarea name="text" required maxlength="2000" rows="2"></textarea></label><button>Send reply</button></form><button data-do="deleteMail" data-id="${esc(m.id)}">Delete received letter</button></article>`,
    )
    .join('');
  const outgoing = (p.sentMail ?? [])
    .slice()
    .reverse()
    .map(
      (m) =>
        `<article><h3>${esc(m.subject)}</h3><p>To ${esc(m.toName)}</p><p style="white-space:pre-wrap">${esc(m.text)}</p><button data-do="deleteMail" data-id="${esc(m.id)}" data-folder="sent">Delete sent copy</button></article>`,
    )
    .join('');
  const offers = (p.tradeOffers ?? [])
    .map(
      (o) =>
        `<article><h3>${esc(name(o.seller))} → ${esc(name(o.buyer))}</h3><p>${o.quantity} ${esc(worldItems(w)[o.item]?.name ?? o.item)} · ${money(o.price)} each · <b>${money(o.price * o.quantity)} total</b>. Expires in ${Math.max(0, Math.ceil((o.expires - w.time) / 60))} minutes.</p>${o.to === p.id ? `<button data-do="acceptTrade" data-id="${esc(o.id)}" class="primary">Accept trade</button>` : ''}<button data-do="cancelTrade" data-id="${esc(o.id)}">${o.to === p.id ? 'Decline' : 'Cancel'} offer</button></article>`,
    )
    .join('');
  return `${recipients}<nav class="button-row"><button data-do="social-tab" data-id="letters">Mail (${p.mail?.length ?? 0})</button><button data-do="social-tab" data-id="family">Family</button><button data-do="social-tab" data-id="trades">Trades (${p.tradeOffers?.length ?? 0})</button></nav>
 <section data-social-pane="letters"><h3>Write a letter</h3><p>Mail is private to its sender and recipient and survives disconnection. Use the exact name of someone who has visited this world. Inbox limit: 50; sent history keeps 50. One letter per ten seconds. Letters do not wake an AI's conversation model.</p><form id="mail-compose" data-action="postMail">${recipient}<label>Subject<input name="subject" required maxlength="80"></label><label>Letter<textarea name="text" required maxlength="2000" rows="3"></textarea></label><button>Send letter</button></form><h3>Received</h3>${inbox || '<p>No received letters.</p>'}<h3>Sent</h3>${outgoing || '<p>No sent letters.</p>'}</section>
 <section data-social-pane="family"><h3>${family ? esc(family.name) : 'Families'}</h3>${family ? `<p>Leader: ${esc(name(family.leader))}. Membership doesn't share money, property or inventory.</p><ul>${family.members.map((id) => `<li>${esc(name(id))}${family.leader === p.id && id !== p.id ? ` <button data-do="family-remove" data-id="${esc(id)}">Remove</button>` : ''}</li>`).join('')}</ul><button data-do="family-leave">Leave family</button>${family.leader === p.id ? `<form id="family-invite" data-action="family">${hidden('operation', 'invite')}${recipient}<button>Invite resident</button></form>` : ''}<form id="family-message" data-action="family">${hidden('operation', 'message')}<label>Family message<textarea name="text" maxlength="1200" required rows="2"></textarea></label><button>Send to family chat</button></form>` : `<form id="family-create" data-action="family">${hidden('operation', 'create')}<label>Family name<input name="name" maxlength="32" required></label><button>Create family</button></form>`}<h3>Invitations</h3>${(p.familyInvites ?? []).map((f) => `<p>${esc(f.name)} <button data-do="family-join" data-id="${esc(f.id)}">Join</button><button data-do="family-decline" data-id="${esc(f.id)}">Decline</button></p>`).join('') || '<p>No invitations.</p>'}</section>
 <section data-social-pane="trades"><h3>Propose a trade</h3><p>Choose goods, quantity and unit price. Both players must be online. The recipient approves the exact total; no goods or cash are reserved. Meet within 15m, stop outside and finish activities to exchange. Offers expire after five minutes and are invalid after either participant starts a new life.</p><form id="trade-offer" data-action="offerTrade">${recipient}<label>I want to<select name="direction"><option value="sell">Sell my goods</option><option value="buy">Buy their goods</option></select></label><label>Goods<select name="item">${Object.entries(
   worldItems(w),
 )
   .map(([id, d]) => `<option value="${esc(id)}">${esc(d.name)}</option>`)
   .join(
     '',
   )}</select></label><label>Quantity<input name="quantity" type="number" value="1" min="1" max="10000" required></label><label>Unit price in denarii<input name="priceDenarii" type="number" min="0" max="1000000" step="0.01" value="1" required></label><button>Offer trade</button></form><h3>Pending offers</h3>${offers || '<p>No pending offers.</p>'}</section>`;
}
export function showSocialPane(host: HTMLElement, pane: string) {
  for (const section of host.querySelectorAll<HTMLElement>('[data-social-pane]'))
    section.hidden = section.dataset.socialPane !== pane;
}

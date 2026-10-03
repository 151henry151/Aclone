// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { Action, Player, World } from './types.ts';
import { carry, log } from './simulation.ts';
import { vehicles } from './catalog.ts';
import { worldItems } from './world-catalogue.ts';
import { recordLife } from './reports.ts';
import { say } from './messages.ts';
import { stoppedOutside } from './vehicle-services.ts';
export interface Mail {
  id: string;
  from: string;
  fromName: string;
  to: string;
  toName: string;
  subject: string;
  text: string;
  time: number;
}
export interface Family {
  id: string;
  name: string;
  leader: string;
  members: string[];
  invited: string[];
}
export interface TradeOffer {
  id: string;
  from: string;
  to: string;
  seller: string;
  buyer: string;
  item: string;
  quantity: number;
  price: number;
  expires: number;
  sellerLife: number;
  buyerLife: number;
}
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v),
      'Control characters are not allowed',
    );
function check(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
function target(w: World, p: Player, id: unknown) {
  const key = text(100).parse(id);
  const q = Object.hasOwn(w.players, key)
    ? w.players[key]
    : Object.values(w.players).find(
        (q) => q.name.toLocaleLowerCase('en-US') === key.toLocaleLowerCase('en-US'),
      );
  check(q && q.id !== p.id, 'Choose another resident of this world');
  return q;
}
function numberId(w: World) {
  return String((w.socialSequence ?? 0) + 1);
}
function commitId(w: World) {
  w.socialSequence = (w.socialSequence ?? 0) + 1;
}
/** Read-only legacy normalization: preserve membership and choose a stable first leader. */
export function families(w: World): Record<string, Family> {
  const result: Record<string, Family> = Object.fromEntries(
    Object.entries(w.families ?? {}).map(([id, f]) => [
      id,
      { ...f, members: [...f.members], invited: [...f.invited] },
    ]),
  );
  for (const p of Object.values(w.players).sort((a, b) => a.id.localeCompare(b.id)))
    if (p.family && !Object.hasOwn(result, p.family)) {
      const members = Object.values(w.players)
        .filter((q) => q.family === p.family)
        .map((q) => q.id)
        .sort();
      Object.defineProperty(result, p.family, {
        value: { id: p.family, name: p.family, leader: members[0], members, invited: [] },
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
  return result;
}
export function personalOffers(w: World, p: Player) {
  return (w.tradeOffers ?? []).filter(
    (o) => o.expires > w.time && (o.from === p.id || o.to === p.id),
  );
}
export function familyInvites(w: World, p: Player) {
  return Object.values(families(w))
    .filter((f) => f.invited.includes(p.id))
    .map((f) => ({ id: f.id, name: f.name }));
}
export function socialAction(w: World, p: Player, a: Action) {
  if (a.type === 'postMail') {
    check(!p.muted && !w.settings.chatLocked, 'Chat is currently muted');
    const q = target(w, p, a.player),
      subject = text(80).parse(a.subject),
      body = text(2000).parse(a.text);
    check((q.mail?.length ?? 0) < 50, 'Their inbox is full; ask them to delete old mail');
    check(
      p.mailSentAt === undefined || w.time - p.mailSentAt >= 10,
      'Wait ten seconds between letters',
    );
    const m: Mail = {
      id: numberId(w),
      from: p.id,
      fromName: p.name,
      to: q.id,
      toName: q.name,
      subject,
      text: body,
      time: w.time,
    };
    commitId(w);
    q.mail = [...(q.mail ?? []), m];
    p.sentMail = [...(p.sentMail ?? []), m].slice(-50);
    p.mailSentAt = w.time;
    return 'Letter delivered to their private inbox.';
  }
  if (a.type === 'deleteMail') {
    const id = text(100).parse(a.message),
      key = a.folder === 'sent' ? 'sentMail' : 'mail';
    check(
      p[key]?.some((m) => m.id === id),
      'No such letter in your mailbox',
    );
    p[key] = p[key]!.filter((m) => m.id !== id);
    return 'Letter deleted.';
  }
  if (a.type === 'family') {
    const all = families(w),
      op = String(a.operation),
      current = p.family ? all[p.family] : undefined;
    if (op === 'create') {
      const name = text(32).parse(a.name).normalize('NFKC');
      check(!p.family, 'Leave your current family first');
      check(Object.keys(all).length < 256, 'This world has reached its family limit');
      check(
        !Object.values(all).some((f) => f.name.toLowerCase() === name.toLowerCase()),
        'A family with that name exists; request an invitation',
      );
      const id = 'family:' + numberId(w);
      commitId(w);
      all[id] = { id, name, leader: p.id, members: [p.id], invited: [] };
      p.family = id;
    } else if (op === 'invite') {
      check(current?.leader === p.id, 'Only the family leader can invite');
      const q = target(w, p, a.player);
      check(!q.family, 'They already belong to a family');
      check(
        current.members.length < 32 && current.invited.length < 16,
        'Family or invitation limit reached',
      );
      check(!current.invited.includes(q.id), 'They already have an invitation');
      current.invited.push(q.id);
    } else if (op === 'join' || op === 'decline') {
      const f = all[text(100).parse(a.family)];
      check(f?.invited.includes(p.id), 'You need an invitation');
      if (op === 'join') {
        check(!p.family, 'Leave your family first');
        check(f.members.length < 32, 'Family is full');
        f.members.push(p.id);
        p.family = f.id;
      }
      f.invited = f.invited.filter((id) => id !== p.id);
    } else if (op === 'leave' || op === 'remove') {
      check(current, 'You do not belong to a family');
      const id = op === 'leave' ? p.id : text(100).parse(a.player);
      check(op === 'leave' || current.leader === p.id, 'Only the leader can remove members');
      check(
        current.members.includes(id) || current.invited.includes(id),
        'No such member or invitation',
      );
      current.members = current.members.filter((m) => m !== id);
      current.invited = current.invited.filter((m) => m !== id);
      if (w.players[id]?.family === current.id) delete w.players[id].family;
      if (!current.members.length) delete all[current.id];
      else if (current.leader === id) current.leader = current.members[0];
    } else if (op === 'message') {
      check(!p.muted && !w.settings.chatLocked, 'Chat is currently muted');
      check(current, 'Join a family first');
      const body = text(1200).parse(a.text);
      for (const id of current.members) say(w, `${p.name} · ${current.name}`, body, 'chat', id);
    } else throw Error('Unknown family action');
    w.families = all;
    return 'Family updated.';
  }
  if (a.type === 'offerTrade') {
    const q = target(w, p, a.player),
      item = text(80).parse(a.item),
      quantity = z.number().int().min(1).max(10000).parse(a.quantity),
      price = z.number().int().min(0).max(100000000).parse(a.price);
    check(a.direction === 'buy' || a.direction === 'sell', 'Choose buy or sell');
    check(p.online && q.online, 'Both traders must be online');
    check(Object.hasOwn(worldItems(w), item), 'Unknown item');
    const total = quantity * price;
    check(Number.isSafeInteger(total) && total <= 100000000, 'Trade value limit is 1,000,000d');
    const seller = a.direction === 'sell' ? p : q,
      buyer = a.direction === 'buy' ? p : q;
    check(seller !== p || (p.inventory[item] ?? 0) >= quantity, 'Not enough goods to offer');
    check(buyer !== p || p.cash >= total, 'Not enough cash to offer');
    const active = (w.tradeOffers ?? []).filter((o) => o.expires > w.time);
    check(
      active.length < 500 && active.filter((o) => o.from === p.id).length < 8,
      'Too many pending offers',
    );
    const offer: TradeOffer = {
      id: numberId(w),
      from: p.id,
      to: q.id,
      seller: seller.id,
      buyer: buyer.id,
      item,
      quantity,
      price,
      expires: w.time + 300,
      sellerLife: seller.deaths,
      buyerLife: buyer.deaths,
    };
    commitId(w);
    w.tradeOffers = [...active, offer];
    return 'Trade offered. Meet nearby and ask them to accept in Social / Trades.';
  }
  const id = text(100).parse(a.offer),
    o = w.tradeOffers?.find((o) => o.id === id);
  check(o && (o.from === p.id || o.to === p.id), 'No such trade offer');
  if (a.type === 'cancelTrade') {
    w.tradeOffers = w.tradeOffers!.filter((o) => o.id !== id);
    return 'Trade cancelled.';
  }
  check(a.type === 'acceptTrade' && o.to === p.id, 'Only the recipient can accept');
  const seller = w.players[o.seller],
    buyer = w.players[o.buyer];
  check(o.expires > w.time, 'This offer expired');
  check(
    seller && buyer && seller.deaths === o.sellerLife && buyer.deaths === o.buyerLife,
    'A new life invalidated this offer',
  );
  check(
    stoppedOutside(seller) && stoppedOutside(buyer),
    'Both players must stop outside and finish other activities',
  );
  check(
    Math.hypot(seller.x - buyer.x, seller.z - buyer.z) < 15 && Math.abs(seller.y - buyer.y) <= 3,
    'Meet within 15 metres at the same height',
  );
  const total = o.quantity * o.price;
  check((seller.inventory[o.item] ?? 0) >= o.quantity, 'Seller no longer has enough stock');
  check(buyer.cash >= total, 'Buyer no longer has enough cash');
  check(Number.isSafeInteger(seller.cash + total), 'Seller cash limit reached');
  check(worldItems(w)[o.item], 'This item is no longer available');
  const bag = { ...buyer.inventory, [o.item]: (buyer.inventory[o.item] ?? 0) + o.quantity };
  check(
    carry({ ...buyer, inventory: bag }, w) <= vehicles[buyer.vehicle].capacity,
    'Buyer cargo is full',
  );
  seller.inventory[o.item] -= o.quantity;
  buyer.inventory = bag;
  seller.cash += total;
  buyer.cash -= total;
  log(w, 'transfer', total, buyer.id, seller.id, 'player trade', {
    item: o.item,
    quantity: o.quantity,
  });
  for (const q of [buyer, seller])
    recordLife(w, q, {
      kind: 'trade',
      text: `${q === buyer ? 'Bought' : 'Sold'} ${o.quantity} ${worldItems(w)[o.item].name} ${q === buyer ? 'from ' + seller.name : 'to ' + buyer.name}`,
      item: o.item,
      quantity: o.quantity,
      amount: total,
    });
  w.tradeOffers = w.tradeOffers!.filter((v) => v.id !== id);
  return 'Trade completed.';
}

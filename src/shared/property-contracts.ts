// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building, Action } from './types';
import { propertyQuote } from './property';
import { log, distance } from './simulation';
export type LeaseOffer = { rent: number; seconds: number };
export type OperatingLease = {
  landlord: string;
  tenant: string;
  ends: number;
  bond: number;
  equity: number;
};
export type PropertyAuction = {
  seller: string;
  ends: number;
  minimum: number;
  bid?: { player: string; amount: number };
};
const amount = (v: unknown, max = 100_000_000) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw Error('Choose a positive whole amount within the limit');
  return n;
};
const count = (w: World, p: string) =>
  w.buildings.filter(
    (b) =>
      !['home', 'warehouse'].includes(b.kind) &&
      (b.owner === p || b.operatingLease?.landlord === p),
  ).length;
function eligible(b: Building) {
  if (
    b.government ||
    b.construction ||
    b.lien ||
    b.operatingLease ||
    b.auction ||
    b.stakes?.length ||
    ['home', 'bnb', 'hotel', 'bank', 'warehouse'].includes(b.kind)
  )
    throw Error(
      'Choose a completed, unencumbered commercial property without tenants or outside stakes',
    );
}
export function finishLease(w: World, b: Building, destroyed = false) {
  const l = b.operatingLease;
  if (!l) return;
  delete b.operatingLease;
  const loss = Math.min(
    l.bond,
    Math.max(0, l.equity - (destroyed ? 0 : propertyQuote(w, b).equity)),
  );
  const landlord = w.players[l.landlord],
    tenant = w.players[l.tenant];
  if (landlord) {
    landlord.cash += loss;
    log(w, 'transfer', loss, 'lease:' + b.id, landlord.id, 'lease asset restoration');
  }
  if (tenant) {
    tenant.cash += l.bond - loss;
    log(w, 'transfer', l.bond - loss, 'lease:' + b.id, tenant.id, 'lease bond refund');
  }
  b.owner = landlord?.id;
  b.ownerActiveUntil = 0;
  b.forSale = false;
}
function refundBid(w: World, b: Building) {
  const bid = b.auction?.bid;
  if (bid && w.players[bid.player]) {
    w.players[bid.player].cash += bid.amount;
    log(w, 'transfer', bid.amount, 'auction:' + b.id, bid.player, 'auction bid refund');
  }
  if (b.auction) delete b.auction.bid;
}
export function propertyContractAction(w: World, p: Player, a: Action) {
  if (a.operation === 'rules') {
    if (p.id !== w.owner && p.authority < 20) throw Error('World caretaker required');
    if (typeof a.leases !== 'boolean' || typeof a.auctions !== 'boolean')
      throw Error('Choose lease and auction permissions');
    w.contractRules = { leases: a.leases, auctions: a.auctions };
    return 'Contract rules saved. Existing contracts still settle.';
  }
  const b = w.buildings.find((b) => b.id === a.building);
  if (!b || distance(p, b) > 18 || p.atHome || p.crowBody) throw Error('Visit the property first');
  if (a.operation === 'leaseEnd') {
    if (b.operatingLease?.tenant !== p.id) throw Error('Only the operator may surrender early');
    finishLease(w, b);
    return 'Lease surrendered. Unused prepaid rent is not refunded; the bond settles any asset depletion.';
  }
  if (a.operation === 'leaseOffer') {
    if (!w.contractRules?.leases) throw Error('Operating leases disabled in this world');
    if (b.owner !== p.id) throw Error('Only the owner may offer a lease');
    eligible(b);
    const rent = amount(a.rent),
      seconds = amount(a.hours, 168) * 3600;
    b.leaseOffer = { rent, seconds };
    b.forSale = false;
    return 'Lease offered. Rent is prepaid; accepting requires an asset-value bond.';
  }
  if (a.operation === 'leaseAccept') {
    if (!w.contractRules?.leases) throw Error('Operating leases disabled in this world');
    eligible(b);
    const offer = b.leaseOffer,
      landlord = b.owner && w.players[b.owner];
    if (!offer || !landlord || landlord.id === p.id) throw Error('No lease available');
    if (count(w, p.id) >= w.settings.maxBuildings) throw Error('Property limit reached');
    const bond = propertyQuote(w, b).equity;
    if (p.cash < offer.rent + bond)
      throw Error('Not enough cash for rent and refundable asset bond');
    p.cash -= offer.rent + bond;
    landlord.cash += offer.rent;
    log(w, 'transfer', offer.rent, p.id, landlord.id, 'prepaid operating rent');
    log(w, 'transfer', bond, p.id, 'lease:' + b.id, 'lease asset bond');
    b.operatingLease = {
      landlord: landlord.id,
      tenant: p.id,
      ends: w.time + offer.seconds,
      bond,
      equity: bond,
    };
    b.owner = p.id;
    b.forSale = false;
    delete b.leaseOffer;
    b.ownerActiveUntil = 0;
    b.employees = b.employees.filter((id) => id !== p.id);
    if (p.job === b.id) {
      delete p.job;
      p.activeUntil = 0;
    }
    return 'Operating lease started. Stock and working capital remain with the property at expiry; losses against starting asset value are charged to the bond.';
  }
  if (a.operation === 'auctionList') {
    if (!w.contractRules?.auctions) throw Error('Auctions disabled in this world');
    if (b.owner !== p.id) throw Error('Only the owner may auction a property');
    eligible(b);
    const minimum = amount(a.minimum),
      seconds = amount(a.hours, 168) * 3600;
    b.auction = { seller: p.id, ends: w.time + seconds, minimum };
    b.forSale = false;
    delete b.leaseOffer;
    return 'Fixed-term auction opened. Highest bid is held in escrow; there is no early cancellation.';
  }
  if (a.operation === 'bid') {
    const auction = b.auction;
    if (!auction || w.time >= auction.ends || auction.seller === p.id)
      throw Error('No open auction to bid on');
    if (count(w, p.id) >= w.settings.maxBuildings) throw Error('Property limit reached');
    const bid = amount(a.amount),
      existing = auction.bid?.player === p.id ? auction.bid.amount : 0;
    if (bid < auction.minimum || bid <= (auction.bid?.amount ?? 0) || p.cash + existing < bid)
      throw Error('Bid must beat the minimum and highest bid and be fully funded');
    refundBid(w, b);
    p.cash -= bid;
    auction.bid = { player: p.id, amount: bid };
    log(w, 'transfer', bid, p.id, 'auction:' + b.id, 'property auction escrow');
    return 'Bid secured. An outbid offer is refunded automatically.';
  }
  throw Error('Unknown property contract action');
}
export function tickPropertyContracts(w: World) {
  for (const b of w.buildings) {
    if (b.operatingLease && w.time >= b.operatingLease.ends) finishLease(w, b);
    const auction = b.auction;
    if (!auction || w.time < auction.ends) continue;
    const bidder = auction.bid && w.players[auction.bid.player],
      seller = w.players[auction.seller];
    if (
      auction.bid &&
      bidder &&
      seller &&
      b.owner === seller.id &&
      count(w, bidder.id) < w.settings.maxBuildings
    ) {
      seller.cash += auction.bid.amount;
      log(
        w,
        'transfer',
        auction.bid.amount,
        'auction:' + b.id,
        seller.id,
        'property auction settlement',
      );
      b.owner = bidder.id;
      b.forSale = false;
      b.ownerActiveUntil = 0;
      b.employees = b.employees.filter((id) => id !== bidder.id);
      if (bidder.job === b.id) {
        delete bidder.job;
        bidder.activeUntil = 0;
      }
    } else refundBid(w, b);
    delete b.auction;
  }
}
export function contractsOnDeath(w: World, p: Player) {
  for (const b of w.buildings) {
    if (
      b.operatingLease &&
      (b.operatingLease.tenant === p.id || b.operatingLease.landlord === p.id)
    )
      finishLease(w, b);
    if (b.auction?.seller === p.id) {
      refundBid(w, b);
      delete b.auction;
    } else if (b.auction?.bid?.player === p.id) refundBid(w, b);
  }
}

/** Settle cash held outside a building before combat or decay removes it. */
export function contractsOnRemoval(w: World, b: Building) {
  refundBid(w, b);
  delete b.auction;
  finishLease(w, b, true);
  delete b.leaseOffer;
}

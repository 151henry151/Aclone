// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../shared/types';
import { propertyQuote } from '../shared/property';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const field = (label: string, name: string, value: number) =>
  `<label>${label}<input name="${name}" type="number" min="1" max="100000000" value="${value}"></label>`;
const form = (b: Building, op: string, fields: string, label: string) =>
  `<form data-action="propertyContract"><input type="hidden" name="building" value="${esc(b.id)}"><input type="hidden" name="operation" value="${op}">${fields}<button>${label}</button></form>`;
export function contractPanel(w: World, p: Player, b: Building) {
  let out = '';
  const l = b.operatingLease,
    a = b.auction;
  if (l)
    out += `<h3>Operating lease</h3><p>Title owner: ${esc(w.players[l.landlord]?.name ?? l.landlord)}. Operator: ${esc(w.players[l.tenant]?.name ?? l.tenant)}. Ends in ${Math.max(0, Math.ceil((l.ends - w.time) / 60))} minutes. Bond: ${l.bond / 100}d; starting stock/till value ${l.equity / 100}d. Stock and capital stay with the property on expiry. Any depletion of starting asset value is deducted from the bond. Added capital is not guaranteed to be returned. Rent is prepaid and non-refundable.</p>${l.tenant === p.id ? form(b, 'leaseEnd', '', 'Surrender lease early') : ''}`;
  if (a)
    out += `<h3>Property auction</h3><p>Closes in ${Math.max(0, Math.ceil((a.ends - w.time) / 60))} minutes. Minimum ${a.minimum / 100}d. Highest ${a.bid ? a.bid.amount / 100 + 'd' : 'none'}. The highest bid is held in escrow; outbid offers are refunded. No early cancellation. Ordinary trading continues, so stock may change before closing.</p>${p.id !== a.seller ? form(b, 'bid', field('Bid (hundredths of a denarius)', 'amount', (a.bid?.amount ?? a.minimum) + 100), 'Place funded bid') : ''}`;
  if (!l && !a && b.leaseOffer)
    out += `<h3>Available to operate</h3><p>Prepaid rent ${b.leaseOffer.rent / 100}d for ${b.leaseOffer.seconds / 3600} hours. Current refundable asset bond ${propertyQuote(w, b).equity / 100}d. The operator can manage prices, stock and working cash but cannot sell, mortgage or demolish the building.</p>${b.owner !== p.id ? form(b, 'leaseAccept', '', 'Accept operating lease') : ''}`;
  if (
    b.owner === p.id &&
    !l &&
    !a &&
    !b.lien &&
    !b.construction &&
    !b.government &&
    !b.stakes?.length &&
    !['home', 'bnb', 'hotel', 'bank', 'warehouse'].includes(b.kind)
  ) {
    if (w.contractRules?.leases)
      out += `<h3>Offer operating lease</h3>${form(b, 'leaseOffer', field('Total prepaid rent (hundredths of a denarius)', 'rent', 1000) + field('Duration (1–168 hours)', 'hours', 24), 'Offer lease')}`;
    if (w.contractRules?.auctions)
      out += `<h3>Fixed-term auction</h3>${form(b, 'auctionList', field('Minimum bid (hundredths of a denarius)', 'minimum', b.price) + field('Duration (1–168 hours)', 'hours', 24), 'Open auction')}`;
  }
  return out;
}

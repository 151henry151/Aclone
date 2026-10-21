// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Building } from '../shared/types';
import { money } from '../shared/simulation';
import { salesReceipt, taxRatesAt } from '../shared/taxes';
import { worldItems } from '../shared/world-catalogue';
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const pct = (v: number) => `${Number((v * 100).toFixed(2))}%`;

export function taxSummary(w: World, site: { x: number; z: number }) {
  const r = taxRatesAt(w, site);
  return `Sales tax ${pct(r.sales)} included (${pct(r.worldSales)} world + ${pct(r.townSales)} ${r.town ?? 'town'}). Buyers pay the posted price; sales tax comes out of business proceeds. Selling to a business pays its full posted bid.`;
}
export function tradeQuoteText(
  w: World,
  b: Building,
  item: string,
  side: 'buy' | 'sell',
  price: number,
  quantity: number,
  ownerView = false,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000)
    return 'Choose a whole quantity from 1 to 10,000.';
  const total = price * quantity;
  const m = (v: number) => money(v, w.settings.denariiPerSheckle);
  const prefix = `${quantity} ${worldItems(w)[item]?.name ?? item}: `;
  if (side === 'buy')
    return `${prefix}${ownerView ? 'Business pays supplier' : 'you receive'} ${m(total)}. No sales-tax deduction.`;
  const t = salesReceipt(w, b, total);
  return `${prefix}${ownerView ? 'Customer pays' : 'you pay'} ${m(total)} total. Included tax ${m(t.tax)} (${m(t.worldTax)} world + ${m(t.townTax)} town); business receives ${m(t.net)} before other costs.`;
}
export function taxesPanel(w: World, site: { x: number; z: number }) {
  const r = taxRatesAt(w, site),
    example = salesReceipt(w, site, 10000);
  const m = (v: number) => money(v, w.settings.denariiPerSheckle);
  return `<p>Read current public rates from anywhere. Shop taxes use the business location; construction uses the building site.</p><section class="notice"><h3>Your location · ${esc(r.town ?? 'Outside town taxation')}</h3><p>${esc(taxSummary(w, site))}</p><p>Example: a posted <b>100d</b> purchase costs you <b>100d</b>. Included tax: ${m(example.worldTax)} world + ${m(example.townTax)} town. The business keeps ${m(example.net)} before other costs.</p><p>Factory wage tax: <b>${pct(r.wage)}</b> (${pct(r.worldWage)} world + ${pct(r.townWage)} town), deducted from gross pay. Farm harvest wages currently deduct only the ${pct(r.worldWage)} world wage tax.</p><p>Construction tax: <b>${pct(r.construction)}</b> added to the base building cost, where building is permitted. The build preview includes this charge.</p></section><h3>Town rates</h3><p>Local sales and factory wage rates below are added to world rates: sales ${pct(r.worldSales)}, wages ${pct(r.worldWage)}. Combined deductions cannot exceed 100%. Amounts are rounded per transaction, not per item.</p>${w.towns.map((t) => `<section class="notice"><h4>${esc(t.name)}</h4><p>Local sales ${pct(t.salesTax)} · local factory wages ${pct(t.wageTax)} · construction ${pct(t.tax)}</p>${(t.pendingTaxes ?? []).map((change) => `<p>Scheduled ${esc({ salesTax: 'sales tax', wageTax: 'wage tax', constructionTax: 'construction tax' }[change.rule])}: ${pct(change.value)} in ${Math.max(0, Math.ceil((change.at - w.time) / 600))} game days.</p>`).join('')}</section>`).join('') || '<p>No town taxes in this world.</p>'}`;
}

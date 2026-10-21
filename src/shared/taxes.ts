// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types.ts';
import { taxTown } from './town-charter.ts';

const rate = (v: number) => Math.max(0, Math.min(1, v));
export function taxRatesAt(w: World, site: { x: number; z: number }) {
  const town = taxTown(w, site.x, site.z);
  return {
    town: town?.name ?? null,
    worldSales: rate(w.settings.salesTax),
    townSales: rate(town?.salesTax ?? 0),
    sales: Math.min(1, rate(w.settings.salesTax) + rate(town?.salesTax ?? 0)),
    worldWage: rate(w.settings.wageTax),
    townWage: rate(town?.wageTax ?? 0),
    wage: Math.min(1, rate(w.settings.wageTax) + rate(town?.wageTax ?? 0)),
    construction: rate(town?.tax ?? 0),
  };
}

/** Tax is withheld from the quoted shop total, using the same rounding for UI and execution. */
export function salesReceipt(w: World, site: { x: number; z: number }, gross: number) {
  const rates = taxRatesAt(w, site);
  const worldTax = Math.floor(gross * rates.worldSales);
  const townTax = Math.min(gross - worldTax, Math.floor(gross * rates.townSales));
  return { gross, worldTax, townTax, tax: worldTax + townTax, net: gross - worldTax - townTax };
}

/** Public rules, available even to residents who have not inspected a particular shop. */
export function taxFacts(w: World, site: { x: number; z: number }) {
  return {
    atCurrentLocation: taxRatesAt(w, site),
    towns: w.towns.map((t) => ({
      name: t.name,
      salesTax: t.salesTax,
      wageTax: t.wageTax,
      constructionTax: t.tax,
      scheduled: t.pendingTaxes,
    })),
    shopPurchases:
      'Buyer pays exactly posted price times quantity. World and town sales taxes are INCLUDED and withheld from business proceeds, never added to the buyer bill. Tax is rounded down separately on the whole transaction, in hundredths of a denarius, and capped at the total.',
    sellingToBusiness:
      'Player receives the posted buy price times quantity. No additional sales tax is deducted from this delivery.',
    wages:
      'Factory workers receive gross wages less world and town wage taxes; farm harvest wages currently deduct world wage tax only.',
    construction:
      'Town construction tax is added to the base building cost; the build preview includes it.',
    access:
      'World/F9 → Taxes & rates, or Parish directory → Taxes & rates. No town hall or travel needed. Shop trade rows show totals for the selected quantity.',
  };
}

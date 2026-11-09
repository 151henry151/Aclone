// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Building, Player, World } from './types';
import { automotiveConfig, type AutomotiveProduct } from './automotive-config';
import { salesReceipt } from './taxes';
import { accounts } from './reports';
import { taxTown, payTown } from './civics';
import { log } from './simulation';

export function automotiveExportQuote(w: World, product: AutomotiveProduct) {
  const rules = automotiveConfig(w);
  const pending = (w.automotiveExports ?? [])
    .filter((until) => until > w.time)
    .sort((a, b) => a - b);
  return {
    price: Math.floor(rules.products[product].price * rules.exports.priceFraction),
    available:
      rules.enabled && rules.exports.enabled
        ? Math.max(0, rules.exports.units - pending.length)
        : 0,
    // If the limit was lowered, several existing collections may need to expire.
    nextIn: pending.length
      ? pending[Math.max(0, pending.length - rules.exports.units)] - w.time
      : 0,
  };
}
function need(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
/** External collectors buy real completed units. Their bounded demand is not banked
 * while absent; changing premises, ownership, rules or restarting cannot clear it. */
export function automotiveExport(w: World, p: Player, b: Building, a: Action) {
  need(b.owner === p.id, 'Only the factory owner may export completed vehicles');
  need(!b.construction, 'Finish construction first');
  const rules = automotiveConfig(w);
  need(rules.enabled && rules.exports.enabled, 'Vehicle exports are disabled in this world');
  const unit = b.manufacturing?.ready.find((v) => v.id === a.unit);
  need(unit, 'Completed unit is no longer in stock');
  const quote = automotiveExportQuote(w, unit.product);
  need(a.expectedPrice === quote.price, 'The export price has changed; review the new quote');
  need(quote.available > 0, 'External vehicle demand is exhausted; wait for the next collection');
  const receipt = salesReceipt(w, b, quote.price),
    item = 'automotive:' + unit.product;
  b.manufacturing!.ready = b.manufacturing!.ready.filter((v) => v !== unit);
  w.automotiveExports = [
    ...(w.automotiveExports ?? []).filter((until) => until > w.time),
    w.time + rules.exports.interval,
  ];
  b.investment += receipt.net;
  log(w, 'faucet', quote.price, 'exports', b.id, 'vehicle export', {
    building: b.id,
    item,
    quantity: 1,
  });
  log(w, 'sink', receipt.worldTax, b.id, 'treasury', 'sales tax', {
    building: b.id,
    item,
    quantity: 1,
  });
  const town = taxTown(w, b.x, b.z);
  if (town) payTown(w, town, b.id, receipt.townTax, 'sales tax');
  const ledger = accounts(w, b);
  ledger.sold[item] = (ledger.sold[item] ?? 0) + 1;
  return `${rules.products[unit.product].name} collected by the external buyer. Net proceeds paid into factory investment.`;
}

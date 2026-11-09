// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Building, Player, World } from './types';
import { automotiveConfig, automotiveProducts, type AutomotiveProduct } from './automotive-config';
import {
  HIGHWAY_TRACTOR,
  isSemitrailer,
  semiProducts,
  semitrailerDefinition,
  type SemiKind,
} from './highway-definitions';
import { kerbParking } from './parking-site';
import { vehicleRecord } from './vehicle-services';
import { accounts } from './reports';
import { salesReceipt } from './taxes';
import { taxTown, payTown } from './civics';
import { log } from './simulation';

function need(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
export function automotivePrice(w: World, b: Building, product: AutomotiveProduct) {
  const local = b.manufacturing?.prices?.[product];
  return local === null ? null : (local ?? automotiveConfig(w).products[product].price);
}
export function automotivePriceAction(w: World, p: Player, b: Building, a: Action) {
  need(b.owner === p.id, 'Only the factory owner may set sale prices');
  need(!b.construction, 'Finish construction first');
  const product = a.product as AutomotiveProduct;
  need(automotiveProducts.includes(product), 'Choose an assembly product');
  if (a.open === false) a = { ...a, price: null };
  need(
    a.price === null ||
      (Number.isSafeInteger(a.price) && Number(a.price) >= 0 && Number(a.price) <= 100_000_000),
    'Choose a valid whole price or close sales',
  );
  (b.manufacturing ??= { orders: [], ready: [] }).prices ??= {};
  b.manufacturing.prices![product] = a.price as number | null;
  return a.price === null ? 'Product closed for sale.' : 'Factory sale price updated.';
}
export function automotiveSale(w: World, p: Player, b: Building, a: Action) {
  const r = automotiveConfig(w),
    state = b.manufacturing;
  need(!b.construction, 'Finish construction first');
  need(r.enabled, 'Automotive manufacturing and sales are disabled in this world');
  need(
    !p.atHome &&
      !p.inside &&
      !p.hitch &&
      !p.task &&
      !p.game &&
      !p.crowBody &&
      Math.abs(p.speed) < 0.5,
    'Stop outside and finish other activities before collection',
  );
  const unit = state?.ready.find((v) => v.id === a.unit);
  need(unit, 'Completed unit is no longer in stock');
  const price = automotivePrice(w, b, unit.product);
  need(price !== null, 'This product is closed for sale');
  need(a.expectedPrice === price, 'The price has changed; review the new quote');
  need(p.cash >= price, 'Not enough cash');
  const kind = Object.keys(semiProducts).find(
    (k) => semiProducts[k as SemiKind] === unit.product,
  ) as SemiKind | undefined;
  if (!kind)
    need(
      !(p.fleet ?? [0, 5]).includes(HIGHWAY_TRACTOR),
      'You already own this highway tractor; retrieve it first',
    );
  else {
    need(
      Object.values(w.trailers ?? {}).filter((t) => t.owner === p.id && isSemitrailer(t.kind))
        .length < r.delivery.maxOwnedSemitrailers,
      'Your semitrailer ownership limit is full',
    );
    need(!w.trailers?.[unit.id], 'This manufactured unit has already been delivered');
  }
  // Reuse the conservative full-body parking survey with this product's dimensions.
  const body = kind && semitrailerDefinition(kind, w);
  const survey = body
    ? {
        ...w,
        vehicleTuning: {
          ...w.vehicleTuning,
          [HIGHWAY_TRACTOR]: {
            ...w.vehicleTuning?.[HIGHWAY_TRACTOR],
            length: body.length,
            width: body.width,
          },
        },
      }
    : w;
  const point = kerbParking(survey, b, HIGHWAY_TRACTOR);
  need(point, 'No safe clear delivery place outside this factory; clear the yard');
  const receipt = salesReceipt(w, b, price);
  // Every refusal is above this boundary: ownership, stock and payment change together.
  if (kind)
    (w.trailers ??= {})[unit.id] = {
      id: unit.id,
      owner: p.id,
      kind,
      x: point.x,
      z: point.z,
      heading: point.heading,
      cargo: {},
    };
  else {
    p.fleet = [...(p.fleet ?? [0, 5]), HIGHWAY_TRACTOR];
    vehicleRecord(w, p, HIGHWAY_TRACTOR);
    (w.parkedVehicles ??= {})[`${p.id}:${HIGHWAY_TRACTOR}`] = {
      ...point,
      owner: p.id,
      slot: HIGHWAY_TRACTOR,
      fuel: 0,
      condition: 100,
      parkedAt: w.time,
      deliveryPending: true,
    };
  }
  state!.ready = state!.ready.filter((v) => v !== unit);
  p.cash -= price;
  b.investment += receipt.net;
  const item = 'automotive:' + unit.product;
  log(w, 'transfer', receipt.net, p.id, b.id, 'purchase', { building: b.id, item, quantity: 1 });
  log(w, 'sink', receipt.worldTax, p.id, 'treasury', 'sales tax', {
    building: b.id,
    item,
    quantity: 1,
  });
  const town = taxTown(w, b.x, b.z);
  if (town) payTown(w, town, p.id, receipt.townTax, 'sales tax');
  const ledger = accounts(w, b);
  ledger.sold[item] = (ledger.sold[item] ?? 0) + 1;
  return `${r.products[unit.product].name} delivered outside the factory. ${kind ? 'Collect it with a compatible highway tractor.' : 'Walk to it to board. The fuel tank is empty.'}`;
}

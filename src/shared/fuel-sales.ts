// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types';
import type { Trailer } from './trailers';
import { fuelRules } from './fuel-rules';
import { terrainHeight } from './terrain';
import { highWater } from './ocean';
import { vehicleDef } from './vehicle-config';
import { fuelCapacity, refuelRequiresReboarding } from './tractors';
import { worldItems } from './world-catalogue';
import { salesReceipt } from './taxes';
import { taxTown } from './town-charter';
import { payTown } from './civics';
import { canCarry, log } from './simulation';
function need(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
/** Posted prices remain anchors when stock is exhausted; catalogue price covers shopless worlds. */
export function fuelShopPrice(w: World) {
  const prices = w.buildings
    .filter((b) => !b.construction && Number.isSafeInteger(b.sell.fuel) && b.sell.fuel >= 0)
    .map((b) => b.sell.fuel);
  return prices.length ? Math.min(...prices) : worldItems(w).fuel.price;
}
function access(w: World, p: Player, t?: Trailer, publicSnapshot = false): asserts t is Trailer {
  const rules = fuelRules(w.settings);
  need(t?.kind === 'fuel', 'Choose a fuel tanker');
  need(
    p.online && !p.atHome && !p.crowBody && !p.hitch && !p.game && !p.task,
    'Finish activities and stop outside to use a fuel tanker',
  );
  const y = terrainHeight(w, t.x, t.z);
  need(
    Math.hypot(p.x - t.x, p.z - t.z) < rules.refuelRange && Math.abs(p.y - y) <= rules.refuelHeight,
    `Move within ${rules.refuelRange} metres of the tanker at the same height`,
  );
  need(y > highWater(w), 'The tanker must be on dry land');
  const driver = t.attached ? w.players[t.attached] : undefined;
  need(
    Math.abs(p.speed) <= rules.refuelSpeed &&
      (!t.attached ||
        (publicSnapshot
          ? t.fuelService?.stopped
          : driver && Math.abs(driver.speed) <= rules.refuelSpeed)),
    'Both vehicle and tanker must stop moving',
  );
}
/** A read-only quote, shared by player UI, resident planning and authoritative execution. */
export function fuelTrailerQuote(
  w: World,
  p: Player,
  t: Trailer,
  operation: 'buy' | 'pump',
  requested: number,
  expectedPrice?: unknown,
  publicSnapshot = false,
) {
  access(w, p, t, publicSnapshot);
  const rules = fuelRules(w.settings),
    owner =
      w.players[t.owner] ??
      (publicSnapshot && t.fuelService ? { online: t.fuelService.ownerOnline } : undefined),
    own = t.owner === p.id;
  need(owner, 'The tanker owner is unavailable');
  need(
    Number.isSafeInteger(requested) &&
      requested > 0 &&
      requested <= rules.fuelTankerTransactionLimit,
    `Choose a whole quantity from 1 to ${rules.fuelTankerTransactionLimit}`,
  );
  const price = own ? 0 : (t.sellPrice ?? 0);
  if (!own) {
    need(rules.fuelTankerSales, 'Roadside tanker sales are disabled');
    need(
      owner.online || rules.fuelTankerOfflineSales,
      'This world disables sales while the owner is offline',
    );
    need(Number.isSafeInteger(price) && price > 0, 'This tanker is closed for sale');
    need(
      expectedPrice === undefined || expectedPrice === price,
      'The price changed; review the tanker price',
    );
    need(
      !rules.fuelTankerPriceCeiling || price <= fuelShopPrice(w) * rules.fuelTankerPriceCeiling,
      'Tanker price exceeds the world shop-price ceiling',
    );
  }
  let quantity = requested,
    units = 0;
  if (operation === 'pump') {
    need(
      vehicleDef(w, p.vehicle)?.fuel > 0 && !refuelRequiresReboarding(p, w),
      'Board your fuel-powered vehicle before pumping',
    );
    const capacity = fuelCapacity(p, w),
      conversion = worldItems(w).fuel.fuel ?? 0;
    need(Number.isFinite(p.fuel) && p.fuel < capacity, 'Your fuel tank is full');
    need(conversion > 0, 'Fuel does not supply tank units in this world');
    quantity = Math.min(requested, Math.ceil((capacity - p.fuel) / conversion));
    units = Math.min(capacity - p.fuel, quantity * conversion);
  } else need(canCarry(p, 'fuel', quantity, w), 'Inventory capacity is full');
  need((t.cargo.fuel ?? 0) >= quantity, 'The tanker does not have enough Fuel');
  const total = price * quantity;
  need(Number.isSafeInteger(total) && total >= 0, 'Fuel transaction is too large');
  need(p.cash >= total, 'Not enough cash');
  return { quantity, units, price, ...salesReceipt(w, t, total) };
}
export function fuelTrailerAction(w: World, p: Player, a: Action) {
  const t = w.trailers?.[String(a.id)];
  access(w, p, t);
  if (a.operation === 'price') {
    need(t.owner === p.id, 'Only the owner can set this tanker price');
    need(
      Number.isSafeInteger(a.price) && Number(a.price) >= 0 && Number(a.price) <= 100000000,
      'Choose a whole price from 0 to 100000000',
    );
    t.sellPrice = Number(a.price);
    return t.sellPrice
      ? 'Tanker sale price saved.'
      : 'Tanker closed for public sales; owner use remains free.';
  }
  need(
    a.operation === 'buy' || a.operation === 'pump',
    'Choose inventory purchase or vehicle pumping',
  );
  const q = fuelTrailerQuote(w, p, t, a.operation, Number(a.quantity), a.expectedPrice ?? a.price),
    owner = w.players[t.owner];
  t.cargo.fuel -= q.quantity;
  if (!t.cargo.fuel) delete t.cargo.fuel;
  if (a.operation === 'pump') p.fuel += q.units;
  else p.inventory.fuel = (p.inventory.fuel ?? 0) + q.quantity;
  p.cash -= q.gross;
  if (q.gross) {
    if (owner.online) owner.cash += q.net;
    else owner.bank += q.net;
    const details = { trailer: t.id, item: 'fuel', quantity: q.quantity };
    log(w, 'transfer', q.net, p.id, owner.id, 'tanker purchase', details);
    log(w, 'sink', q.worldTax, p.id, 'treasury', 'sales tax', details);
    const town = taxTown(w, t.x, t.z);
    if (town) payTown(w, town, p.id, q.townTax, 'sales tax');
  }
  return a.operation === 'pump'
    ? `Pumped ${q.quantity} Fuel (${q.units.toFixed(1)} tank units).`
    : `Transferred ${q.quantity} Fuel to inventory.`;
}

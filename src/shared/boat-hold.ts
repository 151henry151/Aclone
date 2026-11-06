import { freightStockCost } from './freight-accounting';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, World } from './types';
import { boatLanding, boatLandings, withinBoatLanding, landingAccepts } from './boathouse';
import { mooringKey } from './boats';
import { vehicleDef } from './vehicle-config';
import { riverDockAccepts } from './river-dock';
import { boatNavigationRules } from './boat-navigation-rules';
import { cargoAccepts } from './cargo-policy';
import { transferStock } from './stock-life';
import { stockWeight } from './fishing-expedition';
import { economyRules } from './economy-rules';
import { worldItems } from './world-catalogue';
import { canCarry, requireHerdRoom } from './simulation';
function need(ok: unknown, reason: string): asserts ok {
  if (!ok) throw Error(reason);
}
export function freightAccess(w: World, p: Player, slot: unknown) {
  need(typeof slot === 'number' && Number.isSafeInteger(slot), 'Choose a freight vessel');
  const v = vehicleDef(w, slot);
  need(v?.holdCapacity && (p.fleet ?? []).includes(slot), 'Choose your own freight vessel');
  need(
    !p.atHome && !p.hitch && !p.game && !p.task && Math.abs(p.speed) < 0.5,
    'Stop outside and finish your activity before handling freight',
  );
  const active = p.vehicle === slot,
    moored = w.mooredBoats?.[mooringKey(p.id, slot)];
  const landing = active
    ? boatLanding(w, p, true)
    : boatLandings(w).find((d) => d.id === moored?.landing && withinBoatLanding(w, p, d, false));
  need(landing && (active || moored?.owner === p.id), 'Return to this boat at its dock or landing');
  need(landingAccepts(w, landing, slot), 'The boat does not fit this berth');
  const cargo = active ? (p.boatHold ??= {}) : (moored!.cargo ??= {});
  return { slot, v, landing, cargo };
}
export function saveFreightCargo(
  w: World,
  p: Player,
  slot: number,
  cargo: import('./types').Stock,
) {
  if (p.vehicle === slot) p.boatHold = cargo;
  else w.mooredBoats![mooringKey(p.id, slot)].cargo = cargo;
}
export function freightShop(w: World, p: Player, slot: unknown, id: unknown) {
  const access = freightAccess(w, p, slot),
    b = w.buildings.find((b) => b.id === id && !b.construction);
  need(
    b &&
      Math.hypot(b.x - access.landing.land.x, b.z - access.landing.land.z) <=
        boatNavigationRules(w.settings).freightShopRange,
    'Choose a completed shop within freight reach of the shore entrance',
  );
  return b;
}
export function freightAccepts(w: World, p: Player, slot: unknown, item: string, n: number) {
  const { v, cargo } = freightAccess(w, p, slot);
  return cargoAccepts(w, { kind: v.cargoKind ?? 'box', cargo }, v.holdCapacity!, item, n);
}
export function queueFreight(w: World, p: Player, a: Action) {
  const access = freightAccess(w, p, a.slot),
    weight = stockWeight(w, { [String(a.item)]: Number(a.quantity) });
  p.boatThrottle = 0;
  p.task = {
    kind: 'freight',
    end: w.time + weight / boatNavigationRules(w.settings).freightTransferRate,
    item: String(a.item),
    amount: Number(a.quantity),
    freight: { action: structuredClone(a), landing: access.landing.id },
  };
  return `Transferring ${a.quantity} ${worldItems(w)[String(a.item)].name}; ${(p.task.end - w.time).toFixed(1)} seconds. Cancel leaves all stock and cash in place.`;
}
export function boatHoldAction(w: World, p: Player, a: Action, complete = false) {
  if (a.operation === 'cancel') {
    need(p.task?.kind === 'freight', 'No freight transfer is in progress');
    delete p.task;
    return 'Freight transfer cancelled. Nothing moved.';
  }
  const access = freightAccess(w, p, a.slot),
    { cargo, v } = access,
    item = String(a.item),
    n = a.quantity;
  need(
    typeof n === 'number' &&
      Number.isSafeInteger(n) &&
      n > 0 &&
      n <= economyRules(w.settings).transactionItemLimit,
    'Invalid quantity',
  );
  need(a.operation === 'load' || a.operation === 'unload', 'Choose load or unload');
  const loading = a.operation === 'load',
    b = a.building === undefined ? undefined : freightShop(w, p, a.slot, a.building);
  need(!b || b.owner === p.id, 'Choose your own stockroom');
  const other = b?.stock ?? p.inventory,
    source = loading ? other : cargo,
    dest = loading ? cargo : other;
  need((source[item] ?? 0) >= n, 'Not enough items in the source');
  if (loading)
    need(
      cargoAccepts(w, { kind: v.cargoKind ?? 'box', cargo }, v.holdCapacity!, item, n),
      'Freight hold is full or unsuitable',
    );
  else if (b) {
    need((b.stock[item] ?? 0) + n <= b.capacity, 'Building storage is full');
    requireHerdRoom(w, b, item, n);
  } else need(canCarry(p, item, n, w), 'Captain inventory is full or unsuitable');
  if (!complete) return queueFreight(w, p, a);
  freightStockCost(w, p, access.slot, cargo, item, n, loading);
  transferStock(w, source, dest, item, n);
  saveFreightCargo(w, p, access.slot, cargo);
  return `Transferred ${n} ${worldItems(w)[item].name} ${loading ? 'to' : 'from'} the freight hold.`;
}

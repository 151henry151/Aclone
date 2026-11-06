// SPDX-License-Identifier: GPL-3.0-or-later
import type { Stock, World } from './types';
import type { StockLife } from './stock-life';
import { rawMeats } from './meat-recipes';
import { meatRules } from './meat-rules';
import { vehicleDef } from './vehicle-config';
export interface MeatLot {
  item: string;
  count: number;
  agedDays: number;
  checkedAt: number;
}
interface Storage {
  stock: Stock;
  life: () => StockLife;
  cold: boolean;
  existing?: StockLife;
}
/** Inventory and freight metadata remain private; buildings expose their counter stock. */
export function* meatStorages(w: World): Generator<Storage> {
  for (const b of w.buildings) {
    const cold = ['butcher', 'kitchen', 'dairyKitchen', 'pub', 'hotel', 'bnb'].includes(b.kind);
    yield { stock: b.stock, life: () => b, existing: b, cold };
    for (const guest of Object.values(b.lodging?.guests ?? {}))
      yield { stock: guest.stock, life: () => (guest.life ??= {}), existing: guest.life, cold };
  }
  for (const p of Object.values(w.players)) {
    yield {
      stock: p.inventory,
      life: () => (p.inventoryLife ??= {}),
      existing: p.inventoryLife,
      cold: false,
    };
    if (p.boatHold)
      yield {
        stock: p.boatHold,
        life: () => (p.boatHoldLife ??= {}),
        existing: p.boatHoldLife,
        cold: vehicleDef(w, p.vehicle).cargoKind === 'fish',
      };
    if (p.boatStores)
      yield {
        stock: p.boatStores,
        life: () => (p.boatStoresLife ??= {}),
        existing: p.boatStoresLife,
        cold: false,
      };
  }
  for (const t of Object.values(w.trailers ?? {}))
    yield {
      stock: t.cargo,
      life: () => (t.life ??= {}),
      existing: t.life,
      cold: t.kind === 'fish',
    };
  for (const b of Object.values(w.mooredBoats ?? {}))
    if (b.cargo)
      yield {
        stock: b.cargo,
        life: () => (b.cargoLife ??= {}),
        existing: b.cargoLife,
        cold: vehicleDef(w, b.slot).cargoKind === 'fish',
      };
  for (const b of Object.values(w.boatRescues ?? {})) {
    yield { stock: b.cargo, life: () => (b.cargoLife ??= {}), existing: b.cargoLife, cold: false };
    if (b.hold)
      yield {
        stock: b.hold,
        life: () => (b.holdLife ??= {}),
        existing: b.holdLife,
        cold: vehicleDef(w, b.boat.slot).cargoKind === 'fish',
      };
    if (b.provisions)
      yield {
        stock: b.provisions,
        life: () => (b.provisionsLife ??= {}),
        existing: b.provisionsLife,
        cold: false,
      };
  }
}
export function normalizeMeat(stock: Stock, life: StockLife, at: number) {
  const lots: MeatLot[] = [];
  for (const item of rawMeats) {
    const existing = (life.meat ?? [])
      .filter((lot) => lot.item === item && lot.count > 0)
      .sort((a, b) => b.agedDays - a.agedDays);
    const count = Math.max(0, stock[item] ?? 0),
      known = existing.reduce((sum, lot) => sum + lot.count, 0);
    let removed = Math.max(0, known - count);
    for (const lot of existing) {
      const used = Math.min(removed, lot.count);
      removed -= used;
      if (lot.count > used) lots.push({ ...lot, count: lot.count - used });
    }
    if (count > known) lots.push({ item, count: count - known, agedDays: 0, checkedAt: at });
  }
  life.meat = lots;
}
function expireStorage(w: World, location: Storage, at: number) {
  if (!rawMeats.some((item) => location.stock[item] > 0)) {
    // Do not allocate metadata for empty legacy stores. Clear only existing ledgers.
    if (location.existing?.meat) location.existing.meat = [];
    return;
  }
  const life = location.life(),
    limit = meatRules(w.settings).rawMeatSpoilageDays;
  normalizeMeat(location.stock, life, at);
  for (const lot of life.meat!) {
    if (!location.cold && limit > 0 && w.settings.dayLength > 0)
      lot.agedDays += Math.max(0, at - lot.checkedAt) / w.settings.dayLength;
    lot.checkedAt = Math.max(lot.checkedAt, at);
    if (limit > 0 && lot.agedDays + 1e-9 >= limit) {
      location.stock[lot.item] -= lot.count;
      if (!location.stock[lot.item]) delete location.stock[lot.item];
      lot.count = 0;
    }
  }
  life.meat = life.meat!.filter((lot) => lot.count > 0);
}
export function expireMeat(w: World, at = w.time) {
  for (const location of meatStorages(w)) expireStorage(w, location, at);
}
export function expireMeatStock(w: World, stock: Stock, at = w.time) {
  if (!rawMeats.some((item) => stock[item] > 0)) return;
  for (const location of meatStorages(w))
    if (location.stock === stock) {
      expireStorage(w, location, at);
      return;
    }
}
export function addFreshMeat(w: World, stock: Stock, item: string, n: number, at = w.time) {
  if (!rawMeats.includes(item)) {
    stock[item] = (stock[item] ?? 0) + n;
    return;
  }
  for (const location of meatStorages(w))
    if (location.stock === stock) {
      expireStorage(w, location, at);
      const life = location.life();
      normalizeMeat(stock, life, at);
      life.meat!.push({ item, count: n, agedDays: 0, checkedAt: at });
      stock[item] = (stock[item] ?? 0) + n;
      return;
    }
  throw Error('Cannot create fresh meat in an unknown storage location');
}
/** Consume oldest portions first, including when automatic eating is enabled. */
export function consumeStock(w: World, stock: Stock, item: string, count: number, at = w.time) {
  stock[item] -= count;
  if (rawMeats.includes(item))
    for (const location of meatStorages(w))
      if (location.stock === stock) {
        normalizeMeat(stock, location.life(), at);
        return;
      }
}

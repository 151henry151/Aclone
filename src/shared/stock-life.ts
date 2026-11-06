// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Stock } from './types';
import { normalizeYoung, youngAnimals, type YoungCohort } from './livestock';
import { normalizeMeat, type MeatLot } from './meat-freshness';
import { rawMeats } from './meat-recipes';

/** Persistent metadata lives beside its stock, never in the numeric item map. */
export interface StockLife {
  young?: YoungCohort[];
  meat?: MeatLot[];
}
function lifeFor(w: World, stock: Stock): StockLife {
  for (const b of w.buildings) {
    if (b.stock === stock) return b;
    for (const guest of Object.values(b.lodging?.guests ?? {}))
      if (guest.stock === stock) return (guest.life ??= {});
  }
  for (const p of Object.values(w.players)) {
    if (p.inventory === stock) return (p.inventoryLife ??= {});
    if (p.boatHold === stock) return (p.boatHoldLife ??= {});
    if (p.boatStores === stock) return (p.boatStoresLife ??= {});
  }
  for (const t of Object.values(w.trailers ?? {})) if (t.cargo === stock) return (t.life ??= {});
  for (const b of Object.values(w.mooredBoats ?? {}))
    if (b.cargo === stock) return (b.cargoLife ??= {});
  throw Error('Cannot transfer dated stock from an unknown storage location');
}

/** Call only after all access, quantity and capacity checks pass. */
export function transferStock(w: World, source: Stock, dest: Stock, item: string, n: number) {
  if (source === dest) return;
  if (rawMeats.includes(item)) {
    const from = lifeFor(w, source),
      to = lifeFor(w, dest);
    normalizeMeat(source, from, w.time);
    normalizeMeat(dest, to, w.time);
    let remaining = n;
    for (const lot of from.meat!) {
      if (lot.item !== item || !remaining) continue;
      const count = Math.min(remaining, lot.count);
      if (count) to.meat!.push({ ...lot, count, checkedAt: w.time });
      lot.count -= count;
      remaining -= count;
    }
    from.meat = from.meat!.filter((lot) => lot.count > 0);
  }
  if (youngAnimals[item]) {
    const from = lifeFor(w, source),
      to = lifeFor(w, dest);
    const sourceHolder = { stock: source, young: from.young },
      destHolder = { stock: dest, young: to.young };
    normalizeYoung(sourceHolder, w.time);
    normalizeYoung(destHolder, w.time);
    from.young = sourceHolder.young ?? [];
    to.young = destHolder.young ?? [];
    let remaining = n;
    for (const cohort of from.young) {
      if (cohort.item !== item || !remaining) continue;
      const count = Math.min(remaining, cohort.count);
      if (count) to.young.push({ ...cohort, count, careSince: w.time });
      cohort.count -= count;
      remaining -= count;
    }
    from.young = from.young.filter((c) => c.count > 0);
  }
  source[item] -= n;
  dest[item] = (dest[item] ?? 0) + n;
}

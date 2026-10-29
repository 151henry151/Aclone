// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings } from './catalog';
import { isPublicPuddlewick } from './harbour-supply';
import { log } from './simulation';
import type { Building, World } from './types';

/** A small, funded shelf of rod-and-line equipment at public boatyards. */
export function restockBoathouseTackle(w: World, b: Building) {
  if (
    !isPublicPuddlewick(w) ||
    b.kind !== 'boathouse' ||
    !b.government ||
    b.owner !== 'treasury' ||
    b.construction
  )
    return;
  const cost = Math.max(
    Math.ceil(buildings.boathouse.sell.tackle * 0.8),
    ...w.buildings.filter((s) => s.government).map((s) => (s.buy.tackle ?? 0) + 1),
  );
  if (!(b.sell.tackle > cost)) return;
  const have = b.stock.tackle ?? 0;
  const quantity = Math.max(
    0,
    Math.floor(Math.min(8 - have, b.capacity - have, b.investment / cost)),
  );
  if (!quantity) return;
  b.stock.tackle = have + quantity;
  b.investment -= quantity * cost;
  log(w, 'sink', quantity * cost, b.id, 'imports', 'boatyard fishing tackle shipment', {
    building: b.id,
    item: 'tackle',
    quantity,
  });
}

/** Add missing listings once, preserving owners' prices and paused listings. */
export function integrateBoathouseTackle(w: World) {
  if (w.boathouseTackleVersion) return false;
  for (const b of w.buildings) {
    if (b.kind !== 'boathouse') continue;
    for (const side of ['buy', 'sell'] as const)
      if (b[side].tackle === undefined && b.pausedPrices?.[side]?.tackle === undefined)
        b[side].tackle = buildings.boathouse[side].tackle;
    restockBoathouseTackle(w, b);
  }
  w.boathouseTackleVersion = 1;
  w.revision++;
  return true;
}

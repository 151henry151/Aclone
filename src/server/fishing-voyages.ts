// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { mapHalf } from '../shared/terrain';
import { isPublicPuddlewick } from '../shared/harbour-supply';
import { log } from '../shared/simulation';
/** One-time public harbour upgrade. Preserve the entire original terrain domain,
 * including heightmaps and property, while adding navigable water around it. */
export function prepareFishingVoyages(w: World) {
  if (!isPublicPuddlewick(w) || w.fishingVoyageVersion) return false;
  const yard = w.buildings.find(
    (b) =>
      b.id === 'parish-boatyard' &&
      b.kind === 'boathouse' &&
      b.government &&
      b.owner === 'treasury',
  );
  if (!yard) return false;
  w.terrainMapSize ??= mapHalf(w) * 2;
  w.settings.mapSize = Math.min(20000, Math.max(w.settings.mapSize, w.terrainMapSize + 6000));
  yard.capacity = Math.max(yard.capacity, 4000);
  // Working capital buys actual landed catches. Subsequent replenishment comes
  // from fuel sales and exports, not recurring cash gifts.
  const delivery = Math.max(0, 512 - (yard.stock.fuel ?? 0));
  const capital = Math.max(0, 5000000 + delivery * 3600 - yard.investment);
  yard.investment += capital;
  if (capital)
    log(w, 'faucet', capital, 'treasury', yard.id, 'public fish landing working capital');
  if (delivery) {
    yard.stock.fuel = (yard.stock.fuel ?? 0) + delivery;
    yard.investment -= delivery * 3600;
    log(w, 'sink', delivery * 3600, yard.id, 'imports', 'boatyard bunker shipment', {
      building: yard.id,
      item: 'fuel',
      quantity: delivery,
    });
  }
  w.fishingVoyageVersion = 1;
  w.revision++;
  return true;
}

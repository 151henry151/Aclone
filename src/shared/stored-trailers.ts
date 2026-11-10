// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import type { Trailer } from './trailers';
/** Independent storage and a trailer stored with its tractor share visibility/access rules. */
export function trailerStorage(w: Pick<World, 'parkedVehicles'>, t: Trailer) {
  return t.storedAt ?? (t.parkedWith ? w.parkedVehicles?.[t.parkedWith]?.inside : undefined);
}
export function garageOccupied(w: World, building: string) {
  return (
    Object.values(w.parkedVehicles ?? {}).some((v) => v.inside === building) ||
    Object.values(w.trailers ?? {}).some((t) => trailerStorage(w, t) === building)
  );
}

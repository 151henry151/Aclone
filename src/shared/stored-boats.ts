// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { poweredBoat, mooringKey } from './boats';
import { vehiclePaint } from './appearance';

export interface StoredBoatDisplay {
  owner: string;
  slot: number;
  paint?: string;
}

/** Confirmed storage only: old saves never invent a yard for an owned hull. */
export function storedBoatDisplay(w: World, b: Building): StoredBoatDisplay[] {
  if (b.kind !== 'boathouse') return [];
  return Object.values(w.players).flatMap((p) =>
    Object.entries(p.fleetState ?? {}).flatMap(([key, record]) => {
      const slot = Number(key);
      return record.storedAt === b.id &&
        p.fleet?.includes(slot) &&
        p.vehicle !== slot &&
        poweredBoat(slot, w) &&
        !w.mooredBoats?.[mooringKey(p.id, slot)] &&
        w.boatRescues?.[p.id]?.boat.slot !== slot
        ? [{ owner: p.id, slot, paint: vehiclePaint(p, slot) }]
        : [];
    }),
  );
}

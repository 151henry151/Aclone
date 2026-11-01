// SPDX-License-Identifier: GPL-3.0-or-later
import { stockWeight } from './fishing-expedition';
import { hasProvisions, vehicleDef } from './vehicle-config';
import type { Player, World } from './types';

/**
 * Explain why carried cargo will not fit the vehicle a player is changing to,
 * naming the exact weight to unload. Undefined when the load fits. The server
 * rejects the change with this text and the client disables the control with
 * it, so both always agree on the numbers.
 */
export function cargoFitReason(w: World, p: Player, slot: number) {
  const def = vehicleDef(w, slot),
    carried =
      stockWeight(w, p.inventory) + (hasProvisions(slot, w) ? stockWeight(w, p.boatStores) : 0);
  if (carried <= def.capacity) return undefined;
  const walking = slot === 5;
  return `Carrying ${carried} weight; ${walking ? 'on foot you carry' : `the ${def.name} holds`} ${def.capacity}. Unload ${carried - def.capacity} before ${walking ? 'walking' : 'boarding'}.`;
}

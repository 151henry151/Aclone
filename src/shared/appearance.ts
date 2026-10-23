// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player } from './types.ts';
import { vehicles } from './catalog.ts';
import data from '../../data/appearance.json';
export const appearance = data;
export const cottageStyle = (id: string) => data.cottages.find((s) => s.id === id);
export const tractorPaint = (id?: string) => data.paints.find((p) => p.id === id);

/** A legacy finish remains visible until the owner's next paint/purchase action. */
export const vehiclePaint = (
  p: Pick<Player, 'vehicle' | 'vehiclePaints' | 'tractorPaint'>,
  slot = p.vehicle,
) => (p.vehiclePaints === undefined ? p.tractorPaint : p.vehiclePaints[slot]);
export const paintableVehicle = (slot: number) => slot !== 7 && (vehicles[slot]?.fuel ?? 0) > 0;
/** Preserve the old shared finish on already owned machines, never on future purchases. */
export function migrateVehiclePaint(p: Player) {
  if (p.vehiclePaints !== undefined) return;
  p.vehiclePaints = Object.fromEntries(
    (p.fleet ?? [0, 5])
      .filter((slot) => paintableVehicle(slot) && tractorPaint(p.tractorPaint))
      .map((slot) => [slot, p.tractorPaint!]),
  );
  delete p.tractorPaint;
}

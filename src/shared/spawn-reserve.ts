// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { buildingPlan } from './building-shapes';

/** Shared arrival/death-recovery point. Keep enough room to turn a tractor. */
export const PARISH_SPAWN = { x: 0, z: 17 } as const;
export const SPAWN_CLEARANCE = 12;
export function spawnReservations(w: Pick<World, 'towns' | 'zones'>) {
  return [
    { ...PARISH_SPAWN, radius: SPAWN_CLEARANCE },
    ...(w.towns ?? []).map((t) => ({ x: t.x, z: t.z, radius: 8 })),
    ...w.zones.filter((z) => z.kind === 'spawn'),
  ];
}
export function spawnReserved(
  w: Pick<World, 'towns' | 'zones'>,
  x: number,
  z: number,
  padding = 0,
) {
  return spawnReservations(w).some((s) => Math.hypot(x - s.x, z - s.z) < s.radius + padding);
}
/** Check rotated walls, fittings and aprons, not merely the building's centre. */
export function buildingSpawnReason(
  w: Pick<World, 'towns' | 'zones'>,
  b: Parameters<typeof buildingPlan>[0] & Pick<Building, 'x' | 'z' | 'rotation'>,
) {
  const plan = buildingPlan(b),
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const areas = [...plan.volumes, ...(plan.fixtures ?? [])];
  if (plan.apron)
    areas.push({
      ...plan.volumes[0],
      x: plan.apron.x,
      z: plan.apron.z,
      width: plan.apron.radius * 2,
      depth: plan.apron.radius * 2,
    });
  for (const area of areas) {
    const x = b.x + area.x * c + area.z * s,
      z = b.z - area.x * s + area.z * c;
    for (const reserve of spawnReservations(w)) {
      const dx = reserve.x - x,
        dz = reserve.z - z;
      const rx = Math.max(0, Math.abs(dx * c - dz * s) - area.width / 2);
      const rz = Math.max(0, Math.abs(dx * s + dz * c) - area.depth / 2);
      if (Math.hypot(rx, rz) < reserve.radius)
        return 'Keep the town centre and respawn area clear of buildings';
    }
  }
}

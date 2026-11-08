import { bridgeReservedFootprint } from './bridge-geometry';
import { rectanglesOverlap, vehicleFootprint } from './vehicle-footprint';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from './types';
import { obstacleRules } from './obstacle-rules';
import { vehicleDef } from './vehicle-config';
import { spawnReserved } from './spawn-reserve';
import { fishingDock } from './dock';
import { dockReserved } from './boathouse';
import { spaceportPoint } from './spaceport-site';
/** Protect existing public choke points without moving somebody else's vehicle. */
export function parkingBlocker(w: World, p: Player): string | undefined {
  if (!obstacleRules(w.settings).clearRouteParking) return;
  if (
    w.bridges?.some((b) =>
      rectanglesOverlap(bridgeReservedFootprint(b), vehicleFootprint(w, p.vehicle, p)),
    )
  )
    return 'Keep the bridge passage and approaches clear of parked vehicles';
  const v = vehicleDef(w, p.vehicle),
    padding = Math.hypot((v.length ?? 0) / 2, (v.width ?? 0) / 2) || v.collisionRadius || 1.3;
  if (spawnReserved(w, p.x, p.z, padding))
    return 'Keep arrival and town-centre clearances free of parked vehicles';
  if (
    Math.abs(p.x - fishingDock.x) < fishingDock.width / 2 + padding &&
    p.z > fishingDock.rampStart - padding &&
    p.z < fishingDock.z + fishingDock.depth / 2 + padding
  )
    return 'Keep the public jetty route clear of parked vehicles';
  if (w.buildings.some((b) => dockReserved(b, p.x, p.z, padding)))
    return 'Keep the jetty route clear of parked vehicles';
  const s = w.spaceportSite;
  if (s) {
    const gate = spaceportPoint(s, 0, s.fence);
    if (Math.hypot(p.x - gate.x, p.z - gate.z) < 8 + padding)
      return 'Keep the spaceport gate route clear of parked vehicles';
  }
}

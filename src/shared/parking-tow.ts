// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from './types';
import { DAY_SECONDS } from './environment';
import { parkingRules } from './parking-rules';
import { kerbParking, parkingRadius } from './parking-site';
import { roadDistance, townRoads } from './town';
import { buildingPlan, buildingBounds } from './building-shapes';
import { onFarmLand } from './farm-land';
import { log } from './simulation';
import { say } from './messages';
import { recordLife } from './reports';
import { clearParkedRig, relocatedParkedTrailers } from './parked-vehicles';

/** Calendar time, not sky speed or wall time, measures public-road grace. */
export function towExpiredParking(w: World) {
  const rules = parkingRules(w.settings);
  if (!rules.vehiclesPersist) return;
  const roads = townRoads(w);
  for (const [key, v] of Object.entries(w.parkedVehicles ?? {})) {
    if (
      v.inside ||
      w.time - v.parkedAt < rules.parkingGraceDays * DAY_SECONDS ||
      roadDistance(roads, v.x, v.z) > 0
    )
      continue;
    const p = w.players[v.owner];
    if (!p || (p.npc && !rules.parkingNpcs)) continue;
    const owned = w.buildings.filter((b) => b.owner === p.id);
    if (onFarmLand({ ...w, buildings: owned }, v.x, v.z, parkingRadius(w, v.slot))) continue;
    if (
      w.buildings.some((b) => {
        if (b.owner !== p.id && !b.aircraftHangar) return false;
        const bounds = buildingBounds(buildingPlan(b));
        const protectedRadius = Math.max(
          Math.hypot(bounds.width, bounds.depth) / 2 + parkingRadius(w, v.slot),
          b.kind === 'home' || b.aircraftHangar ? rules.parkingSearchRange : 0,
        );
        return Math.hypot(v.x - b.x, v.z - b.z) <= protectedRadius;
      })
    )
      continue;
    const home = w.buildings.find((b) => b.id === p.home && b.owner === p.id && !b.construction);
    const garages = w.buildings
      .filter(
        (b) => b.kind === 'garage' && !b.construction && !!b.aircraftHangar === (v.slot === 2),
      )
      .sort((a, b) => Math.hypot(a.x - v.x, a.z - v.z) - Math.hypot(b.x - v.x, b.z - v.z));
    // A fee is never silently forgiven or turned into an unrequested debt.
    if (p.cash < rules.parkingTowFee) continue;
    for (const destination of [...(home ? [home] : []), ...garages]) {
      const point = kerbParking(w, destination, v.slot, key, (point) =>
        clearParkedRig(w, key, point),
      );
      if (!point) continue;
      const moved = relocatedParkedTrailers(w, key, point);
      Object.assign(v, point, { parkedAt: w.time });
      if (destination.kind === 'garage') v.inside = destination.id;
      for (const t of moved) Object.assign(w.trailers![t.id], t);
      p.cash -= rules.parkingTowFee;
      log(w, 'sink', rules.parkingTowFee, p.id, 'treasury', 'public-road parking tow');
      const message = `Your ${v.slot === 2 ? 'aircraft' : 'vehicle'} was towed to ${destination.name}. Parking fee ${(rules.parkingTowFee / 100).toFixed(2)}d.`;
      recordLife(w, p, {
        kind: 'property',
        text: message,
        building: destination.id,
        amount: rules.parkingTowFee,
      });
      say(w, 'Parking', message, 'system', p.id);
      break;
    }
  }
}

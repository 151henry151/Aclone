// SPDX-License-Identifier: GPL-3.0-or-later
import { makeBuilding } from '../shared/simulation';
import { constructionSiteReason, foundationProfile } from '../shared/construction-site';
import { fishingDock } from '../shared/dock';
import { buildings } from '../shared/catalog';
import type { World } from '../shared/types';
/** Add a public boatyard without moving existing property or reshaping the coastline. */
export function ensurePuddlewickBoatyard(w: World) {
  if (w.id !== 'puddlewick' || w.boatyardVersion) return false;
  if (w.buildings.some((b) => b.id === 'parish-boatyard')) return false;
  const candidates = [];
  for (let x = -220; x <= 220; x += 8)
    for (let z = 120; z <= 156; z += 2)
      if (Math.hypot(x - fishingDock.x, z - fishingDock.z) > 60) candidates.push({ x, z });
  candidates.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (const point of candidates) {
    const b = makeBuilding('parish-boatyard', 'boathouse', point.x, point.z);
    b.rotation = Math.PI;
    b.architecture = 'model-1';
    b.style = 'red-timber';
    if (
      constructionSiteReason(w, b) ||
      w.buildings.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < 30)
    )
      continue;
    Object.assign(b, {
      name: 'Puddlewick boatyard',
      owner: 'treasury',
      government: true,
      forSale: false,
      investment: 500000,
      stock: { fuel: 250 },
      foundationY: foundationProfile(w, b).level,
    });
    w.buildings.push(b);
    w.boatyardVersion = 1;
    w.revision++;
    // New catch buyers, without rewriting existing player prices or balances.
    for (const o of w.buildings.filter(
      (o) => o.government && ['market', 'starport'].includes(o.kind),
    ))
      for (const id of ['cod', 'halibut', 'tuna']) {
        o.buy[id] ??= buildings[o.kind].buy[id];
        o.sell[id] ??= buildings[o.kind].sell[id];
      }
    return true;
  }
  return false;
}

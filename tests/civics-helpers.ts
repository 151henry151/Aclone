// SPDX-License-Identifier: GPL-3.0-or-later
import { addPlayer, terrainHeight } from '../src/shared/simulation.ts';
import type { World } from '../src/shared/types.ts';

/** A dry, open site at least `from` metres east of the parish centre. */
export function drySite(w: World, from = 1500) {
  for (let x = from; x < from + 2000; x += 25)
    for (let z = -1000; z <= 1000; z += 25)
      if (
        terrainHeight(w, x, z) > w.settings.seaLevel + 2 &&
        w.buildings.every((b) => Math.hypot(b.x - x, b.z - z) > 40)
      )
        return { x, z };
  throw Error('No dry site');
}
/** A dry, open site `d` metres from (cx, cz). */
export function siteAt(w: World, d: number, cx = 0, cz = 0) {
  for (let a = 0; a < Math.PI * 2; a += 0.05) {
    const x = Math.round(cx + Math.cos(a) * d),
      z = Math.round(cz + Math.sin(a) * d);
    if (
      terrainHeight(w, x, z) > w.settings.seaLevel + 2 &&
      w.buildings.every((b) => Math.hypot(b.x - x, b.z - z) > 40)
    )
      return { x, z };
  }
  throw Error('No dry site at ' + d);
}
export function founder(w: World, id = 'f', from = 1500) {
  const p = addPlayer(w, id, 'Founder ' + id);
  p.cash = 10_000_000;
  Object.assign(p, drySite(w, from));
  return p;
}

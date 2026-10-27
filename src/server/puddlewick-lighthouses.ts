// SPDX-License-Identifier: GPL-3.0-or-later
import { makeBuilding } from '../shared/simulation';
import { constructionSiteReason, foundationProfile } from '../shared/construction-site';
import { terrainHalf, terrainHeight } from '../shared/terrain';
import { highWater } from '../shared/ocean';
import type { World } from '../shared/types';
/** Find dry, unobstructed coastal sites without moving property or changing terrain. */
export function ensurePuddlewickLighthouses(w: World) {
  if (
    w.id !== 'puddlewick' ||
    (w.owner !== 'server' && !w.publicParishVersion) ||
    w.template !== 'economy' ||
    w.lighthouseVersion
  )
    return false;
  const half = terrainHalf(w);
  if (half < 1000) return false;
  let changed = false;
  for (const [id, name, side, architecture] of [
    ['parish-west-light', 'West Cape lighthouse', -1, 'model-1'],
    ['parish-east-light', 'East Cape lighthouse', 1, 'model-4'],
    ['parish-harbour-light', 'Puddlewick harbour light', 0, 'model-2'],
  ] as const) {
    if (w.buildings.some((b) => b.id === id)) continue;
    const candidates: { x: number; z: number; score: number }[] = [];
    const step = side ? 40 : 8;
    for (let x = side ? half * 0.35 : -350; x <= (side ? half * 0.88 : 350); x += step)
      for (let z = side ? half * 0.65 : 100; z <= (side ? half * 0.92 : 280); z += step) {
        const px = side ? x * side : x,
          h = terrainHeight(w, px, z);
        if (h < highWater(w) + 0.5 || h > 30) continue;
        const coastal = [
          [0, 80],
          [80, 0],
          [-80, 0],
          [0, -80],
        ].some(([dx, dz]) => terrainHeight(w, px + dx, z + dz) < highWater(w));
        if (coastal) candidates.push({ x: px, z, score: side ? -z + h * 3 : Math.hypot(px, z) });
      }
    candidates.sort((a, b) => a.score - b.score);
    for (const point of candidates) {
      const b = makeBuilding(id, 'lighthouse', point.x, point.z);
      b.architecture = architecture;
      b.style = 'stone-gable';
      if (
        constructionSiteReason(w, b) ||
        Object.values(w.players).some((p) => Math.hypot(p.x - b.x, p.z - b.z) < 25) ||
        w.buildings.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < 35)
      )
        continue;
      Object.assign(b, {
        name,
        owner: 'treasury',
        government: false,
        forSale: true,
        investment: 0,
        foundationY: foundationProfile(w, b).level,
      });
      w.buildings.push(b);
      changed = true;
      break;
    }
  }
  if (
    ['parish-west-light', 'parish-east-light', 'parish-harbour-light'].every((id) =>
      w.buildings.some((b) => b.id === id),
    )
  ) {
    w.lighthouseVersion = 1;
    changed = true;
  }
  if (changed) w.revision++;
  return changed;
}

import { worldResources } from '../shared/resources';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { terrainHeight, terrainHalf } from '../shared/terrain';
import { spaceportApron } from '../shared/building-shapes';
import { roadRoute, roadSite } from '../shared/road-routing';
import { safeNearest } from '../shared/road-projects';
import { townRoads } from '../shared/town';
/** Relocate the existing public service, retaining its ID, inventory, prices and accounts.
 * Fail closed if private development leaves no suitable vacant launch reservation. */
export function ensurePuddlewickSpaceport(w: World) {
  if (
    w.spaceportSite ||
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    (w.owner !== 'server' && !w.publicParishVersion)
  )
    return false;
  const port = w.buildings.find(
    (b) => b.kind === 'starport' && b.government && (!b.owner || b.owner === 'treasury'),
  );
  if (!port) return false;
  const half = terrainHalf(w),
    candidates = [];
  const resources = worldResources(w);
  for (let x = -half + 1000; x <= half - 1000; x += 200)
    for (let z = -half + 1000; z <= -1800; z += 200) {
      if (w.buildings.some((b) => b !== port && Math.hypot(b.x - x, b.z - z) < 5200)) continue;
      if (w.creator?.objects.some((o) => Math.hypot(o.x - x, o.z - z) < 5200 + o.radius)) continue;
      if (resources.some((n) => Math.hypot(n.x - x, n.z - z) < 350)) continue;
      if (Object.values(w.players).some((p) => Math.hypot(p.x - x, p.z - z) < 350)) continue;
      if (w.coastalBluffs?.some((b) => Math.hypot(b.x - x, b.z - z) < 1000)) continue;
      const height = terrainHeight(w, x, z);
      let low = height,
        high = height;
      for (let a = 0; a < 32; a++) {
        const h = terrainHeight(
          w,
          x + 650 * Math.cos((a * Math.PI) / 16),
          z + 650 * Math.sin((a * Math.PI) / 16),
        );
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
      if (low <= w.settings.seaLevel + 4) continue;
      candidates.push({ x, z, height, score: Math.hypot(x, z) + (high - low) * 12 });
    }
  candidates.sort((a, b) => a.score - b.score);
  for (const c of candidates.slice(0, 12)) {
    const site = {
      x: c.x,
      z: c.z,
      height: c.height,
      building: port.id,
      exclusion: 1000,
      fence: 600,
    };
    const moved = {
      ...port,
      x: c.x - spaceportApron.x,
      z: c.z - spaceportApron.z,
      rotation: 0,
      foundationY: c.height + 0.04,
    };
    const trial = {
      ...w,
      spaceportSite: site,
      buildings: w.buildings.map((b) => (b === port ? moved : b)),
    };
    const entry = { x: c.x + 600 / Math.sqrt(2), z: c.z + 600 / Math.sqrt(2) };
    const goal = { x: moved.x, z: moved.z + 16 };
    const roads = townRoads(w),
      near = safeNearest(roads, entry, roadSite(trial, 6));
    if (!near) continue;
    // Route to the open gate and terminal, checking all existing property and farmland.
    const outside = roadRoute(trial, near, entry, 6),
      inside = roadRoute(trial, entry, goal, 6);
    if (!outside || !inside) continue;
    Object.assign(port, moved);
    w.spaceportSite = site;
    w.zones.push({
      id: 'puddlewick-launch-reserve',
      kind: 'noBuild',
      x: c.x,
      z: c.z,
      radius: 1000,
    });
    w.roads ??= [];
    const path = [...outside, ...inside.slice(1)];
    w.spaceportSite.access = path;
    for (let i = 1; i < path.length; i++) w.roads.push({ a: path[i - 1], b: path[i], width: 6 });
    w.revision++;
    return true;
  }
  return false;
}

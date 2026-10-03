// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings, recipes, checkpoints } from '../shared/catalog.ts';
import { buildingBounds, buildingPlan } from '../shared/building-shapes.ts';
import { creatorBlocks } from '../shared/creator.ts';
import { fishingDock } from '../shared/dock.ts';
import { resourceNodes } from '../shared/resources.ts';
import { waterworksSite } from '../shared/shoreline.ts';
import { makeBuilding, log } from '../shared/simulation.ts';
import { terrainHeight } from '../shared/terrain.ts';
import { townRoads, roadDistance, type Point } from '../shared/town.ts';
import type { Building, World } from '../shared/types.ts';

function radius(b: Building) {
  const bounds = buildingBounds(buildingPlan(b));
  return Math.hypot(
    Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
    Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
  );
}

/** Complete only the host's default parish, never a player's designed world.
 * Record each satisfied type so demolition or a later stock shortage is respected.
 * Blocked lots remain pending and can be retried at a subsequent startup. */
export function completePuddlewick(w: World): boolean {
  if (w.id !== 'puddlewick' || w.owner !== 'server' || w.template !== 'economy') return false;
  const completed = new Set(w.parishServices ?? []);
  const missing = Object.keys(buildings).filter((kind) => !completed.has(kind));
  if (!missing.length) return false;
  const roads = townRoads(w);
  const candidates: (Point & { road: number })[] = [];
  for (let z = -216; z <= 152; z += 8)
    for (let x = -216; x <= 216; x += 8) candidates.push({ x, z, road: roadDistance(roads, x, z) });
  // The dry strip can be narrower than the inland grid, especially after sea-level edits.
  const shoreline: (Point & { road: number })[] = [];
  if (missing.includes('waterworks') && !w.buildings.some((b) => b.kind === 'waterworks'))
    for (let z = -216; z <= 160; z += 4)
      for (let x = -216; x <= 216; x += 16)
        if (waterworksSite(w, { x, z })) shoreline.push({ x, z, road: roadDistance(roads, x, z) });
  let changed = false;
  for (const kind of missing) {
    if (w.buildings.some((b) => b.kind === kind)) {
      completed.add(kind);
      changed = true;
      continue;
    }
    if (w.buildings.length >= 500) break;
    let id = 'parish-' + kind;
    while (w.buildings.some((b) => b.id === id)) id += '-new';
    const b = makeBuilding(id, kind, 0, 0),
      r = radius(b);
    const occupied = w.buildings.map((other) => ({ ...other, radius: radius(other) }));
    const sites = (kind === 'waterworks' ? shoreline : candidates).filter((p) => {
      if (p.road <= r + 2) return false;
      if (
        occupied.some((other) => Math.hypot(other.x - p.x, other.z - p.z) <= r + other.radius + 8)
      )
        return false;
      if (
        w.zones.some(
          (zone) =>
            zone.kind === 'noBuild' && Math.hypot(zone.x - p.x, zone.z - p.z) <= zone.radius + r,
        )
      )
        return false;
      if (
        Object.values(w.players).some(
          (player) => Math.hypot(player.x - p.x, player.z - p.z) <= r + 10,
        )
      )
        return false;
      if (resourceNodes.some((node) => Math.hypot(node.x - p.x, node.z - p.z) <= r + 12))
        return false;
      if (checkpoints.some((point) => Math.hypot(point.x - p.x, point.z - p.z) <= r + 14))
        return false;
      // Keep the fishing approach, Hornball pitch and default combat bases open.
      if (Math.hypot(p.x - fishingDock.x, p.z - fishingDock.z) < r + 25) return false;
      if (p.x > 60 - r - 6 && p.x < 120 + r + 6 && p.z > 20 - r - 6 && p.z < 70 + r + 6)
        return false;
      if ([-100, 100].some((x) => Math.hypot(p.x - x, p.z + 110) < r + 20)) return false;
      if (creatorBlocks(w, p.x, p.z, terrainHeight(w, p.x, p.z), r + 2)) return false;
      if (kind === 'waterworks') return !!waterworksSite(w, p);
      return [-r, 0, r].every((dx) =>
        [-r, 0, r].every((dz) => terrainHeight(w, p.x + dx, p.z + dz) > w.settings.seaLevel + 0.2),
      );
    });
    // Prefer nearby lanes while distributing additions through the existing town.
    sites.sort((a, b) => a.road - b.road || a.z - b.z || a.x - b.x);
    const site = sites[0];
    if (!site) continue;
    b.x = site.x;
    b.z = site.z;
    if (kind === 'waterworks') b.rotation = waterworksSite(w, site)!.rotation;
    else {
      let nearest: Point | undefined,
        distance = Infinity;
      for (const { a, b: end } of roads) {
        const dx = end.x - a.x,
          dz = end.z - a.z;
        const t = Math.max(
          0,
          Math.min(1, ((site.x - a.x) * dx + (site.z - a.z) * dz) / (dx * dx + dz * dz)),
        );
        const point = { x: a.x + dx * t, z: a.z + dz * t };
        const d = Math.hypot(point.x - site.x, point.z - site.z);
        if (d < distance) {
          distance = d;
          nearest = point;
        }
      }
      if (nearest) b.rotation = Math.atan2(nearest.x - b.x, nearest.z - b.z);
    }
    if (b.recipe) {
      const recipe = recipes[b.recipe];
      // Stock is a one-time opening supply, not an unlimited public faucet.
      for (const [item, quantity] of Object.entries(recipe.inputs))
        b.stock[item] = Math.min(b.capacity, Math.max(b.stock[item] ?? 0, quantity * 5));
      for (const [item, quantity] of Object.entries(recipe.outputs))
        b.stock[item] = Math.min(b.capacity, Math.max(b.stock[item] ?? 0, quantity * 3));
      b.investment = Math.min(Math.floor(b.price / 4), b.wage * 10);
      log(w, 'faucet', b.investment, 'treasury', b.id, 'parish opening capital');
    }
    w.buildings.push(b);
    completed.add(kind);
    changed = true;
  }
  if (changed) {
    w.parishServices = [...completed];
    w.revision++;
  }
  return changed;
}

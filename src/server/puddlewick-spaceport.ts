import { spaceportPoint } from '../shared/spaceport-site';
import { worldResources } from '../shared/resources';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { terrainHeight, terrainHalf } from '../shared/terrain';
import { spaceportApron } from '../shared/building-shapes';
import { roadRoute, roadSite } from '../shared/road-routing';
import { safeNearest } from '../shared/road-projects';
import { townRoads, roadKey } from '../shared/town';
/** Relocate the existing public service, retaining its ID, inventory, prices and accounts.
 * Fail closed if private development leaves no suitable vacant launch reservation. */
export function ensurePuddlewickSpaceport(w: World) {
  if (
    w.spaceportSite?.layout === 3 ||
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    (w.owner !== 'server' && !w.publicParishVersion && w.spaceportSite?.layout !== 2)
  )
    return false;
  const port = w.buildings.find(
    (b) => b.kind === 'starport' && b.government && (!b.owner || b.owner === 'treasury'),
  );
  if (!port) return false;
  if (w.spaceportSite?.layout === 2) return upgradeSpaceportComplex(w, port);
  const previous = w.spaceportSite;
  const oldKeys = new Set(
    (previous?.access ?? [])
      .slice(1)
      .map((b, i) => roadKey({ a: previous!.access![i], b, width: 6 })),
  );
  const base = {
    ...w,
    spaceportSite: undefined,
    roads: (w.roads ?? []).filter((r) => !oldKeys.has(roadKey(r))),
    zones: w.zones.filter((z) => z.id !== 'puddlewick-launch-reserve'),
  };
  const half = terrainHalf(w),
    candidates = [];
  const origin = w.towns[0] ?? { x: 0, z: 0 };
  const resources = worldResources(w);
  for (const radius of [1150, 1200, 1250])
    for (let step = 0; step < 72; step++) {
      const angle = (step * Math.PI) / 36,
        x = Math.round((origin.x ?? 0) + radius * Math.cos(angle)),
        z = Math.round((origin.z ?? 0) + radius * Math.sin(angle));
      if (Math.abs(x) > half - 650 || Math.abs(z) > half - 650) continue;
      if (w.buildings.some((b) => b !== port && Math.hypot(b.x - x, b.z - z) < 650)) continue;
      if (w.creator?.objects.some((o) => Math.hypot(o.x - x, o.z - z) < 650 + o.radius)) continue;
      if (resources.some((n) => Math.hypot(n.x - x, n.z - z) < 150)) continue;
      if (Object.values(w.players).some((p) => Math.hypot(p.x - x, p.z - z) < 350)) continue;
      if (w.coastalBluffs?.some((b) => Math.hypot(b.x - x, b.z - z) < 650)) continue;
      if (
        w.airfield &&
        Math.hypot(w.airfield.x - x, w.airfield.z - z) < 650 + w.airfield.length / 2
      )
        continue;
      const height = terrainHeight(base, x, z);
      let low = height,
        high = height;
      for (let a = 0; a < 32; a++) {
        const h = terrainHeight(
          base,
          x + 650 * Math.cos((a * Math.PI) / 16),
          z + 650 * Math.sin((a * Math.PI) / 16),
        );
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
      if (low <= w.settings.seaLevel + 4) continue;
      candidates.push({ x, z, height, score: radius + (high - low) * 12 });
    }
  candidates.sort((a, b) => a.score - b.score);
  for (const c of candidates.slice(0, 12)) {
    const site = {
      layout: 2,
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
      ...base,
      spaceportSite: site,
      buildings: w.buildings.map((b) => (b === port ? moved : b)),
    };
    const entry = { x: c.x + 600 / Math.sqrt(2), z: c.z + 600 / Math.sqrt(2) };
    const goal = { x: moved.x, z: moved.z + 16 };
    const roads = townRoads(base),
      near = safeNearest(roads, entry, roadSite(trial, 6));
    if (!near) continue;
    // Route to the open gate and terminal, checking all existing property and farmland.
    const outside = roadRoute(trial, near, entry, 6),
      inside = roadRoute(trial, entry, goal, 6);
    if (!outside || !inside) continue;
    Object.assign(port, moved);
    w.roads = base.roads;
    w.zones = base.zones;
    delete w.roadProject;
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
    upgradeSpaceportComplex(w, port);
    return true;
  }
  return false;
}

/** Keep launch coordinates and business identity while moving only the service terminal. */
function upgradeSpaceportComplex(w: World, port: World['buildings'][number]) {
  const s = w.spaceportSite!;
  if (
    Object.values(w.players).some(
      (p) => (p.atHome && p.home === port.id) || p.task?.building === port.id,
    )
  )
    return false;
  const position = spaceportPoint(s, 30, s.fence - 35);
  const gate = spaceportPoint(s, 0, s.fence);
  const site = { ...s, layout: 3, entryHeight: terrainHeight(w, gate.x, gate.z) };
  const ground = terrainHeight({ ...w, spaceportSite: site }, position.x, position.z) + 0.04;
  const moved = {
    ...port,
    ...position,
    rotation: 0,
    foundationY: ground,
    launchOffset: {
      x: s.x - spaceportApron.x - position.x,
      y: s.height + 0.04 - ground,
      z: s.z - spaceportApron.z - position.z,
    },
  };
  const trial = {
    ...w,
    spaceportSite: site,
    buildings: w.buildings.map((b) => (b === port ? moved : b)),
  };
  const branch = roadRoute(trial, gate, { x: moved.x, z: moved.z + 16 }, 6);
  if (!branch) return false;
  const old = s.access ?? [];
  let nearest = 0;
  for (let i = 1; i < old.length; i++)
    if (
      Math.hypot(old[i].x - gate.x, old[i].z - gate.z) <
      Math.hypot(old[nearest].x - gate.x, old[nearest].z - gate.z)
    )
      nearest = i;
  site.access = [...old.slice(0, nearest), ...branch];
  Object.assign(port, moved);
  w.spaceportSite = site;
  w.roads ??= [];
  for (let i = 1; i < branch.length; i++)
    w.roads.push({ a: branch[i - 1], b: branch[i], width: 6 });
  delete w.roadProject;
  w.revision++;
  return true;
}

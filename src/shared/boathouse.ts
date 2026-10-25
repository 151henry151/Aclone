import { boatSlot, mooringKey } from './boats';
// SPDX-License-Identifier: GPL-3.0-or-later
import { blocksBuilding, buildingPlan } from './building-shapes';
import { creatorBlocks } from './creator';
import { onFarmLand } from './farm-land';
import { fishingDock, travelHeight } from './dock';
import { mapHalf, terrainHeight } from './terrain';
import type { Building, Player, World } from './types';

type Site = Pick<
  Building,
  'id' | 'kind' | 'x' | 'z' | 'rotation' | 'style' | 'architecture' | 'size'
>;
export function dockPoint(b: Pick<Site, 'x' | 'z' | 'rotation'>, x: number, z: number) {
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return { x: b.x + x * c + z * s, z: b.z - x * s + z * c };
}
/** A dry workshop, an over-water lifting hall and a side boarding berth.
 * Dimensions include clearance around the twenty-one-metre boats, not just its origin. */
export function boathouseSite(w: World, b: Site) {
  const sea = w.settings.seaLevel;
  const sample = (x: number, z: number) => {
    const p = dockPoint(b, x, z);
    return Math.max(Math.abs(p.x), Math.abs(p.z)) < mapHalf(w) - 2
      ? terrainHeight(w, p.x, p.z)
      : NaN;
  };
  for (const v of buildingPlan(b).volumes)
    for (let x = -v.width / 2; x <= v.width / 2 + 0.01; x += v.width / Math.ceil(v.width))
      for (let z = -v.depth / 2; z <= v.depth / 2 + 0.01; z += v.depth / Math.ceil(v.depth))
        if (!(sample(v.x + x, v.z + z) >= sea + 0.2)) return undefined;
  // Keep the gangway gentle and the shore landing wide enough for a tractor.
  if (!(sample(0, 0) <= sea + 3)) return undefined;
  for (const x of [-2, 0, 2])
    for (const z of [9, 10, 11]) if (!(sample(x, z) >= sea + 0.2)) return undefined;
  // The slip inside the covered hall and the outside berth both need room
  // for the full hull, including its bow/stern and draft.
  for (const centre of [0, 12.3])
    for (let x = centre - 4.1; x <= centre + 4.1; x += 1)
      for (let z = -44; z <= -22; z += 1) if (!(sample(x, z) <= sea - 1.1)) return undefined;

  return {
    berth: dockPoint(b, 12.3, -33),
    land: dockPoint(b, 0, 10),
    heading: b.rotation + Math.PI,
  };
}
export function dockReserved(b: Site, x: number, z: number, padding = 0) {
  if (b.kind !== 'boathouse') return false;
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  return lx > -7 - padding && lx < 17 + padding && lz > -45 - padding && lz < -7 + padding;
}
/** Rechecked at boarding: later terrain edits or another parked vehicle can close a berth. */
export function dockObstruction(w: World, b: Site, players = false, except?: string) {
  for (let x = -7; x <= 17; x += 2)
    for (let z = -44; z <= -7; z += 2) {
      const p = dockPoint(b, x, z);
      if (
        w.buildings.some(
          (o) =>
            o.id !== b.id && (blocksBuilding(o, p.x, p.z, 0, 1) || dockReserved(o, p.x, p.z, 1)),
        ) ||
        onFarmLand(w, p.x, p.z, 1) ||
        creatorBlocks(w, p.x, p.z, w.settings.seaLevel, 1) ||
        w.zones.some((o) => o.kind === 'noBuild' && Math.hypot(o.x - p.x, o.z - p.z) < o.radius + 1)
      )
        return 'Keep the boathouse jetty and berth clear of buildings, farm plots and obstacles';
    }
  if (players) {
    const p = dockPoint(b, 12.3, -33);
    if (
      Object.values(w.players).some(
        (q) =>
          q.id !== except &&
          !q.hitch &&
          q.online &&
          !q.atHome &&
          Math.hypot(q.x - p.x, q.z - p.z) < 10,
      )
    )
      return 'The boat berth is occupied; wait for it to clear';
  }
  return undefined;
}
export function aboardBoat(w: World, p: Player) {
  return boatSlot(p.vehicle) || (!!p.hitch && boatSlot(w.players[p.hitch]?.vehicle));
}

export interface BoatLanding {
  id: string;
  berth: { x: number; z: number };
  land: { x: number; z: number };
  heading: number;
  building?: Building;
}
export function boatLandings(w: World): BoatLanding[] {
  const docks: BoatLanding[] = w.buildings.flatMap((b) => {
    const site = b.kind === 'boathouse' && !b.construction && boathouseSite(w, b);
    return site ? [{ id: b.id, building: b, ...site }] : [];
  });
  for (const side of [-1, 1])
    // Long boats use the deep outer end, with their boarding point on the existing deck.
    for (const z of [169]) {
      const berth = { x: fishingDock.x + side * 12.6, z };
      let wet = true;
      for (const dx of [-4.1, 0, 4.1])
        for (const dz of [-10.5, 0, 10.5])
          if (terrainHeight(w, berth.x + dx, berth.z + dz) > w.settings.seaLevel - 1.1) wet = false;
      if (wet)
        docks.push({
          id: `${fishingDock.id}:${side}:${z}`,
          berth,
          land: { x: fishingDock.x + side * 5, z: fishingDock.z + fishingDock.depth / 2 },
          heading: 0,
        });
    }
  return docks;
}
export function boatLanding(w: World, p: Pick<Player, 'x' | 'z'>, afloat: boolean, id?: unknown) {
  return boatLandings(w).find(
    (d) =>
      (id === undefined || d.id === id || (id === fishingDock.id && !d.building)) &&
      Math.hypot(p.x - (afloat ? d.berth.x : d.land.x), p.z - (afloat ? d.berth.z : d.land.z)) <= 5,
  );
}
export function landingBlocked(
  w: World,
  d: BoatLanding,
  p: Player,
  board: boolean,
  slot = p.vehicle,
) {
  if (d.building) {
    const reason = dockObstruction(w, d.building);
    if (reason) return reason;
  }
  const point = board ? d.berth : d.land;
  const height = board ? w.settings.seaLevel : travelHeight(w, point.x, point.z);
  if (
    w.buildings.some((b) => blocksBuilding(b, point.x, point.z, 0, board ? 5 : 1.5)) ||
    creatorBlocks(w, point.x, point.z, height, board ? 5 : 1.5)
  )
    return 'The boat berth or shore landing is blocked';
  if (
    Object.values(w.players).some(
      (q) =>
        q.id !== p.id &&
        q.online &&
        !q.atHome &&
        !q.hitch &&
        Math.hypot(q.x - point.x, q.z - point.z) < (board ? 5 : 2),
    )
  )
    return 'The berth or landing is occupied; wait for it to clear';
  if (
    Object.entries(w.boatRescues ?? {}).some(
      ([id, r]) =>
        id !== p.id &&
        r.dinghy.moored &&
        Math.hypot(r.dinghy.x - d.berth.x, r.dinghy.z - d.berth.z) < 5,
    )
  )
    return 'Another lifeboat occupies this berth';
  if (
    Object.entries(w.mooredBoats ?? {}).some(
      ([id, b]) =>
        id !== mooringKey(p.id, slot) && Math.hypot(b.x - d.berth.x, b.z - d.berth.z) < 5,
    )
  )
    return 'This berth has a moored boat; use another berth';
}

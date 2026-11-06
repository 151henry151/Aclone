import { rowboatBeach, beachedLanding } from './rowboat-shore';
import { ROWBOAT, rowboatRules } from './rowboat-rules';
import { quaySite, quayReserved, QUAY } from './quay';
import { boatNavigationRules } from './boat-navigation-rules';
import { waterLevel, highWater, lowWater, surfaceWaterLevel } from './ocean';
import { RIVER_DOCK, riverDockAccepts, riverDockReserved, riverDockSite } from './river-dock';
import { boatSlot, mooringKey, CARGO_BOAT } from './boats';
import { vehicleDef } from './vehicle-config';
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
export function boathouseSite(w: World, b: Site, newSite = false) {
  const sea = w.settings.seaLevel,
    dry = newSite ? highWater(w) : sea,
    wet = newSite ? lowWater(w) : sea;
  const sample = (x: number, z: number) => {
    const p = dockPoint(b, x, z);
    return Math.max(Math.abs(p.x), Math.abs(p.z)) < mapHalf(w) - 2
      ? terrainHeight(w, p.x, p.z)
      : NaN;
  };
  for (const v of buildingPlan(b).volumes)
    for (let x = -v.width / 2; x <= v.width / 2 + 0.01; x += v.width / Math.ceil(v.width))
      for (let z = -v.depth / 2; z <= v.depth / 2 + 0.01; z += v.depth / Math.ceil(v.depth))
        if (!(sample(v.x + x, v.z + z) >= dry + 0.2)) return undefined;
  // Keep the gangway gentle and the shore landing wide enough for a tractor.
  if (!(sample(0, 0) <= dry + 3)) return undefined;
  for (const x of [-2, 0, 2])
    for (const z of [9, 10, 11]) if (!(sample(x, z) >= dry + 0.2)) return undefined;
  // The slip inside the covered hall and the outside berth both need room
  // for the full hull, including its bow/stern and draft.
  for (const centre of [0, 12.3])
    for (let x = centre - 4.1; x <= centre + 4.1; x += 1)
      for (let z = -44; z <= -22; z += 1) if (!(sample(x, z) <= wet - 1.1)) return undefined;

  return {
    berth: dockPoint(b, 12.3, -33),
    land: dockPoint(b, 0, 10),
    heading: b.rotation + Math.PI,
  };
}
export function dockReserved(b: Site, x: number, z: number, padding = 0) {
  if (b.kind === 'quay') return quayReserved(b, x, z, padding);
  if (b.kind === RIVER_DOCK) return riverDockReserved(b, x, z, padding);
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
  for (
    let x = b.kind === 'quay' ? -QUAY.frontage / 2 : -7;
    x <= (b.kind === 'quay' ? QUAY.frontage / 2 : 17);
    x += 2
  )
    for (
      let z = b.kind === 'quay' ? -QUAY.berthZ - QUAY.berthBeam / 2 : -44;
      z <= (b.kind === 'quay' ? -QUAY.gangwayStart : -7);
      z += 2
    ) {
      const p = dockPoint(b, x, z);
      if (
        w.buildings.some(
          (o) =>
            o.id !== b.id && (blocksBuilding(o, p.x, p.z, 0, 1) || dockReserved(o, p.x, p.z, 1)),
        ) ||
        onFarmLand(w, p.x, p.z, 1) ||
        creatorBlocks(w, p.x, p.z, waterLevel(w), 1) ||
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
  return boatSlot(p.vehicle, w) || (!!p.hitch && boatSlot(w.players[p.hitch]?.vehicle, w));
}

export interface BoatLanding {
  id: string;
  berth: { x: number; z: number };
  land: { x: number; z: number };
  heading: number;
  /** Boathouses store boats out of sight; landings without one keep them moored. */
  building?: Building;
  /** Small-craft river berth: canal boats and motorboats only. */
  river?: true;
  quay?: true;
  beached?: true;
}
export function boatLandings(w: World, slot?: number): BoatLanding[] {
  const docks: BoatLanding[] = w.buildings.flatMap((b): BoatLanding[] => {
    if (b.construction) return [];
    if (b.kind === RIVER_DOCK) {
      const site = riverDockSite(w, b);
      return site
        ? [{ id: b.id, berth: site.berth, land: site.land, heading: site.heading, river: true }]
        : [];
    }
    if (b.kind === 'quay') {
      const site = quaySite(w, b);
      return site ? [{ id: b.id, quay: true, ...site }] : [];
    }
    const site = b.kind === 'boathouse' && boathouseSite(w, b);
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
  for (const b of Object.values(w.mooredBoats ?? {})) {
    const d = beachedLanding(w, b);
    if (d) docks.push(d);
  }
  for (const p of Object.values(w.players)) {
    if (p.hitch) continue;
    const d = rowboatBeach(w, p);
    if (d) docks.push(d);
  }
  return slot === undefined ? docks : docks.map((d) => vesselLanding(w, d, slot));
}

/** Keep the shore entrance and structure fixed; larger hulls lie outside the old berth. */
function vesselLanding(w: World, d: BoatLanding, slot: number): BoatLanding {
  if (d.river || d.beached) return d;
  const v = vehicleDef(w, slot);
  if (v.draft === undefined) return d;
  const halfLength = (v.length ?? 0) / 2,
    halfBeam = (v.beam ?? 0) / 2;
  const s = Math.sin(d.heading),
    c = Math.cos(d.heading);
  let forward = 0,
    side = 0;
  if (d.quay) side = Math.max(0, halfBeam - QUAY.berthBeam / 2);
  else if (d.building) {
    forward = Math.max(0, halfLength - 11);
    side = -Math.max(0, halfBeam - 4.1);
  } else {
    forward = Math.max(0, halfLength - 10.5);
    side = Math.sign(d.berth.x - fishingDock.x) * Math.max(0, halfBeam - 4.1);
  }
  const berth = { x: d.berth.x + s * forward + c * side, z: d.berth.z + c * forward - s * side };
  const direction = d.quay ? { x: c, z: -s } : { x: s, z: c };
  const depthFits = (point: { x: number; z: number }) =>
    [-halfBeam, 0, halfBeam].every((x) =>
      [-halfLength, 0, halfLength].every((z) => {
        const px = point.x + x * c + z * s,
          pz = point.z - x * s + z * c;
        return terrainHeight(w, px, pz) < surfaceWaterLevel(w, px, pz) - v.draft!;
      }),
    );
  for (
    let offset = 0;
    offset <= boatNavigationRules(w.settings).boatBerthSearchDistance;
    offset++
  ) {
    const candidate = { x: berth.x + direction.x * offset, z: berth.z + direction.z * offset };
    if (depthFits(candidate)) return { ...d, berth: candidate };
  }
  // Retain the candidate so the existing action can explain the failed clearance.
  return { ...d, berth };
}

/** Reberth only an old standard-position coaster, and only when the larger berth is clear. */
export function alignLegacyCargoMoorings(w: World) {
  if (!Object.values(w.mooredBoats ?? {}).some((b) => b.slot === CARGO_BOAT)) return;
  const old = boatLandings(w),
    fitted = boatLandings(w, CARGO_BOAT);
  for (const boat of Object.values(w.mooredBoats ?? {})) {
    if (boat.slot !== CARGO_BOAT) continue;
    const previous = old.find((d) => d.id === boat.landing),
      next = fitted.find((d) => d.id === boat.landing),
      owner = w.players[boat.owner];
    if (
      !previous ||
      !next ||
      !owner ||
      Math.hypot(boat.x - previous.berth.x, boat.z - previous.berth.z) > 0.01 ||
      Math.hypot(boat.x - next.berth.x, boat.z - next.berth.z) < 0.01 ||
      // This is not boarding: the owner's current boat must also count as occupied water.
      landingBlocked(w, next, { ...owner, id: '' }, true, boat.slot, boat.owner)
    )
      continue;
    Object.assign(boat, next.berth, { heading: next.heading });
    w.revision++;
  }
}
const boathouseRange = 40;
type LandingPosition = Pick<Player, 'x' | 'z'> & Partial<Pick<Player, 'vehicle' | 'heading'>>;

/** Shore boarding uses the same building-centred range as the boatyard menu.
 * Returning boats can come alongside the yard instead of hitting a tiny point.
 * A vessel is alongside when its oriented hull reaches the approach, rather than
 * only when its centre does. The entire centre-to-berth water path is still checked. */
export function withinBoatLanding(w: World, p: LandingPosition, d: BoatLanding, afloat: boolean) {
  const point = afloat ? d.berth : (d.building ?? d.land);
  const distance = Math.hypot(p.x - point.x, p.z - point.z);
  let hullDistance = distance;
  if (afloat && p.vehicle !== undefined && p.heading !== undefined && boatSlot(p.vehicle, w)) {
    const v = vehicleDef(w, p.vehicle),
      dx = point.x - p.x,
      dz = point.z - p.z,
      s = Math.sin(p.heading),
      c = Math.cos(p.heading);
    // Distance from the berth to the hull footprint in vessel-local coordinates.
    // A beam-on vessel must not receive the same reach as one approaching bow-first.
    hullDistance = Math.hypot(
      Math.max(0, Math.abs(dx * c - dz * s) - (v.beam ?? 0) / 2),
      Math.max(0, Math.abs(dx * s + dz * c) - (v.length ?? 0) / 2),
    );
  }
  const rules = boatNavigationRules(w.settings);
  if (
    hullDistance >
    (d.beached
      ? rowboatRules(w.settings).rowboatBankRange
      : afloat
        ? d.building
          ? rules.boatHouseArrivalRadius
          : rules.boatLandingArrivalRadius
        : d.building
          ? boathouseRange
          : rules.boatLandingShoreRadius)
  )
    return false;
  if (afloat) {
    const steps = Math.max(1, Math.ceil(distance / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = p.x + (point.x - p.x) * t,
        z = p.z + (point.z - p.z) * t;
      if (terrainHeight(w, x, z) > surfaceWaterLevel(w, x, z) + 0.15) return false;
    }
  }
  return true;
}
export function landingAccepts(w: World, d: BoatLanding, slot: number) {
  const v = vehicleDef(w, slot);
  return d.beached
    ? slot === ROWBOAT
    : d.river
      ? riverDockAccepts(w, slot)
      : !d.quay ||
        ((v.length ?? 0) <= boatNavigationRules(w.settings).quayMaxLength &&
          (v.beam ?? 0) <= boatNavigationRules(w.settings).quayMaxBeam);
}
export function boatLanding(w: World, p: LandingPosition, afloat: boolean, id?: unknown) {
  return boatLandings(w, afloat ? p.vehicle : undefined)
    .filter(
      (d) =>
        (id === undefined ||
          d.id === id ||
          (id === fishingDock.id && !d.building && !d.river && !d.quay && !d.beached)) &&
        (!afloat || p.vehicle === undefined || landingAccepts(w, d, p.vehicle)) &&
        withinBoatLanding(w, p, d, afloat),
    )
    .sort(
      (a, b) =>
        Math.hypot(p.x - a.berth.x, p.z - a.berth.z) - Math.hypot(p.x - b.berth.x, p.z - b.berth.z),
    )[0];
}
export function nearBoathouse(w: World, p: Pick<Player, 'x' | 'z' | 'vehicle'>, b: Building) {
  return (
    Math.hypot(p.x - b.x, p.z - b.z) <= boathouseRange ||
    (boatSlot(p.vehicle, w) && !!boatLanding(w, p, true, b.id))
  );
}
export function landingBlocked(
  w: World,
  d: BoatLanding,
  p: Player,
  board: boolean,
  slot = p.vehicle,
  mooredOwner = p.id,
) {
  const quay = w.buildings.find((b) => b.id === d.id && b.kind === 'quay');
  if (d.building || quay) {
    const reason = dockObstruction(w, (d.building ?? quay)!);
    if (reason) return reason;
  }
  const hullSlot = board ? slot : p.vehicle,
    v = vehicleDef(w, hullSlot);
  if (v.draft !== undefined && (board || v.holdCapacity)) {
    const s = Math.sin(d.heading),
      c = Math.cos(d.heading);
    const length = v.length ?? 0,
      beam = v.beam ?? 0;
    const occupied = (
      x: number,
      z: number,
      q: { x: number; z: number; heading: number },
      otherSlot: number,
    ) => {
      const other = vehicleDef(w, otherSlot),
        dx = x - q.x,
        dz = z - q.z;
      const sine = Math.sin(q.heading),
        cosine = Math.cos(q.heading);
      return (
        Math.abs(dx * cosine - dz * sine) < (other.beam ?? 1) / 2 + 0.5 &&
        Math.abs(dx * sine + dz * cosine) < (other.length ?? 1) / 2 + 0.5
      );
    };
    for (let i = 0; i <= Math.ceil(beam); i++)
      for (let j = 0; j <= Math.ceil(length); j++) {
        const x0 = -beam / 2 + (i * beam) / Math.max(1, Math.ceil(beam)),
          z0 = -length / 2 + (j * length) / Math.max(1, Math.ceil(length));
        const x = d.berth.x + x0 * c + z0 * s,
          z = d.berth.z - x0 * s + z0 * c;
        const water = surfaceWaterLevel(w, x, z);
        if (
          Math.max(Math.abs(x), Math.abs(z)) >= mapHalf(w) ||
          terrainHeight(w, x, z) >= water - v.draft
        )
          return 'The full hull needs deeper clear water at this berth';
        if (
          w.buildings.some((b) => blocksBuilding(b, x, z, 0, 0.5)) ||
          creatorBlocks(w, x, z, water, 0.5)
        )
          return 'The enlarged boat berth is blocked';
        if (
          Object.values(w.players).some(
            (q) =>
              q.id !== p.id && q.online && !q.atHome && !q.hitch && occupied(x, z, q, q.vehicle),
          )
        )
          return 'The full boat berth is occupied; wait for it to clear';
        if (
          Object.entries(w.mooredBoats ?? {}).some(
            ([id, q]) => id !== mooringKey(mooredOwner, hullSlot) && occupied(x, z, q, q.slot),
          )
        )
          return 'This berth has a moored boat; use another berth';
      }
  }
  const point = board ? d.berth : d.land;
  const height = board ? surfaceWaterLevel(w, point.x, point.z) : travelHeight(w, point.x, point.z);
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
        id !== mooringKey(mooredOwner, slot) && Math.hypot(b.x - d.berth.x, b.z - d.berth.z) < 5,
    )
  )
    return 'This berth has a moored boat; use another berth';
}

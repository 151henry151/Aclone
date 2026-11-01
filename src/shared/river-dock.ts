// SPDX-License-Identifier: GPL-3.0-or-later
import { inlandWaterAt } from './inland-water';
import { riverDepth } from './inland-travel';
import { terrainHeight, mapHalf } from './terrain';
import { vehicleDef } from './vehicle-config';
import type { Building, World } from './types';

export const RIVER_DOCK = 'riverDock';
/** River water required alongside the berth: canal boats and motorboats, not sea-going hulls. */
export const RIVER_DOCK_DRAFT = 1.2;
/** Small-craft limits in metres; the trawler, tug and charter boat exceed them. */
export const RIVER_DOCK_MAX_LENGTH = 14;
export const RIVER_DOCK_MAX_BEAM = 3.6;
/** Jetty geometry in dock-local metres: the landing crib at the origin, the
 * jetty running toward -z, and the berth lying along the bank beyond its end. */
export const RIVER_JETTY = { width: 2.2, start: 1.2, end: 11 } as const;
export const RIVER_BERTH = { z: 13.2, halfLength: 7, halfBeam: 1.8 } as const;
/** Shore boarding point, clear of the landing crib's collision padding. */
export const RIVER_LANDING_Z = 3;

type Site = Pick<Building, 'id' | 'kind' | 'x' | 'z' | 'rotation'>;
export function riverDockPoint(b: Pick<Site, 'x' | 'z' | 'rotation'>, x: number, z: number) {
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return { x: b.x + x * c + z * s, z: b.z - x * s + z * c };
}
export function riverDockAccepts(w: Pick<World, 'vehicleTuning'>, slot: number) {
  const v = vehicleDef(w, slot);
  return (
    v.mode === 3 && (v.length ?? 0) <= RIVER_DOCK_MAX_LENGTH && (v.beam ?? 0) <= RIVER_DOCK_MAX_BEAM
  );
}
/** A dry landing on the bank, a jetty that clears the ground, and a berth with
 * enough river under the whole small hull. Ponds and the sea do not qualify. */
export function riverDockSite(w: World, b: Site) {
  if (b.kind !== RIVER_DOCK) return undefined;
  const half = mapHalf(w) - 2;
  const at = (x: number, z: number) => {
    const p = riverDockPoint(b, x, z);
    return Math.max(Math.abs(p.x), Math.abs(p.z)) < half ? p : undefined;
  };
  const berthCentre = at(0, -RIVER_BERTH.z);
  if (!berthCentre) return undefined;
  const water = inlandWaterAt(w, berthCentre.x, berthCentre.z);
  if (!water?.river) return undefined;
  const level = water.level;
  for (const x of [-1.5, 0, 1.5])
    for (const z of [-1.2, 0, 1.2, RIVER_LANDING_Z]) {
      const p = at(x, z);
      if (!p) return undefined;
      const h = terrainHeight(w, p.x, p.z);
      if (!(h >= level + 0.2 && h <= level + 2.5)) return undefined;
    }
  for (let z = RIVER_JETTY.start; z <= RIVER_JETTY.end; z += 1) {
    const p = at(0, -z);
    if (!p || terrainHeight(w, p.x, p.z) > level + 0.6) return undefined;
  }
  for (const x of [-RIVER_BERTH.halfLength, -3.5, 0, 3.5, RIVER_BERTH.halfLength])
    for (const dz of [-RIVER_BERTH.halfBeam, 0, RIVER_BERTH.halfBeam]) {
      const p = at(x, -RIVER_BERTH.z + dz);
      if (!p) return undefined;
      const here = inlandWaterAt(w, p.x, p.z);
      if (!here?.river || riverDepth(w, p) < RIVER_DOCK_DRAFT) return undefined;
    }
  return {
    berth: berthCentre,
    land: riverDockPoint(b, 0, RIVER_LANDING_Z),
    heading: b.rotation + Math.PI / 2,
    level,
  };
}
export function riverDockReserved(b: Site, x: number, z: number, padding = 0) {
  if (b.kind !== RIVER_DOCK) return false;
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  return (
    lx > -RIVER_BERTH.halfLength - 1 - padding &&
    lx < RIVER_BERTH.halfLength + 1 + padding &&
    lz > -RIVER_BERTH.z - RIVER_BERTH.halfBeam - 1 - padding &&
    lz < -RIVER_JETTY.start + padding
  );
}

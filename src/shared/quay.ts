// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, World } from './types';
import { terrainHeight, mapHalf } from './terrain';
import { highWater, lowWater } from './ocean';
import { boatNavigationRules } from './boat-navigation-rules';
/** Shared engineered footprint; all rendering, siting and walking use these metres. */
export const QUAY = {
  frontage: 28,
  deckDepth: 5,
  gangwayWidth: 3,
  gangwayStart: 1.2,
  gangwayEnd: 14,
  landing: 3,
  berthZ: 23.5,
  berthLength: 28,
  berthBeam: 8,
} as const;
type Site = Pick<Building, 'id' | 'kind' | 'x' | 'z' | 'rotation'>;
export function quayPoint(b: Site, x: number, z: number) {
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  return { x: b.x + x * c + z * s, z: b.z - x * s + z * c };
}
export function quayLocal(b: Site, x: number, z: number) {
  const c = Math.cos(b.rotation),
    s = Math.sin(b.rotation),
    dx = x - b.x,
    dz = z - b.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
export function quayDeckContains(b: Site, x: number, z: number) {
  if (b.kind !== 'quay') return false;
  const q = quayLocal(b, x, z);
  return (
    (Math.abs(q.x) <= QUAY.gangwayWidth / 2 && q.z <= QUAY.landing && q.z >= -QUAY.gangwayEnd) ||
    (Math.abs(q.x) <= QUAY.frontage / 2 &&
      q.z <= -QUAY.gangwayEnd &&
      q.z >= -QUAY.gangwayEnd - QUAY.deckDepth)
  );
}
export function quayDeckHeight(w: World, b: Site) {
  return Math.max(highWater(w) + 0.75, terrainHeight(w, b.x, b.z) + 0.3);
}
export function quayReserved(b: Site, x: number, z: number, padding = 0) {
  if (b.kind !== 'quay') return false;
  const q = quayLocal(b, x, z);
  return (
    Math.abs(q.x) < QUAY.frontage / 2 + padding &&
    q.z < -QUAY.gangwayStart + padding &&
    q.z > -QUAY.berthZ - QUAY.berthBeam / 2 - padding
  );
}
export function quaySite(w: World, b: Site) {
  if (b.kind !== 'quay') return undefined;
  const high = highWater(w),
    low = lowWater(w),
    at = (x: number, z: number) => {
      const p = quayPoint(b, x, z);
      return Math.max(Math.abs(p.x), Math.abs(p.z)) < mapHalf(w) - 2
        ? terrainHeight(w, p.x, p.z)
        : NaN;
    };
  for (const x of [-1.5, 0, 1.5])
    for (const z of [-1.2, 0, 1.2, QUAY.landing])
      if (!(at(x, z) >= high + 0.2 && at(x, z) <= high + 3)) return undefined;
  for (let z = -QUAY.gangwayStart; z >= -QUAY.gangwayEnd; z--)
    for (const x of [-QUAY.gangwayWidth / 2, 0, QUAY.gangwayWidth / 2])
      if (!(at(x, z) <= quayDeckHeight(w, b))) return undefined;
  for (let x = -QUAY.frontage / 2; x <= QUAY.frontage / 2; x++)
    for (let z = -QUAY.gangwayEnd; z >= -QUAY.gangwayEnd - QUAY.deckDepth; z--)
      if (!(at(x, z) < low)) return undefined;
  for (let x = -QUAY.berthLength / 2; x <= QUAY.berthLength / 2; x++)
    for (let z = -QUAY.berthZ - QUAY.berthBeam / 2; z <= -QUAY.berthZ + QUAY.berthBeam / 2; z++)
      if (!(at(x, z) <= low - boatNavigationRules(w.settings).quayDraft)) return undefined;
  return {
    berth: quayPoint(b, 0, -QUAY.berthZ),
    land: quayPoint(b, 0, QUAY.landing),
    heading: b.rotation + Math.PI / 2,
  };
}

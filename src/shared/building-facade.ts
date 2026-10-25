// SPDX-License-Identifier: GPL-3.0-or-later
import type { BuildingPlan, BuildingVolume } from './building-shapes';
export const awningKinds = new Set(['market', 'bakery', 'dairyKitchen', 'teaHouse']);
export const civicKinds = new Set(['school', 'town', 'bank']);
export const industrialKinds = new Set([
  'farm',
  'feedmill',
  'sawmill',
  'quarry',
  'mason',
  'mine',
  'rareMine',
  'forge',
  'brewery',
  'workshop',
  'refinery',
  'factory',
  'shipyard',
  'warehouse',
  'composter',
  'brickworks',
  'concreteWorks',
  'carpenter',
  'garage',
  'boathouse',
  'dairy',
  'sheepfold',
  'piggery',
  'haybarn',
]);
export const tradeSymbols: Record<string, string> = {
  bakery: 'bread',
  pub: 'beer',
  brewery: 'beer',
  bank: 'coin',
  town: 'council',
  school: 'council',
  workhouse: 'tools',
  garage: 'tools',
  workshop: 'tools',
  carpenter: 'tools',
  teaHouse: 'tea',
  roastery: 'coffee',
  dairyKitchen: 'coffee',
  bnb: 'bed',
  hotel: 'bed',
  waterworks: 'water',
};
export function exposedFacade(
  volumes: BuildingVolume[],
  v: BuildingVolume,
  x: number,
  y: number,
  z: number,
  pad = 0.6,
) {
  return !volumes.some(
    (o) =>
      o !== v &&
      y < o.eaves + o.rise &&
      Math.abs(x - o.x) < o.width / 2 + pad &&
      Math.abs(z - o.z) < o.depth / 2 + pad,
  );
}
/** A single placement contract for entrances, awnings, signs and window exclusions. */
export function buildingFacade(kind: string, plan: BuildingPlan) {
  const v =
    plan.volumes.find(
      (v) =>
        v.eaves >= 2.3 && exposedFacade(plan.volumes, v, v.x, 1, v.z + v.depth / 2 + 0.07, 0.2),
    ) ?? plan.volumes[0];
  const front = v.z + v.depth / 2 + 0.07;
  const awning = awningKinds.has(kind)
    ? { x: v.x, y: 2.55, z: front + 0.4, width: Math.min(v.width - 0.2, 5), depth: 1.05 }
    : undefined;
  // Low shop signs occupy the fascia above the canopy. Tall premises use a dedicated
  // wall panel above the entrance, with windows deliberately kept away from it.
  const high = industrialKinds.has(kind)
    ? Math.min(3.4, v.eaves - 0.3) + 0.6
    : civicKinds.has(kind)
      ? 4
      : 2.95;
  const sign = tradeSymbols[kind]
    ? {
        x: v.x,
        y: Math.min(v.eaves - 0.5, high),
        z: front - 0.04,
        width: 0.72,
        height: 0.6,
      }
    : undefined;
  if (sign && awning) {
    sign.height = Math.min(0.6, Math.max(0.24, v.eaves - 2.9));
    sign.y = 2.75 + sign.height / 2;
  }
  // A shallow industrial wall may not have room above its loading door; put the
  // plaque beside the bay rather than painting it across the door.
  if (
    sign &&
    industrialKinds.has(kind) &&
    sign.y - sign.height / 2 < Math.min(3.4, v.eaves - 0.3) + 0.1
  ) {
    sign.x += Math.min(v.width * 0.4, v.width / 2 - 0.55);
    sign.y = 1.8;
  }
  if (sign && civicKinds.has(kind) && v.eaves < 4.6) {
    sign.x += Math.min(v.width / 2 - 0.55, 2.25);
    sign.y = 2;
  }
  return { v, front, awning, sign };
}
/** Surface height matches the low-poly roof profiles, including rotated ridges. */
export function roofHeightAt(v: BuildingVolume, x: number, z: number) {
  let dx = x - v.x,
    dz = z - v.z,
    w = v.width / 2 + 0.28,
    d = v.depth / 2 + 0.28;
  if (v.roofAxis === 'x') {
    [dx, dz] = [-dz, dx];
    [w, d] = [d, w];
  }
  const t = Math.min(1, Math.abs(dx) / w);
  if (v.roof === 'flat') return v.eaves + 0.17;
  if (v.roof === 'shed') return v.eaves + v.rise * Math.max(0, Math.min(1, (d - dz) / (2 * d)));
  if (v.roof === 'hip')
    return v.eaves + v.rise * Math.max(0, Math.min(1 - t, (d - Math.abs(dz)) / (d * 0.55)));
  if (v.roof === 'gambrel')
    return v.eaves + v.rise * (t < 0.58 ? 1 - (0.22 * t) / 0.58 : (0.78 * (1 - t)) / 0.42);
  if (v.roof === 'barrel') {
    const a = Math.acos(t),
      step = Math.PI / 8,
      lo = Math.floor(a / step) * step,
      hi = Math.min(Math.PI / 2, lo + step);
    const f = hi === lo ? 0 : (Math.cos(lo) - t) / (Math.cos(lo) - Math.cos(hi));
    return v.eaves + v.rise * (Math.sin(lo) * (1 - f) + Math.sin(hi) * f);
  }
  return v.eaves + v.rise * (1 - t);
}

export function loadingBayXs(kind: string, v: BuildingVolume) {
  return kind === 'garage' && v.width >= 12 ? [v.x - 4.3, v.x, v.x + 4.3] : [v.x];
}

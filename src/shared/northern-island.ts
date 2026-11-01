// SPDX-License-Identifier: GPL-3.0-or-later
import { fbm, smoothstep } from './noise';
import type { ResourceNode } from './resources';
export interface RiverPoint {
  x: number;
  z: number;
  level: number;
  width: number;
  depth: number;
}
export interface IslandRiver {
  id: string;
  name: string;
  points: RiverPoint[];
}
export interface IslandPond {
  id: string;
  x: number;
  z: number;
  rx: number;
  rz: number;
  level: number;
  depth: number;
}
export interface NorthernIsland {
  version: 1;
  seed: number;
  radius: number;
  centreZ: number;
  preserveZ: number;
  blendZ: number;
  mountain: { x: number; z: number; height: number; radius: number };
  regions: { x: number; z: number; radius: number; relief: number; forest: number }[];
  rivers: IslandRiver[];
  ponds: IslandPond[];
  /** Freeze existing survey IDs/locations, including depletion references. */
  resources: ResourceNode[];
  previousArea: number;
  area: number;
}
export const regionalMaterials = ['logs', 'stone', 'gravel', 'dirt'] as const;
/** Six broad provinces, blended across borders. A rich/poor pair keeps the
 * expected number of patches constant: 45%, 5%, 25%, 25% in each interior. */
export const resourceProvinces = [
  { name: 'Eastern uplands', rich: 'stone', scarce: 'dirt' },
  { name: 'Southeastern woods', rich: 'logs', scarce: 'gravel' },
  { name: 'Southwestern lowlands', rich: 'dirt', scarce: 'stone' },
  { name: 'Western gravel country', rich: 'gravel', scarce: 'logs' },
  { name: 'Northwestern forest', rich: 'logs', scarce: 'stone' },
  { name: 'Northern stone country', rich: 'stone', scarce: 'logs' },
] as const;
export function regionalResourceWeights(n: NorthernIsland, x: number, z: number) {
  const angle = (Math.atan2(z - n.centreZ, x) / (Math.PI / 3) + 6) % 6;
  const sector = Math.floor(angle + 0.5),
    offset = angle - sector;
  const next = sector + (offset < 0 ? -1 : 1);
  const blend = smoothstep(0.32, 0.68, Math.abs(offset));
  const strength = smoothstep(300, 1800, Math.hypot(x, z - n.centreZ));
  const weight = (index: number, item: string) => {
    const province = resourceProvinces[(index + 6) % 6];
    return item === province.rich ? 1.8 : item === province.scarce ? 0.2 : 1;
  };
  return regionalMaterials.map(
    (item) => 1 + strength * ((1 - blend) * weight(sector, item) + blend * weight(next, item) - 1),
  );
}
export function regionalResource(n: NorthernIsland, x: number, z: number, random: number) {
  const weights = regionalResourceWeights(n, x, z);
  let remaining = random * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return regionalMaterials[i];
  }
  return regionalMaterials.at(-1)!;
}
export function northernBlend(n: NorthernIsland, z: number) {
  return 1 - smoothstep(n.blendZ, n.preserveZ, z);
}
export function northernRegion(n: NorthernIsland, x: number, z: number) {
  let relief = 1,
    forest = 0;
  for (const r of n.regions) {
    const weight = 1 - smoothstep(r.radius * 0.3, r.radius, Math.hypot(x - r.x, z - r.z));
    relief += (r.relief - 1) * weight;
    forest = Math.max(forest, r.forest * weight);
  }
  return { relief: Math.max(0.1, relief), forest };
}
/** A rounded, scalloped northern mainland. The old southern terrain is an exact
 * branch, not a rescaled approximation. Keep its seed and coordinate system. */
export function northernHeight(n: NorthernIsland, x: number, z: number, sea: number) {
  const dx = x,
    dz = z - n.centreZ;
  const angle = Math.atan2(dz, dx);
  const coastRadius =
    n.radius * (1 + 0.035 * Math.sin(angle * 5 + 1) + 0.022 * Math.sin(angle * 9 - 0.4));
  const radial = Math.hypot(dx, dz) / coastRadius;
  const coast = 1 - smoothstep(0.88, 1, radial);
  const region = northernRegion(n, x, z);
  const hills = fbm(x / 1450, z / 1450, 3, n.seed + 61);
  const shoulders = fbm(x / 460, z / 460, 2, n.seed + 73);
  const peak = Math.exp(
    -Math.pow(Math.hypot(x - n.mountain.x, z - n.mountain.z) / n.mountain.radius, 1.65),
  );
  const ridge =
    1 +
    0.1 *
      Math.sin(Math.atan2(z - n.mountain.z, x - n.mountain.x) * 5) *
      Math.min(1, Math.hypot(x - n.mountain.x, z - n.mountain.z) / 1000);
  const land =
    22 + (82 * (hills + 0.8) + 24 * shoulders) * region.relief + n.mountain.height * peak * ridge;
  return sea - 32 + (land + 32) * coast;
}

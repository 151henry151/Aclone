// SPDX-License-Identifier: GPL-3.0-or-later
/** One world unit is one metre. Shared by geometry, picking, planting and collision. */
export interface BuildingVolume {
  x: number;
  z: number;
  width: number;
  depth: number;
  eaves: number;
  rise: number;
  roof: 'gable' | 'hip' | 'shed' | 'flat';
}
export interface BuildingPlan {
  style: string;
  volumes: BuildingVolume[];
  wall: string;
  trim: string;
  doorHeight: number;
}
const volume = (
  width: number,
  depth: number,
  eaves: number,
  rise: number,
  roof: BuildingVolume['roof'] = 'gable',
  x = 0,
  z = 0,
): BuildingVolume => ({ width, depth, eaves, rise, roof, x, z });
const plans = new Map<string, BuildingPlan>();
export function buildingPlan(b: { kind: string; id: string }): BuildingPlan {
  let seed = 0;
  for (const c of b.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const variant = seed % 3;
  const key = b.kind + ':' + (b.kind === 'home' ? variant : 0);
  const cached = plans.get(key);
  if (cached) return cached;
  let style = b.kind,
    wall = '#e6ddc8',
    trim = '#526d60';
  let volumes: BuildingVolume[];
  switch (b.kind) {
    case 'home':
      volumes = [
        volume(6.4 + variant * 0.5, 5.4 + variant * 0.3, 2.7, 1.7, variant === 1 ? 'hip' : 'gable'),
      ];
      trim = ['#526d60', '#7c5145', '#516a79'][variant];
      break;
    case 'pub':
      volumes = [volume(9, 6.8, 5.35, 1.8), volume(3.2, 4.8, 2.7, 0.9, 'shed', 5.8, -1)];
      wall = '#e9dfbc';
      trim = '#554234';
      break;
    case 'school':
      volumes = [volume(11.8, 6.5, 3.35, 1.65, 'hip'), volume(3.2, 2.2, 3, 1.2, 'gable', 0, 3.6)];
      break;
    case 'bank':
      volumes = [volume(8.4, 6.8, 5.6, 1.5, 'hip')];
      wall = '#d4d5ca';
      trim = '#65716d';
      break;
    case 'market':
    case 'shop':
      volumes = [volume(9.4, 6.2, 3.1, 1.35, 'hip')];
      trim = '#687c50';
      break;
    case 'bakery':
      volumes = [volume(6.8, 6, 3, 1.8), volume(2.6, 4, 2.4, 0.65, 'shed', 4.5, -1)];
      wall = '#ead2ba';
      trim = '#805749';
      break;
    case 'workhouse':
      volumes = [volume(7.6, 5.6, 2.9, 1.3, 'hip')];
      trim = '#5a7078';
      break;
    case 'garage':
      volumes = [volume(11.4, 7.2, 3.7, 0.75, 'shed')];
      wall = '#b9b5a4';
      trim = '#705b49';
      break;
    case 'farm':
      volumes = [volume(10.5, 7.8, 3.8, 2.8)];
      wall = '#9d624b';
      trim = '#ded1ae';
      break;
    case 'mill':
      volumes = [volume(5.2, 5.2, 7.2, 2), volume(4.3, 5.8, 3, 1.4, 'gable', 4.5, 0)];
      break;
    case 'sawmill':
      volumes = [volume(11.8, 7.8, 3.6, 1.5)];
      wall = '#a58c69';
      trim = '#665841';
      break;
    case 'quarry':
    case 'mason':
      volumes = [volume(5.4, 4.8, 2.9, 0.7, 'shed'), volume(3.8, 3.2, 1.2, 0, 'flat', 4.4, -1)];
      wall = '#b8b6a6';
      break;
    case 'mine':
    case 'rareMine':
      volumes = [volume(6, 5.4, 3.2, 1.3), volume(2.8, 3, 6.4, 0, 'flat', 3.8, -1)];
      wall = '#b4ad98';
      break;
    case 'forge':
      volumes = [volume(10, 7.4, 4.3, 1.6)];
      wall = '#9e8d7d';
      trim = '#514d45';
      break;
    case 'brewery':
      volumes = [volume(7.8, 7, 5.6, 2.1), volume(3.2, 4.5, 3.5, 0.6, 'shed', 5.3, -1)];
      wall = '#ba9c81';
      break;
    case 'workshop':
      volumes = [volume(8.5, 6.5, 3.4, 1.4)];
      trim = '#52727b';
      break;
    case 'refinery':
      volumes = [volume(7, 6, 3.5, 0.6, 'flat'), volume(3.4, 4, 6, 0, 'flat', 5.2, -1)];
      wall = '#acb9b5';
      break;
    case 'factory':
      volumes = [volume(12, 8.5, 4.2, 1.2, 'shed')];
      wall = '#c6bba4';
      trim = '#606c72';
      break;
    case 'warehouse':
    case 'shipyard':
      volumes = [volume(12, 9, 4.6, 2)];
      wall = '#ab9680';
      trim = '#626d69';
      break;
    case 'starport':
      volumes = [volume(11, 7, 3.2, 0.3, 'flat'), volume(3, 3.5, 6.7, 0.2, 'flat', 4, -1.5)];
      wall = '#c7d2cd';
      trim = '#517b7e';
      break;
    case 'town':
      volumes = [volume(6, 6, 3, 0, 'flat')];
      break;
    case 'notice':
      volumes = [volume(2.2, 0.5, 2.2, 0.3)];
      break;
    case 'pickup':
      volumes = [volume(1.8, 1.2, 1.1, 0, 'flat')];
      break;
    case 'portal':
      volumes = [volume(3, 1, 4, 0, 'flat')];
      break;
    case 'turret':
      volumes = [volume(2.4, 2.4, 3, 0, 'flat')];
      break;
    default:
      style = 'cottage';
      volumes = [volume(7, 5.8, 2.8, 1.6)];
  }
  const plan = { style, volumes, wall, trim, doorHeight: 2.1 };
  plans.set(key, plan);
  return plan;
}
export function buildingBounds(plan: BuildingPlan) {
  const minX = Math.min(...plan.volumes.map((v) => v.x - v.width / 2));
  const maxX = Math.max(...plan.volumes.map((v) => v.x + v.width / 2));
  const minZ = Math.min(...plan.volumes.map((v) => v.z - v.depth / 2));
  const maxZ = Math.max(...plan.volumes.map((v) => v.z + v.depth / 2));
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    height: Math.max(...plan.volumes.map((v) => v.eaves + v.rise)),
  };
}
export function buildingPenetration(
  b: { kind: string; id: string; x: number; z: number; rotation: number },
  x: number,
  z: number,
  height: number,
  padding: number,
) {
  const dx = x - b.x,
    dz = z - b.z,
    c = Math.cos(b.rotation),
    s = Math.sin(b.rotation);
  const lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  let penetration = 0;
  for (const v of buildingPlan(b).volumes) {
    if (height >= v.eaves + v.rise) continue;
    penetration = Math.max(
      penetration,
      Math.min(
        v.width / 2 + padding - Math.abs(lx - v.x),
        v.depth / 2 + padding - Math.abs(lz - v.z),
      ),
    );
  }
  return penetration;
}
export function blocksBuilding(...args: Parameters<typeof buildingPenetration>) {
  return buildingPenetration(...args) > 0;
}
/** Allow a pilot caught by an edited/upgraded footprint to move toward its nearest edge. */
export function buildingBlocksMovement(
  b: Parameters<typeof buildingPenetration>[0],
  from: { x: number; z: number },
  to: { x: number; z: number },
  height: number,
  padding: number,
) {
  const after = buildingPenetration(b, to.x, to.z, height, padding);
  if (after <= 0) return false;
  const before = buildingPenetration(b, from.x, from.z, height, padding);
  return before <= 0 || after >= before - 1e-7;
}

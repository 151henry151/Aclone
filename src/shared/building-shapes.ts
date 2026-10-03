// SPDX-License-Identifier: GPL-3.0-or-later
import { appearance, cottageStyle } from './appearance';
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
  siding: 'stone' | 'wood';
  fixtures?: BuildingVolume[];
  apron?: { x: number; z: number; radius: number };
}
/** Metre-scale spaceport apron; the thin pad is walkable, its rocket/gantry are solid. */
export const spaceportScale = 6;
export const spaceportApron = { x: 108, z: 30, radius: 60 };
export const spaceportHardware = {
  tower: { x: 72, z: 57, height: 158.4 },
  tank: { x: 72, z: 3 },
};
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
export function buildingPlan(b: {
  kind: string;
  id: string;
  style?: string;
  creatorBounds?: { width: number; depth: number; height: number };
}): BuildingPlan {
  if (b.creatorBounds)
    return {
      style: 'custom',
      volumes: [
        volume(b.creatorBounds.width, b.creatorBounds.depth, b.creatorBounds.height, 0, 'flat'),
      ],
      wall: '#aaaaaa',
      trim: '#555555',
      doorHeight: 2,
      siding: 'stone',
    };
  let seed = 0;
  for (const c of b.id) seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
  const variant = seed % 3;
  const key =
    b.kind +
    ':' +
    (b.kind === 'home' ? seed % appearance.cottages.length : 0) +
    ':' +
    (b.style ?? '');
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
    case 'bnb':
      volumes = [volume(8.4, 6.8, 5.4, 1.8), volume(4, 4, 2.7, 0.8, 'shed', 5.5, -1)];
      wall = '#efe2c9';
      trim = '#527585';
      break;
    case 'hotel':
      volumes = [volume(15, 9, 8, 2, 'hip'), volume(5, 4, 3, 1, 'gable', 0, 5)];
      wall = '#d6c1a1';
      trim = '#435a57';
      break;
    case 'composter':
      volumes = [volume(5, 5, 2.6, 0.7, 'shed'), volume(5, 4, 1, 0, 'flat', 5, 0)];
      wall = '#8c9772';
      break;
    case 'concreteWorks':
    case 'brickworks':
      volumes = [volume(9, 7, 4.2, 0.8, 'shed'), volume(3, 3, 6, 0, 'flat', 5, -1)];
      wall = '#b09983';
      break;
    case 'carpenter':
      volumes = [volume(10, 7, 3.8, 2.2), volume(4, 5, 2.7, 0.6, 'shed', 7, 0)];
      wall = '#b09972';
      break;
    case 'winery':
      volumes = [volume(8, 9, 4, 2.4), volume(4, 6, 2.8, 1, 'gable', 5, 0)];
      wall = '#c7b5a0';
      trim = '#715263';
      break;
    case 'teaHouse':
      volumes = [volume(8, 6, 3, 1.4, 'hip')];
      wall = '#d5deba';
      trim = '#45684f';
      break;
    case 'roastery':
    case 'kitchen':
      volumes = [volume(7, 6, 5.2, 1.5), volume(3, 4, 2.6, 0.6, 'shed', 5, 0)];
      wall = '#d1af95';
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
    case 'waterworks':
      volumes = [volume(8, 6, 3.3, 0.7, 'shed')];
      wall = '#c8d2cf';
      trim = '#446f78';
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
      volumes = [
        volume(22, 14, 6.4, 0.4, 'flat'),
        volume(5, 6, 17, 0.4, 'flat', -7, -10),
        volume(28, 24, 12, 0.5, 'flat', 29, -8),
        volume(12, 10, 5.2, 0.2, 'flat', 5, -22),
      ];
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
  let siding: 'stone' | 'wood' = 'stone';
  if (['bnb', 'teaHouse', 'carpenter', 'composter'].includes(b.kind)) siding = 'wood';
  if (b.kind === 'home') {
    const chosen =
      cottageStyle(b.style ?? '') ?? appearance.cottages[seed % appearance.cottages.length];
    wall = chosen.wall;
    trim = chosen.trim;
    siding = chosen.siding as 'stone' | 'wood';
    volumes[0].roof = chosen.roof as BuildingVolume['roof'];
  }
  const plan: BuildingPlan = { style, volumes, wall, trim, siding, doorHeight: 2.1 };
  if (b.kind === 'starport') {
    plan.apron = spaceportApron;
    plan.fixtures = [
      volume(55.2, 55.2, 192.6, 0, 'flat', spaceportApron.x, spaceportApron.z),
      volume(19.2, 19.2, 160.2, 0, 'flat', spaceportHardware.tower.x, spaceportHardware.tower.z),
      volume(13.2, 24, 27.6, 0, 'flat', spaceportHardware.tank.x, spaceportHardware.tank.z + 5.4),
    ];
  }
  plans.set(key, plan);
  return plan;
}
export function buildingBounds(plan: BuildingPlan) {
  const volumes = [...plan.volumes, ...(plan.fixtures ?? [])];
  const minX = Math.min(
    ...volumes.map((v) => v.x - v.width / 2),
    plan.apron ? plan.apron.x - plan.apron.radius : Infinity,
  );
  const maxX = Math.max(
    ...volumes.map((v) => v.x + v.width / 2),
    plan.apron ? plan.apron.x + plan.apron.radius : -Infinity,
  );
  const minZ = Math.min(
    ...volumes.map((v) => v.z - v.depth / 2),
    plan.apron ? plan.apron.z - plan.apron.radius : Infinity,
  );
  const maxZ = Math.max(
    ...volumes.map((v) => v.z + v.depth / 2),
    plan.apron ? plan.apron.z + plan.apron.radius : -Infinity,
  );
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    height: Math.max(...volumes.map((v) => v.eaves + v.rise)),
  };
}
export function buildingPenetration(
  b: { kind: string; id: string; style?: string; x: number; z: number; rotation: number },
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
  const plan = buildingPlan(b);
  for (const v of [...plan.volumes, ...(plan.fixtures ?? [])]) {
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

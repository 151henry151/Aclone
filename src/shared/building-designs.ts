// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingArchitecture } from './building-architecture';
import { appearance } from './appearance';
import type { BuildingDef, Stock } from './types';
export type BuildingSize = 'standard' | 'expanded' | 'large';
export interface BuildingStyle {
  id: string;
  name: string;
  description: string;
  wall: string;
  trim: string;
  siding: 'stone' | 'wood';
  roof: 'gable' | 'hip';
  finish: 'rubble' | 'clapboard' | 'boards' | 'limestone' | 'brick' | 'metal';
  structure: 'blocks' | 'wood' | 'bricks' | 'steel';
  price: number;
}
const cottageDesigns: BuildingStyle[] = appearance.cottages.map((s) => ({
  ...s,
  siding: s.siding as 'stone' | 'wood',
  roof: s.roof as 'gable' | 'hip',
  finish:
    s.id === 'white-clapboard'
      ? 'clapboard'
      : s.id === 'stone-hip'
        ? 'limestone'
        : s.siding === 'stone'
          ? 'rubble'
          : 'boards',
  structure: s.siding === 'stone' ? 'blocks' : 'wood',
  price: s.siding === 'stone' ? 1.08 : 1,
  description:
    s.siding === 'stone'
      ? 'Masonry walls, timber roof and gravel foundation.'
      : 'Timber frame and siding on a masonry footing.',
}));
const businessDesigns: BuildingStyle[] = [
  { ...cottageDesigns[0], name: 'Fieldstone' },
  cottageDesigns[1],
  cottageDesigns[2],
  { ...cottageDesigns[3], name: 'Dressed stone' },
  {
    id: 'brick-workshop',
    name: 'Brick traditional',
    description: 'Fired-brick walls, stone footing and timber roof.',
    wall: '#eed9c4',
    trim: '#52665e',
    siding: 'stone',
    roof: 'gable',
    finish: 'brick',
    structure: 'bricks',
    price: 1.1,
  },
  {
    id: 'metal-panel',
    name: 'Industrial panel',
    description: 'Steel frame and ribbed metal cladding on a concrete slab.',
    wall: '#b6c3c4',
    trim: '#385e6a',
    siding: 'stone',
    roof: 'gable',
    finish: 'metal',
    structure: 'steel',
    price: 1.15,
  },
];
const containerColors: BuildingStyle[] = [
  ['oxide-red', 'Oxide red', '#a84734'],
  ['ocean-blue', 'Ocean blue', '#33657f'],
  ['forest-green', 'Forest green', '#426956'],
  ['sand', 'Sand', '#c2ae7f'],
  ['ivory', 'Ivory', '#dbded5'],
  ['slate', 'Slate grey', '#626e77'],
].map(([id, name, wall]) => ({
  id,
  name,
  wall,
  trim: wall,
  siding: 'stone',
  roof: 'gable',
  finish: 'metal',
  structure: 'steel',
  price: 1.15,
  description:
    'Painted corrugated steel container with locking doors, timber floor and prepared gravel footing.',
}));
export function buildingStyles(kind: string, architecture?: string) {
  if (kind === 'pickup') return containerColors;
  return kind === 'home' && !architecture ? cottageDesigns : businessDesigns;
}
export function buildingStyle(kind: string, id?: string, architecture?: string) {
  return buildingStyles(kind, architecture).find((s) => s.id === id);
}
const scalable = new Set([
  'home',
  'bnb',
  'hotel',
  'bakery',
  'market',
  'shop',
  'warehouse',
  'haybarn',
  'workshop',
  'carpenter',
  'factory',
  'garage',
  'kitchen',
  'teaHouse',
  'roastery',
  'creamery',
  'dairyKitchen',
  'brewery',
  'winery',
  'sawmill',
]);
export const buildingSizes = [
  { id: 'standard', name: 'Standard', capacity: 1, footprint: 1, cost: 1 },
  { id: 'expanded', name: 'Expanded', capacity: 1.5, footprint: Math.sqrt(1.5), cost: 1.55 },
  { id: 'large', name: 'Large', capacity: 2, footprint: Math.sqrt(2), cost: 2.15 },
] as const;
export function sizesForBuilding(kind: string) {
  return scalable.has(kind) ? buildingSizes : buildingSizes.slice(0, 1);
}
export function buildingSize(kind: string, id?: string) {
  return sizesForBuilding(kind).find((s) => s.id === (id ?? 'standard'));
}
/** Legacy action callers retain catalogue specifications. New designer requests always name a style.
 * Specialist equipment stays in the bill; only shell materials are replaced. */
export function buildingDesignQuote(
  kind: string,
  def: BuildingDef,
  style?: string,
  size?: string,
  architecture?: string,
) {
  const selected = buildingStyle(kind, style, architecture),
    scale = buildingSize(kind, size);
  const model = buildingArchitecture(kind, architecture);
  if (architecture !== undefined && (!model || !selected))
    throw Error('Choose a valid architectural model and finish');
  const cost = scale ? scale.cost * (model?.cost ?? 1) : 1;
  if (style !== undefined && !selected) throw Error('Choose a valid building style');
  if (!scale) throw Error('Choose a size available for this building');
  if (!selected && scale.id !== 'standard') throw Error('Choose a style for this size');
  if (!selected)
    return {
      price: def.price,
      capacity: def.capacity,
      materials: { ...def.materials },
      size: scale,
      style: undefined,
    };
  const shell = Math.max(
    6,
    (def.materials.wood ?? 0) + (def.materials.blocks ?? 0) + (def.materials.bricks ?? 0),
  );
  const raw: Stock = { ...def.materials };
  delete raw.wood;
  delete raw.blocks;
  delete raw.bricks;
  const add = (item: string, amount: number) => {
    raw[item] = (raw[item] ?? 0) + Math.ceil(amount);
  };
  add('gravel', Math.max(3, shell * 0.2));
  add('blocks', shell * (selected.structure === 'blocks' ? 0.75 : 0.15));
  add('wood', shell * (selected.structure === 'wood' ? 0.8 : 0.25));
  if (selected.structure === 'bricks') add('bricks', shell * 0.8);
  if (selected.structure === 'steel') {
    add('steel', shell * 0.25);
    add('concrete', shell * 0.3);
  }
  // Kilns, forges and kitchens retain their refractory core even with timber cladding.
  if (selected.structure !== 'bricks' && def.materials.bricks) add('bricks', def.materials.bricks);
  return {
    price: Math.ceil(def.price * selected.price * cost),
    capacity: Math.ceil(def.capacity * scale.capacity * (model?.capacity ?? 1)),
    materials: Object.fromEntries(
      Object.entries(raw)
        .filter(([, n]) => n > 0)
        .map(([item, n]) => [item, Math.ceil(n * cost)]),
    ),
    size: scale,
    style: selected,
  };
}

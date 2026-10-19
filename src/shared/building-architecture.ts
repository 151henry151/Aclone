// SPDX-License-Identifier: GPL-3.0-or-later
import type { BuildingVolume } from './building-shapes';

type Family =
  | 'house'
  | 'inn'
  | 'shop'
  | 'civic'
  | 'barn'
  | 'works'
  | 'mill'
  | 'yard'
  | 'pump'
  | 'port'
  | 'prop';
/** Stable model identifiers are independent of finishes and of saved legacy styles. */
const catalogue: Record<string, [Family, string[]]> = {
  home: [
    'house',
    [
      'Long cottage',
      'Cross-gable cottage',
      'Courtyard cottage',
      'Two-storey cottage',
      'Garden cottage',
    ],
  ],
  bnb: [
    'inn',
    ['Village guesthouse', 'Gabled lodge', 'Courtyard inn', 'Boarding house', 'Garden lodge'],
  ],
  hotel: [
    'inn',
    ['Country hotel', 'Twin-wing hotel', 'Courtyard hotel', 'Town hotel', 'Terrace hotel'],
  ],
  market: [
    'shop',
    ['Market hall', 'Corner stores', 'Market court', 'Merchant house', 'Covered bazaar'],
  ],
  workhouse: [
    'civic',
    ['Labour hall', 'Workshop office', 'Service court', 'Town labour exchange', 'District depot'],
  ],
  school: [
    'civic',
    ['School hall', 'Cross-wing school', 'College court', 'Village academy', 'Classroom pavilions'],
  ],
  pub: ['inn', ['Roadside inn', 'Cross Keys', 'Coaching inn', 'Town tavern', 'Garden tavern']],
  bank: [
    'civic',
    ['Counting house', 'Corner bank', 'Banking court', 'Savings tower', 'Bank pavilion'],
  ],
  town: [
    'civic',
    [
      'Council hall',
      'Civic cross-wing',
      'Council court',
      'Town chamber tower',
      'Assembly pavilion',
    ],
  ],
  garage: [
    'works',
    ['Motor shed', 'Repair bays', 'Service compound', 'Workshop and office', 'Twin service halls'],
  ],
  starport: [
    'port',
    [
      'Cargo terminal',
      'Flight operations',
      'Orbital freight court',
      'Passenger terminal',
      'Twin hangars',
    ],
  ],
  farm: ['barn', ['Field barn', 'Cross barn', 'Farmyard court', 'Granary barn', 'Twin crop barns']],
  mill: ['mill', ['Tower mill', 'Mill and granary', 'Mill court', 'Tall roller mill', 'Long mill']],
  feedmill: [
    'mill',
    ['Feed tower', 'Mill and stores', 'Feed court', 'Elevator mill', 'Feed blending hall'],
  ],
  bakery: [
    'shop',
    ['Village bakehouse', 'Corner bakery', 'Bakers’ court', 'Bakery and rooms', 'Oven hall'],
  ],
  creamery: [
    'shop',
    ['Cheese house', 'Dairy annex', 'Cheesemakers’ court', 'Cheese loft', 'Aging halls'],
  ],
  kitchen: [
    'shop',
    ['Village kitchen', 'Corner cookhouse', 'Kitchen court', 'Dining house', 'Kitchen pavilions'],
  ],
  dairyKitchen: [
    'shop',
    ['Country café', 'Corner café', 'Café courtyard', 'Café and rooms', 'Garden café'],
  ],
  teaHouse: [
    'shop',
    ['Tea pavilion', 'Tea blending annex', 'Tea court', 'Tea merchant house', 'Twin tea halls'],
  ],
  roastery: [
    'shop',
    ['Roasting house', 'Roastery annex', 'Coffee court', 'Coffee merchant house', 'Roasting halls'],
  ],
  sawmill: [
    'works',
    ['Saw hall', 'Cross-cut sheds', 'Timber court', 'Saw hall and loft', 'Twin saw halls'],
  ],
  quarry: [
    'yard',
    ['Quarry office', 'Cutting sheds', 'Quarry court', 'Aggregate tower', 'Sorting yard'],
  ],
  mason: [
    'yard',
    [
      'Stonecutters’ hall',
      'Masons’ workshop',
      'Masons’ court',
      'Stone warehouse',
      'Cutting pavilions',
    ],
  ],
  mine: [
    'yard',
    ['Pithead house', 'Mine workshop', 'Pithead court', 'Winding house', 'Ore sorting halls'],
  ],
  rareMine: [
    'yard',
    ['Assay house', 'Mineral workshop', 'Assay court', 'Separation tower', 'Mineral sorting halls'],
  ],
  forge: [
    'works',
    ['Foundry hall', 'Smithy and stores', 'Foundry court', 'Furnace tower', 'Twin furnace halls'],
  ],
  brewery: [
    'works',
    ['Brewhouse', 'Malt annex', 'Brewers’ court', 'Malt tower', 'Twin brewing halls'],
  ],
  workshop: [
    'works',
    ['Tool shop', 'Machine annex', 'Artisans’ court', 'Workshop loft', 'Twin machine halls'],
  ],
  refinery: [
    'works',
    ['Process house', 'Pump annex', 'Refinery court', 'Fractionation house', 'Twin process halls'],
  ],
  factory: [
    'works',
    [
      'Assembly hall',
      'Laboratory annex',
      'Factory court',
      'Assembly loft',
      'Twin production halls',
    ],
  ],
  shipyard: [
    'works',
    ['Fitting hall', 'Shipwrights’ annex', 'Shipyard court', 'Rigging loft', 'Twin fitting halls'],
  ],
  warehouse: [
    'works',
    ['Goods shed', 'Loading annex', 'Depot court', 'Warehouse loft', 'Twin freight halls'],
  ],
  composter: [
    'yard',
    ['Compost shed', 'Mixing annex', 'Composting court', 'Mixing tower', 'Twin compost sheds'],
  ],
  brickworks: [
    'works',
    ['Kiln hall', 'Drying annex', 'Kiln court', 'Kiln tower', 'Twin kiln halls'],
  ],
  concreteWorks: [
    'works',
    ['Batching hall', 'Mixing annex', 'Batching court', 'Batch tower', 'Twin mixing halls'],
  ],
  carpenter: [
    'works',
    ['Joinery hall', 'Cabinet annex', 'Joiners’ court', 'Furniture loft', 'Twin joinery halls'],
  ],
  winery: [
    'inn',
    ['Press house', 'Cellar annex', 'Vintners’ court', 'Wine merchant house', 'Cellar pavilions'],
  ],
  waterworks: [
    'pump',
    ['Intake house', 'Split pump house', 'Pump and valve house', 'Pump tower', 'Twin pump halls'],
  ],
  dairy: [
    'barn',
    ['Milking barn', 'Cross dairy', 'Dairy court', 'Hayloft dairy', 'Twin dairy barns'],
  ],
  sheepfold: [
    'barn',
    ['Sheep barn', 'Shearing annex', 'Shepherds’ court', 'Fodder loft', 'Twin sheep barns'],
  ],
  piggery: ['barn', ['Pig barn', 'Feed annex', 'Stockyard court', 'Feed loft', 'Twin pig barns']],
  henhouse: [
    'barn',
    ['Henhouse', 'Hatchery annex', 'Poultry court', 'Poultry loft', 'Twin poultry houses'],
  ],
  haybarn: ['barn', ['Hay hall', 'Cross hay barn', 'Hay court', 'Tall hayloft', 'Twin hay barns']],
  notice: [
    'prop',
    ['Village board', 'Roofed board', 'Notice kiosk', 'Bulletin tower', 'Twin notice boards'],
  ],
  portal: [
    'prop',
    ['Gate pylons', 'Stepped gateway', 'Portal pavilion', 'Signal gate', 'Twin-ring gate'],
  ],
  pickup: [
    'prop',
    [
      '20-foot container',
      '40-foot container',
      '40-foot high cube',
      'Paired 20-foot containers',
      'Container depot',
    ],
  ],
  turret: [
    'prop',
    [
      'Guard pedestal',
      'Armoured platform',
      'Guard pavilion',
      'Watchtower',
      'Twin-barrel emplacement',
    ],
  ],
  scripted: [
    'house',
    [
      'Garden lodge',
      'Botanist’s annex',
      'Walled garden lodge',
      'Naturalist’s tower',
      'Garden pavilions',
    ],
  ],
};
export function buildingArchitectures(kind: string) {
  const entry = catalogue[kind];
  if (!entry) return [];
  return entry[1].map((name, index) => ({
    id: `model-${index + 1}`,
    name,
    index,
    family: entry[0],
    capacity: kind === 'pickup' ? [1, 2, 2.25, 2, 3][index] : 1,
    cost: (kind === 'pickup' ? [1, 1.8, 2, 1.95, 2.9] : [1, 1.08, 1.18, 1.15, 1.22])[index],
    description:
      kind === 'pickup'
        ? [
            'A standard 6.06 metre shipping container.',
            'A long 12.19 metre shipping container.',
            'A taller 2.9 metre high-cube container.',
            'Two containers side by side with separate locking doors.',
            'Three containers arranged around an open loading court.',
          ][index]
        : [
            'A compact, purpose-built main hall.',
            'An asymmetric main building with a separate working wing.',
            'Three connected wings surrounding an open entrance court.',
            'A taller building with a lower service annex.',
            'Paired halls connected by a lower rear wing.',
          ][index],
  }));
}
export function buildingArchitecture(kind: string, id?: string) {
  return buildingArchitectures(kind).find((a) => a.id === id);
}
/** Architecture uses real metre-sized volumes; finishes never change this layout.
 * Existing buildings without an architecture retain their original plan. */
export function architecturalVolumes(
  kind: string,
  id: string,
  base: BuildingVolume[],
  size?: string,
): BuildingVolume[] {
  const model = buildingArchitecture(kind, id);
  if (!model) throw Error('Choose a valid architectural model');
  const m = base[0],
    { width: w, depth: d, eaves: h } = m;
  const v = (
    width: number,
    depth: number,
    eaves: number,
    x = 0,
    z = 0,
    roof: BuildingVolume['roof'] = 'gable',
    rise = Math.min(2.4, width * 0.24),
    roofAxis: 'x' | 'z' = 'z',
  ): BuildingVolume => ({
    width,
    depth,
    eaves,
    x,
    z,
    roof,
    rise: roof === 'flat' ? 0.2 : rise,
    roofAxis,
  });
  const i = model.index,
    f = model.family;
  let out: BuildingVolume[];
  const domestic = ['house', 'inn', 'shop', 'civic'].includes(f);
  const roof: BuildingVolume['roof'] =
    f === 'civic' || f === 'inn' ? 'hip' : f === 'works' ? 'shed' : 'gable';
  if (kind === 'pickup') {
    out = [
      [v(2.44, 6.06, 2.59, 0, 0, 'flat')],
      [v(2.44, 12.19, 2.59, 0, 0, 'flat')],
      [v(2.44, 12.19, 2.9, 0, 0, 'flat')],
      [v(2.44, 6.06, 2.59, -1.3, 0, 'flat'), v(2.44, 6.06, 2.59, 1.3, 0, 'flat')],
      [
        v(2.44, 6.06, 2.59, -2.44, 0, 'flat'),
        v(2.44, 6.06, 2.59, 2.44, 0, 'flat'),
        v(6.06, 2.44, 2.59, 0, -4.25, 'flat'),
      ],
    ][i].map((a) => ({ ...a, rise: 0 }));
  } else if (f === 'pump') {
    // Every pump-house plan fits the dry shoreline footprint used by intake validation.
    out = [
      [v(8, 6, 3.3, 0, 0, 'flat')],
      [v(5, 6, 4, -1.5), v(3, 4, 2.5, 2.5, -1, 'shed')],
      [v(8, 3, 3.6, 0, -1.5, 'flat'), v(3, 3, 2.8, -2.5, 1.5), v(3, 3, 2.8, 2.5, 1.5)],
      [v(4, 4, 6, -2, -1, 'flat'), v(4, 6, 2.7, 2, 0, 'shed')],
      [v(4, 6, 3.3, -2), v(4, 6, 3.3, 2)],
    ][i];
  } else if (f === 'prop') {
    // Dimensions also bound the bespoke posts, lockers and gate hardware in the renderer.
    out = [
      [v(w, d, h, 0, 0, 'flat', 0)],
      [v(w * 1.25, d * 1.5, h * 0.9, 0, 0, 'gable', 0.5)],
      [v(w * 1.4, Math.max(d * 2, 2), h, 0, 0, 'hip', 0.7)],
      [v(w * 0.9, d * 1.3, h * 1.6, 0, 0, 'flat', 0)],
      [v(w * 0.8, d, h, -w * 0.5), v(w * 0.8, d, h, w * 0.5)],
    ][i];
  } else if (f === 'port') {
    // Flight hardware stays at its real apron position; only the terminal campus varies.
    out = [
      [v(22, 14, 6.4, 0, 0, 'flat'), v(28, 24, 12, 29, -8), v(5, 6, 17, -7, -10, 'flat')],
      [v(16, 18, 8, 0, 0, 'shed'), v(22, 28, 11, 23, -5), v(7, 7, 20, -4, -12, 'flat')],
      [
        v(30, 8, 7, 0, -10, 'flat'),
        v(8, 18, 6, -11, 3, 'flat'),
        v(8, 18, 6, 11, 3, 'flat'),
        v(26, 26, 13, 33, -15),
      ],
      [v(20, 12, 12, 0, 0, 'flat'), v(12, 18, 5, 16, -3, 'flat'), v(26, 24, 11, 36, -6)],
      [v(18, 10, 5, 0, 0, 'flat'), v(18, 26, 12, 21, -8), v(18, 26, 12, 41, -8)],
    ][i];
  } else if (f === 'mill') {
    out = [
      [v(w, d, h, 0, 0, 'hip'), v(w * 0.8, d * 0.9, h * 0.42, w * 0.9, 0, 'shed')],
      [v(w, d, h, 0, 0), v(w * 1.2, d * 1.5, h * 0.5, w * 1.1, -d * 0.25, 'gable', 1.6, 'x')],
      [
        v(w * 2, d * 0.8, h * 0.65, 0, -d * 0.6),
        v(w * 0.6, d * 1.4, h * 0.5, -w * 0.7, d * 0.5),
        v(w * 0.6, d * 1.4, h * 0.5, w * 0.7, d * 0.5),
      ],
      [v(w * 0.85, d * 0.9, h * 1.4, 0, 0, 'flat'), v(w, d, h * 0.4, w * 0.925, 0, 'shed')],
      [
        v(w * 1.7, d, h * 0.6, 0, 0, 'gable', 2, 'x'),
        v(w * 0.65, d * 0.7, h * 1.1, -w * 0.5, -d * 0.85, 'hip'),
      ],
    ][i];
  } else {
    const height = f === 'yard' ? Math.max(h, 2.8) : h;
    out = [
      [v(w, d, height, 0, 0, roof, domestic ? m.rise : Math.min(3, w * 0.23))],
      [
        v(w * 0.78, d, height, 0, 0, roof),
        v(
          w * 0.65,
          d * 0.65,
          Math.max(2.3, height * 0.78),
          w * 0.715,
          -d * 0.175,
          'gable',
          1.5,
          'x',
        ),
      ],
      [
        v(w * 1.25, d * 0.48, height, 0, -d * 0.36, roof),
        v(w * 0.32, d * 0.9, Math.max(2.3, height * 0.8), -w * 0.465, d * 0.33),
        v(w * 0.32, d * 0.9, Math.max(2.3, height * 0.8), w * 0.465, d * 0.33),
      ],
      [
        v(w * 0.8, d * 0.8, height + (domestic ? 2.7 : 2), 0, 0, domestic ? 'hip' : 'flat'),
        v(w * 0.5, d * 0.7, Math.max(2.3, height * 0.65), w * 0.65, -d * 0.05, 'shed'),
      ],
      [
        v(w * 0.48, d * 1.15, height, -w * 0.4, 0, roof),
        v(w * 0.48, d * 1.15, height, w * 0.4, 0, roof),
        v(w * 0.32, d * 0.3, Math.max(2.3, height * 0.7), 0, -d * 0.425, 'flat'),
      ],
    ][i];
    if (f === 'yard') out.push(v(w * 0.6, d * 0.6, 1.1, -w * 0.25, -d * 1.05, 'flat'));
    if (f === 'barn' && i === 0) out[0].roof = 'gambrel';
    if (f === 'works' && i === 4) {
      out[0].roof = 'barrel';
      out[1].roof = 'barrel';
    }
    if (kind === 'scripted') out.push(v(3, 3, 0.8, w * 0.9, d * 0.7, 'flat', 0));
  }
  if (size === 'expanded' || size === 'large') {
    const right = Math.max(...out.map((a) => a.x + a.width / 2));
    const wingW = Math.max(3, w * 0.6);
    out.push(
      v(
        wingW,
        d * 0.8,
        domestic ? 2.7 : h * 0.85,
        right + wingW / 2,
        -d * 0.1,
        domestic ? 'hip' : 'shed',
      ),
    );
    if (size === 'large') {
      if (domestic) out[0] = { ...out[0], eaves: out[0].eaves + 2.7 };
      else {
        const back = Math.min(...out.map((a) => a.z - a.depth / 2));
        out.push(v(w * 1.1, d * 0.65, h, 0, back - d * 0.325, 'gable', 2, 'x'));
      }
    }
  }
  return out;
}

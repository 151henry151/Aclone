// SPDX-License-Identifier: GPL-3.0-or-later
import type { BuildingVolume } from './building-shapes';
import { buildingRecipes } from './building-recipes';

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
  boathouse: ['works', buildingRecipes.boathouse.map((recipe) => recipe.name)],
  market: ['shop', buildingRecipes.market.map((recipe) => recipe.name)],
  workhouse: ['civic', buildingRecipes.workhouse.map((recipe) => recipe.name)],
  school: ['civic', buildingRecipes.school.map((recipe) => recipe.name)],
  home: ['house', buildingRecipes.home.map((recipe) => recipe.name)],
  pub: ['inn', buildingRecipes.pub.map((recipe) => recipe.name)],
  garage: ['works', buildingRecipes.garage.map((recipe) => recipe.name)],
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
  bank: ['civic', buildingRecipes.bank.map((recipe) => recipe.name)],
  town: ['civic', buildingRecipes.town.map((recipe) => recipe.name)],
  farm: ['barn', buildingRecipes.farm.map((recipe) => recipe.name)],
  mill: ['mill', buildingRecipes.mill.map((recipe) => recipe.name)],
  bakery: ['shop', buildingRecipes.bakery.map((recipe) => recipe.name)],
  sawmill: ['works', buildingRecipes.sawmill.map((recipe) => recipe.name)],
  quarry: ['yard', buildingRecipes.quarry.map((recipe) => recipe.name)],
  mason: ['yard', buildingRecipes.mason.map((recipe) => recipe.name)],
  mine: ['yard', buildingRecipes.mine.map((recipe) => recipe.name)],
  forge: ['works', buildingRecipes.forge.map((recipe) => recipe.name)],
  brewery: ['works', buildingRecipes.brewery.map((recipe) => recipe.name)],
  workshop: ['works', buildingRecipes.workshop.map((recipe) => recipe.name)],
  refinery: ['works', buildingRecipes.refinery.map((recipe) => recipe.name)],
  rareMine: ['yard', buildingRecipes.rareMine.map((recipe) => recipe.name)],
  factory: ['works', buildingRecipes.factory.map((recipe) => recipe.name)],
  shipyard: ['works', buildingRecipes.shipyard.map((recipe) => recipe.name)],
  warehouse: ['works', buildingRecipes.warehouse.map((recipe) => recipe.name)],
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
  portal: [
    'prop',
    ['Gate pylons', 'Stepped gateway', 'Portal pavilion', 'Signal gate', 'Twin-ring gate'],
  ],
  notice: [
    'prop',
    ['Village board', 'Roofed board', 'Notice kiosk', 'Bulletin tower', 'Twin notice boards'],
  ],
  scripted: ['house', buildingRecipes.scripted.map((recipe) => recipe.name)],
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
  composter: ['yard', buildingRecipes.composter.map((recipe) => recipe.name)],
  brickworks: ['works', buildingRecipes.brickworks.map((recipe) => recipe.name)],
  concreteWorks: ['works', buildingRecipes.concreteWorks.map((recipe) => recipe.name)],
  carpenter: ['works', buildingRecipes.carpenter.map((recipe) => recipe.name)],
  winery: ['inn', buildingRecipes.winery.map((recipe) => recipe.name)],
  kitchen: ['shop', buildingRecipes.kitchen.map((recipe) => recipe.name)],
  teaHouse: ['shop', buildingRecipes.teaHouse.map((recipe) => recipe.name)],
  roastery: ['shop', buildingRecipes.roastery.map((recipe) => recipe.name)],
  bnb: ['inn', buildingRecipes.bnb.map((recipe) => recipe.name)],
  hotel: ['inn', buildingRecipes.hotel.map((recipe) => recipe.name)],
  waterworks: [
    'pump',
    ['Intake house', 'Split pump house', 'Pump and valve house', 'Pump tower', 'Twin pump halls'],
  ],
  feedmill: ['mill', buildingRecipes.feedmill.map((recipe) => recipe.name)],
  dairy: ['barn', buildingRecipes.dairy.map((recipe) => recipe.name)],
  creamery: ['shop', buildingRecipes.creamery.map((recipe) => recipe.name)],
  dairyKitchen: ['shop', buildingRecipes.dairyKitchen.map((recipe) => recipe.name)],
  sheepfold: ['barn', buildingRecipes.sheepfold.map((recipe) => recipe.name)],
  piggery: ['barn', buildingRecipes.piggery.map((recipe) => recipe.name)],
  henhouse: ['barn', buildingRecipes.henhouse.map((recipe) => recipe.name)],
  haybarn: ['barn', buildingRecipes.haybarn.map((recipe) => recipe.name)],
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
    description: buildingRecipes[kind]
      ? `${buildingRecipes[kind][index].name}. Purpose-built rooms and working spaces; choose the wall finish independently.`
      : kind === 'pickup'
        ? [
            'A standard 6.06 metre shipping container.',
            'A long 12.19 metre shipping container.',
            'A taller 2.9 metre high-cube container.',
            'Two containers side by side with separate locking doors.',
            'Three containers arranged around an open loading court.',
          ][index]
        : `${name}. A specialist layout; choose its surface finish independently.`,
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
  if (buildingRecipes[kind]) {
    out = buildingRecipes[kind][i].volumes.map((v) => ({ ...v }));
    if (kind === 'scripted') {
      const right = Math.max(...out.map((a) => a.x + a.width / 2));
      out.push(v(3, 3, 0.8, right + 2, 2, 'flat', 0));
    }
  } else if (kind === 'pickup') {
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
      [v(5, 6, 3.6, -1.5, 0, 'barrel', 1.2), v(3, 3, 2.5, 2.5, -1.5, 'flat')],
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
  } else {
    out = [v(w, d, h, 0, 0, roof, m.rise)];
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

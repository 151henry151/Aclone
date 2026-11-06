import { isTractor } from '../shared/tractors';
import { configureVehicleVisual } from './vehicle-custom';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building, World, Player } from '../shared/types';
import type { InteriorRig } from './building-interiors';
import { buildingDoorHash } from '../shared/building-doors';
import { buildingArchitecture } from '../shared/building-architecture';
import { batch } from './tractor';
import { finishMaterial } from './building-finishes';
import { detailMaterial } from './detail-textures';
import { yardBoat } from './yard-boats';
import { createMotorboat } from './motorboat';
import { createCanalBoat } from './canal-boat';
import { shippingContainers } from './shipping-container';
import { animalModel } from './animal-model';
import { fleetTractor } from './tractor-fleet';
import { createBiplane } from './biplane';
import { buildingPlan } from '../shared/building-shapes';
import { storedBoatDisplay } from '../shared/stored-boats';
import { vehicleDef } from '../shared/vehicle-config';
import { MOTORBOAT } from '../shared/boats';
import { tractorPaint, vehiclePaint } from '../shared/appearance';
const animalCache = new Map<string, ReturnType<typeof animalModel>>();
function interiorAnimal(kind: Parameters<typeof animalModel>[0]) {
  let parts = animalCache.get(kind);
  if (!parts) {
    parts = animalModel(kind);
    if (kind === 'cows')
      for (const part of parts) {
        const original = part.geometry;
        for (const key of Object.keys(original.attributes))
          if (!['position', 'normal', 'color'].includes(key)) original.deleteAttribute(key);
        const merged = mergeVertices(original);
        part.geometry = new SimplifyModifier().modify(
          merged,
          Math.floor(merged.attributes.position.count * 0.48),
        );
        original.dispose();
        merged.dispose();
      }
    animalCache.set(kind, parts);
  }
  return parts.map((p) => ({ ...p, geometry: p.geometry.clone() }));
}
const steel = '#596c68',
  wood = '#9c7d4c',
  dark = '#303c39',
  red = '#a34835';
const equipment: Record<string, string[]> = {
  workshop: [
    'workbench',
    'table-saw',
    'lumber',
    'planer',
    'clamp-rail',
    'finished-furniture',
    'glue-stove',
    'shavings',
  ],
  carpenter: [
    'workbench',
    'table-saw',
    'lumber',
    'planer',
    'clamp-rail',
    'finished-furniture',
    'glue-stove',
    'shavings',
  ],
  garage: [
    'lift',
    'tractor',
    'workbench',
    'tool-chest',
    'compressor',
    'hose-reel',
    'bench-grinder',
    'parts-washer',
    'tyre-changer',
    'tyre-balancer',
    'oil-rack',
    'pegboard',
    'calendar',
  ],
  sawmill: [
    'log-carriage',
    'saw',
    'lumber',
    'logs',
    'crosscut-bench',
    'blade-sharpener',
    'dust-duct',
    'sawdust',
  ],
  brewery: [
    'copper-kettles',
    'fermenters',
    'mash-tun',
    'grain-hopper',
    'malt-sacks',
    'hose-rack',
    'keg-washer',
    'kegs',
    'gyle-board',
  ],
  warehouse: [
    'pallet-racks',
    'forklift',
    'floor-pallets',
    'packing-bench',
    'roller-conveyor',
    'dock-bumpers',
  ],
  factory: [
    'machine-line',
    'gantry',
    'control-cabinet',
    'finished-pallet',
    'electrical-panel',
    'walkway',
  ],
  shipyard: ['hull-cradle', 'slipway', 'canvas-loft', 'rope-coils', 'paint-locker', 'steam-box'],
  boathouse: [
    'hull-cradle',
    'stored-boats',
    'canvas-loft',
    'slipway',
    'rope-coils',
    'paint-locker',
    'steam-box',
  ],
  forge: ['hearth', 'anvil', 'bellows', 'quench-tub', 'hammer-rack', 'bar-stock'],
  feedmill: ['grain-hopper', 'bagging-chute', 'sacks', 'bale-elevator', 'pitchfork', 'hand-cart'],
  haybarn: ['bales', 'bale-elevator', 'hand-cart', 'grain-hopper', 'bagging-chute', 'pitchfork'],
  farm: [
    'tractor',
    'grain-hopper',
    'hand-cart',
    'bagging-chute',
    'sacks',
    'bale-elevator',
    'pitchfork',
  ],
  brickworks: ['drying-racks', 'kiln', 'bricks', 'workbench'],
  concreteWorks: ['mixer', 'aggregate-bins', 'cement-chutes', 'sacks'],
  mason: ['banker-bench', 'stone-saw', 'stone-block', 'chisels', 'dust'],
  quarry: ['crusher', 'rock-pile', 'compressor', 'drill-steels', 'dust'],
  mine: ['mine-cage', 'ore-cars', 'rock-pile', 'compressor', 'drill-steels'],
  rareMine: ['mine-cage', 'ore-cars', 'rock-pile', 'compressor', 'drill-steels'],
  dairy: ['pens', 'animals', 'milking-stand', 'churns', 'feed-trough', 'hay-rack', 'wash-hose'],
  sheepfold: ['pens', 'animals', 'feed-trough', 'hay-rack', 'churns', 'wash-hose'],
  piggery: ['pens', 'animals', 'feed-trough', 'hay-rack', 'wash-hose'],
  refinery: ['pump-hall', 'pipework', 'control-desk', 'compressor', 'valves', 'gauges'],
  composter: ['compost-bins', 'screen', 'hand-cart', 'pitchfork'],
  starport: ['freight-train', 'container-transporter', 'maintenance-gantry', 'fuel-bowser'],
  hangar: [
    'parked-biplane',
    'repair-biplane',
    'workbench',
    'engine-stand',
    'wall-propeller',
    'tool-chest',
    'second-tool-chest',
    'oil-pump',
    'spanners',
    'bunded-fuel',
    'tyre-rack',
    'weather-board',
  ],
};
/** Original low-poly furnishing kit, with fixtures named for inspection before batching. */
function prop(name: string) {
  const group = new T.Group();
  group.userData.interiorProp = name;
  group.name = name;
  const materials = new Map<string, T.MeshStandardMaterial>();
  const mat = (color: string) => {
    let m = materials.get(color);
    if (!m) {
      m = new T.MeshStandardMaterial({ color, roughness: 0.8 });
      materials.set(color, m);
    }
    return m;
  };
  const mesh = (geometry: T.BufferGeometry, color: string, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geometry, mat(color));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, x = 0, y = h / 2, z = 0, c = steel) =>
    mesh(new T.BoxGeometry(w, h, d), c, x, y, z);
  const cyl = (r: number, h: number, x = 0, y = h / 2, z = 0, c = steel) =>
    mesh(new T.CylinderGeometry(r, r, h, 8), c, x, y, z);
  const wheel = (x: number, y: number, z: number, r = 0.2) => {
    const m = cyl(r, 0.12, x, y, z, dark);
    m.rotation.z = Math.PI / 2;
    return m;
  };
  const bench = () => {
    box(1.5, 0.12, 0.65, 0, 0.85, 0, wood);
    for (const x of [-0.6, 0.6]) for (const z of [-0.24, 0.24]) box(0.08, 0.8, 0.08, x, 0.4, z);
  };
  const rack = () => {
    for (const x of [-0.7, 0.7]) box(0.07, 2, 0.07, x);
    for (const y of [0.2, 0.85, 1.5]) box(1.5, 0.06, 0.65, 0, y);
  };
  const cart = () => {
    box(1.5, 0.12, 0.9, 0, 0.35, 0, wood);
    for (const x of [-0.7, 0.7]) for (const z of [-0.35, 0.35]) wheel(x, 0.22, z);
  };
  const machine = () => {
    box(1.25, 0.5, 0.65);
    box(0.45, 0.9, 0.55, -0.35, 0.9);
    box(0.65, 0.08, 0.55, 0.2, 0.75);
    cyl(0.12, 0.08, 0.2, 1.1, 0.05, dark);
  };
  switch (name) {
    case 'workbench':
    case 'crosscut-bench':
    case 'banker-bench':
      bench();
      box(0.18, 0.14, 0.2, -0.45, 0.97, 0.2, dark);
      box(0.05, 0.2, 0.12, -0.6, 1, 0.2);
      break;
    case 'table-saw':
    case 'stone-saw':
      bench();
      {
        const saw = cyl(0.26, 0.025, 0, 0.97, 0, '#a3aaa5');
        saw.rotation.z = Math.PI / 2;
      }
      break;
    case 'machine-line':
      for (const x of [-1.8, 0, 1.8]) {
        const m = prop(x === 0 ? 'mill' : x < 0 ? 'lathe' : 'press');
        m.position.x = x;
        group.add(m);
      }
      break;
    case 'lathe':
      box(1.65, 0.65, 0.65);
      box(0.35, 0.55, 0.6, -0.6, 0.9);
      cyl(0.19, 0.18, -0.32, 1.0, 0, '#a8aca5').rotation.z = Math.PI / 2;
      box(0.22, 0.3, 0.4, 0.6, 0.88);
      box(0.5, 0.08, 0.55, 0.1, 0.73);
      cyl(0.025, 1.4, 0, 0.57, 0.38, '#a8aca5').rotation.z = Math.PI / 2;
      break;
    case 'mill':
      box(0.8, 0.25, 0.7);
      box(0.35, 1.5, 0.4, -0.25, 0.9, -0.12);
      box(0.7, 0.22, 0.45, 0, 1.65);
      box(0.95, 0.1, 0.55, 0.2, 0.8);
      cyl(0.07, 0.45, 0.2, 1.3, 0, '#a8aca5');
      break;
    case 'press':
      for (const x of [-0.5, 0.5]) box(0.18, 1.9, 0.45, x);
      box(1.2, 0.2, 0.6, 0, 1.85);
      box(1.2, 0.18, 0.65, 0, 0.65);
      cyl(0.15, 0.7, 0, 1.35);
      box(0.5, 0.12, 0.45, 0, 1);
      break;
    case 'planer':
    case 'power-hammer':
    case 'drill-press':
    case 'blade-sharpener':
    case 'tyre-changer':
    case 'tyre-balancer':
      machine();
      break;
    case 'lift': {
      const arms = new T.Group();
      arms.name = 'lift-arms';
      group.add(arms);
      for (const x of [-1.4, 1.4]) {
        box(0.17, 3, 0.25, x);
        for (const z of [-1.2, 1.2]) arms.add(box(1.05, 0.12, 0.18, x / 2, 0, z));
        arms.add(box(0.4, 0.1, 3.6, x / 1.4, 0.1, 0));
      }
      break;
    }
    case 'pit-grate':
      box(1.1, 0.08, 2, 0, 0.08, 0, dark);
      for (let z = -0.9; z < 1; z += 0.16) box(1, 0.04, 0.035, 0, 0.14, z);
      break;
    case 'parts-store':
      rack();
      box(1.5, 0.85, 0.6, 0, 0.425, 0.7, wood);
      break;
    case 'tool-chest':
    case 'second-tool-chest':
      box(0.9, 0.8, 0.5, 0, 0.5, 0, red);
      for (let y = 0.3; y < 0.9; y += 0.12) box(0.75, 0.025, 0.03, 0, y, 0.26, dark);
      for (const x of [-0.35, 0.35]) wheel(x, 0.13, 0, 0.1);
      break;
    case 'compressor':
      {
        const tank = cyl(0.3, 1.1, 0, 0.4);
        tank.rotation.z = Math.PI / 2;
        box(0.45, 0.2, 0.3, 0, 0.8);
        wheel(-0.45, 0.18, 0);
        wheel(0.45, 0.18, 0);
      }
      break;
    case 'hose-reel':
    case 'hose-rack':
    case 'rope-coils':
    case 'wash-hose':
      for (let i = 0; i < 4; i++) {
        const ring = mesh(
          new T.TorusGeometry(0.25 + i * 0.015, 0.025, 4, 12),
          name === 'rope-coils' ? wood : '#c1a53f',
          0,
          0.35,
          i * 0.055,
        );
        if (name === 'rope-coils') ring.rotation.x = Math.PI / 2;
      }
      break;
    case 'bench-grinder':
      bench();
      box(0.4, 0.2, 0.22, 0, 1);
      wheel(-0.3, 1.12, 0, 0.16);
      wheel(0.3, 1.12, 0, 0.16);
      break;
    case 'parts-washer':
      bench();
      box(0.8, 0.25, 0.5, 0, 1, 0, steel);
      box(0.7, 0.02, 0.4, 0, 1.14, 0, dark);
      break;
    case 'oil-rack':
    case 'tyre-rack':
    case 'paint-locker':
      rack();
      for (let i = 0; i < 6; i++) {
        const x = ((i % 3) - 1) * 0.45,
          y = 0.4 + Math.floor(i / 3) * 0.65;
        if (name === 'tyre-rack') wheel(x, y, 0, 0.2);
        else cyl(0.12, 0.3, x, y, 0, i % 2 ? red : wood);
      }
      break;
    case 'pegboard':
    case 'spanners':
    case 'hammer-rack':
    case 'clamp-rail':
    case 'chisels':
    case 'drill-steels':
      box(1.25, 0.7, 0.04, 0, 0.5, 0, wood);
      for (let i = 0; i < 7; i++) {
        box(0.035, 0.4, 0.04, (i - 3) * 0.16, 0.55, 0.06);
        box(name === 'clamp-rail' ? 0.13 : 0.08, 0.04, 0.06, (i - 3) * 0.16, 0.73, 0.06);
      }
      break;
    case 'calendar':
    case 'gyle-board':
    case 'weather-board':
      box(1, 0.7, 0.06, 0, 0.5, 0, wood);
      box(0.9, 0.6, 0.02, 0, 0.5, 0.045, name === 'calendar' ? '#e5dfc7' : '#33443e');
      for (let i = 0; i < 4; i++)
        box(0.55 - i * 0.08, 0.018, 0.015, -0.1, 0.7 - i * 0.11, 0.06, '#c8d4b3');
      break;
    case 'log-carriage':
      box(1.3, 0.3, 2.5, 0, 0.35, 0, steel);
      for (const x of [-0.6, 0.6]) box(0.04, 0.04, 3, x, 0.1);
      {
        const log = cyl(0.3, 2.2, 0, 0.7, 0, wood);
        log.rotation.x = Math.PI / 2;
      }
      break;
    case 'saw':
      box(0.5, 1.2, 0.55);
      {
        const saw = cyl(0.55, 0.04, 0.3, 1.1, 0, '#a2a5a0');
        saw.rotation.z = Math.PI / 2;
      }
      box(1.4, 0.1, 0.6, 0, 0.7);
      break;
    case 'band-saw':
      box(0.3, 2.1, 0.45, -0.45, 1.05);
      box(0.9, 0.18, 0.45, 0, 2.05);
      box(1.2, 0.1, 0.8, 0, 0.8);
      box(0.025, 1.4, 0.05, 0.35, 1.3, 0, '#a5aaa4');
      wheel(0, 1.95, 0, 0.3);
      wheel(0, 0.45, 0, 0.3);
      break;
    case 'sand-floor':
      box(1.8, 0.025, 1.8, 0, 0.015, 0, '#b59d71');
      break;
    case 'logs':
      for (let i = 0; i < 3; i++) {
        const log = cyl(0.16, 1.6, (i - 1) * 0.35, 0.2, 0, wood);
        log.rotation.x = Math.PI / 2;
      }
      break;
    case 'lumber':
    case 'bar-stock':
      for (let i = 0; i < 6; i++)
        box(1.6, 0.07, 0.3, 0, 0.1 + i * 0.1, (i % 2) * 0.1, name === 'lumber' ? wood : steel);
      break;
    case 'dust-duct':
      {
        const duct = cyl(0.18, 1.7, 0, 1.6);
        duct.rotation.z = Math.PI / 2;
      }
      cyl(0.2, 1.5, -0.65, 0.8);
      break;
    case 'sawdust':
    case 'dust':
    case 'shavings':
      mesh(new T.ConeGeometry(0.6, 0.4, 8), wood, 0, 0.2);
      break;
    case 'copper-kettles': {
      const manways = new T.Group();
      manways.name = 'kettle-manways';
      group.add(manways);
      const dais = box(2.35, 0.15, 1.2, 0, 0.075, 0);
      dais.material = finishMaterial('limestone', '#d3c6a2');
      for (const x of [-0.6, 0.6]) for (const dx of [-0.25, 0.25]) cyl(0.04, 0.1, x + dx, 0.2, 0);
      for (const x of [-0.6, 0.6]) {
        cyl(0.48, 1.2, x, 0.85, 0, '#ae713b');
        mesh(new T.SphereGeometry(0.48, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#ae713b', x, 1.45);
        cyl(0.12, 0.25, x, 1.9);
        box(0.2, 0.03, 0.2, x, 1.95, 0.1);
        const cover = cyl(0.17, 0.06, x, 1.1, 0.48, steel);
        cover.rotation.x = Math.PI / 2;
        manways.add(cover);
        box(0.16, 0.025, 0.06, x, 1.1, 0.53, dark);
      }
      break;
    }
    case 'fermenters':
      for (const x of [-0.6, 0, 0.6]) {
        cyl(0.25, 1.7, x, 1.05);
        cyl(0.065, 0.08, x, 1.55, 0.26, '#e7e3cd');
      }
      break;
    case 'mash-tun':
      cyl(0.5, 1, 0, 0.65, 0, '#ae713b');
      box(1.15, 0.12, 1.1, 0, 0.1, 0, '#d3c6a2');
      break;
    case 'grain-hopper':
      mesh(new T.CylinderGeometry(0.6, 0.18, 0.85, 4), steel, 0, 1.25);
      for (const x of [-0.45, 0.45]) box(0.07, 1.4, 0.07, x, 0.7);
      cyl(0.07, 1.5, 0.65, 0.9);
      break;
    case 'bagging-chute':
      box(0.7, 1.5, 0.5);
      cyl(0.12, 0.3, 0, 1.1, 0.4);
      box(0.55, 0.15, 0.5, 0, 0.2, 0.45, wood);
      break;
    case 'sacks':
    case 'malt-sacks': {
      const pallet = new T.Group();
      pallet.name = 'sack-pallet';
      group.add(pallet);
      for (const x of [-0.4, 0, 0.4]) pallet.add(box(0.12, 0.12, 0.65, x, 0.06, 0, wood));
      for (const z of [-0.25, 0, 0.25]) pallet.add(box(1, 0.06, 0.2, 0, 0.15, z, wood));
      for (let i = 0; i < 4; i++)
        box(
          0.38,
          0.45,
          0.35,
          ((i % 2) - 0.5) * 0.42,
          0.41 + Math.floor(i / 2) * 0.45,
          0,
          '#b6a780',
        );
      break;
    }
    case 'keg-washer':
      bench();
      cyl(0.18, 0.38, -0.3, 1.1);
      box(0.3, 0.05, 0.12, 0.3, 1.4);
      break;
    case 'kegs':
    case 'churns':
    case 'oil-pump':
      for (const x of [-0.3, 0.3]) {
        cyl(0.22, 0.65, x, 0.35);
        cyl(0.24, 0.03, x, 0.1);
        cyl(0.24, 0.03, x, 0.6);
      }
      if (name === 'oil-pump') {
        box(0.045, 0.5, 0.045, 0, 0.9);
        box(0.35, 0.04, 0.05, 0, 1.15);
      }
      break;
    case 'pallet-racks':
    case 'drying-racks':
      rack();
      break;
    case 'floor-pallets':
    case 'finished-pallet':
    case 'bricks':
      box(1.1, 0.1, 0.8, 0, 0.1, 0, wood);
      for (let i = 0; i < 6; i++)
        box(
          0.3,
          0.22,
          0.3,
          ((i % 3) - 1) * 0.33,
          0.27 + Math.floor(i / 3) * 0.25,
          0,
          name === 'bricks' ? '#ae6241' : wood,
        );
      break;
    case 'forklift':
    case 'fuel-bowser':
      cart();
      box(0.8, 0.6, 0.65, 0, 0.65, 0, red);
      if (name === 'forklift') {
        for (const x of [-0.4, 0.4]) {
          box(0.08, 2, 0.08, x, 1, 0.5);
          box(0.08, 0.06, 0.7, x, 0.2, 0.8);
        }
        box(0.1, 0.8, 0.1, 0, 0.9, -0.2);
      } else if (name === 'fuel-bowser') {
        const tank = cyl(0.45, 1.4, 0, 0.9);
        tank.rotation.z = Math.PI / 2;
      } else box(1.3, 0.9, 0.8, 0, 0.85, 0, '#78949c');
      break;
    case 'container-transporter': {
      const plan = buildingPlan({
        id: 'interior-container',
        kind: 'pickup',
        architecture: 'model-1',
      });
      const container = shippingContainers(plan);
      container.position.y = 0.85;
      group.add(container);
      box(2.7, 0.2, 6.4, 0, 0.7, 0, dark);
      for (const x of [-1.15, 1.15]) for (const z of [-2.4, 2.4]) wheel(x, 0.4, z, 0.4);
      box(0.12, 0.12, 1.3, 0, 0.5, 3.7);
      break;
    }
    case 'packing-bench':
      bench();
      box(0.35, 0.08, 0.3, -0.4, 0.97);
      cyl(0.14, 0.4, 0.4, 1.12, 0, '#d7dfcf');
      break;
    case 'roller-conveyor':
      for (let z = -0.7; z < 0.8; z += 0.15) {
        const roller = cyl(0.045, 1, 0, 0.65, z);
        roller.rotation.z = Math.PI / 2;
      }
      for (const x of [-0.5, 0.5]) box(0.07, 0.65, 1.7, x);
      break;
    case 'dock-bumpers':
      for (const x of [-0.5, 0.5]) box(0.25, 0.4, 0.18, x, 0.22, 0, dark);
      break;
    case 'gantry':
    case 'maintenance-gantry':
      for (const x of [-1.5, 1.5]) box(0.16, name === 'maintenance-gantry' ? 4.4 : 2.7, 0.16, x);
      box(3.2, 0.2, 0.2, 0, name === 'maintenance-gantry' ? 4.3 : 2.6, 0, '#c5a84c');
      box(0.3, 0.2, 0.3, 0, name === 'maintenance-gantry' ? 4.05 : 2.35);
      box(0.03, 1, 0.03, 0, name === 'maintenance-gantry' ? 3.5 : 1.8);
      break;
    case 'control-cabinet':
    case 'electrical-panel':
    case 'control-desk':
      box(1, 0.95, 0.5);
      for (let i = 0; i < 6; i++)
        cyl(
          0.04,
          0.025,
          ((i % 3) - 1) * 0.22,
          0.7 - Math.floor(i / 3) * 0.2,
          0.27,
          i % 2 ? '#ae523a' : '#8ca578',
        ).rotation.x = Math.PI / 2;
      break;
    case 'walkway':
      for (const x of [-0.45, 0.45]) box(0.045, 0.01, 2, x, 0.02, 0, '#c8b44e');
      break;
    case 'office':
      for (const x of [-0.9, 0.9]) box(0.06, 1.8, 0.06, x, 0.9);
      box(1.9, 0.06, 0.06, 0, 1.8);
      {
        const pane = box(1.8, 1.2, 0.025, 0, 1.15);
        pane.material = new T.MeshStandardMaterial({
          color: '#96b9b2',
          transparent: true,
          opacity: 0.25,
        });
      }
      bench();
      break;
    case 'slipway':
      for (const x of [-0.5, 0.5]) box(0.1, 0.08, 2, x, 0.05);
      break;
    case 'canvas-loft':
      box(1.5, 0.1, 0.7, 0, 1.6, 0, wood);
      for (let i = 0; i < 3; i++) {
        const roll = cyl(0.13, 1.3, 0, 1.78, i * 0.17, '#d5c8a6');
        roll.rotation.z = Math.PI / 2;
      }
      break;
    case 'steam-box':
      box(1.7, 0.35, 0.45, 0, 0.6, 0, wood);
      cyl(0.2, 0.5, -0.65, 0.25);
      break;
    case 'hearth':
    case 'kiln':
      box(1.4, 0.25, 0.8, 0, 0.15, 0, '#8e5943');
      for (const x of [-0.6, 0.6]) box(0.2, 1.1, 0.8, x, 0.6, 0, '#8e5943');
      box(1.4, 0.2, 0.8, 0, 1.15, 0, '#8e5943');
      {
        const coal = box(0.9, 0.1, 0.5, 0, 0.35, 0, '#76331c');
        coal.material.emissive.set('#e06a22');
        coal.material.emissiveIntensity = 0.5;
        coal.name = 'hearth-coals';
        coal.material = coal.material.clone();
        const fire = new T.Group();
        fire.add(coal);
        group.add(fire);
      }
      break;
    case 'anvil':
      cyl(0.3, 0.55, 0, 0.28, 0, wood);
      box(0.7, 0.18, 0.25, 0, 0.65);
      mesh(new T.ConeGeometry(0.14, 0.35, 6), steel, 0.48, 0.7).rotation.z = -Math.PI / 2;
      break;
    case 'bellows':
      box(0.4, 0.25, 0.65, 0, 0.5, 0, wood);
      box(0.05, 0.7, 0.05, 0.3, 0.6);
      break;
    case 'quench-tub':
      cyl(0.35, 0.6);
      cyl(0.3, 0.015, 0, 0.61, 0, '#4e7779');
      break;
    case 'finished-furniture': {
      const cabinet = new T.Group();
      cabinet.name = 'finished-cabinet';
      group.add(cabinet);
      cabinet.add(box(0.8, 1.3, 0.45, -0.45, 0.65, -0.15, wood));
      for (const x of [-0.65, -0.25]) cabinet.add(box(0.025, 0.15, 0.025, x, 0.7, 0.085, dark));
      for (const x of [0.18, 0.62])
        for (const z of [0.52, 0.9]) box(0.055, 0.45, 0.055, x, 0.225, z, wood);
      box(0.55, 0.09, 0.5, 0.4, 0.45, 0.7, wood);
      box(0.55, 0.7, 0.08, 0.4, 0.8, 0.5, wood);
      break;
    }
    case 'glue-stove':
      cyl(0.25, 0.7);
      cyl(0.08, 1.2, -0.2, 1.1);
      break;
    case 'swarf-bin':
    case 'aggregate-bins':
    case 'compost-bins':
      box(1.25, 0.55, 0.7, 0, 0.28);
      box(1.1, 0.04, 0.55, 0, 0.56, 0, name === 'compost-bins' ? '#5f4d35' : '#8f8b7b');
      break;
    case 'bale-elevator':
      box(0.7, 0.1, 1.8, 0, 0.55, 0, steel).rotation.x = -0.4;
      for (const x of [-0.3, 0.3]) box(0.05, 0.8, 0.05, x, 0.4);
      break;
    case 'hand-cart':
      cart();
      for (const x of [-0.6, 0.6]) box(0.05, 0.05, 1, x, 0.55, -0.8, wood);
      break;
    case 'pitchfork':
      box(0.035, 1.4, 0.035, 0, 0.7, 0, wood);
      for (const x of [-0.12, 0, 0.12]) box(0.025, 0.3, 0.025, x, 0.18);
      box(0.28, 0.03, 0.03, 0, 0.35);
      break;
    case 'mixer':
      {
        const drum = cyl(0.5, 0.8, 0, 0.9);
        drum.rotation.x = 0.55;
      }
      for (const x of [-0.4, 0.4]) box(0.07, 0.8, 0.07, x, 0.4);
      break;
    case 'cement-chutes':
      cyl(0.18, 1.8);
      box(0.6, 0.25, 0.6, 0, 1.8);
      break;
    case 'stone-block':
      box(0.8, 0.75, 0.7, 0, 0.38, 0, '#9a9d92');
      box(0.45, 0.3, 0.55, 0, 0.9, 0, '#9a9d92');
      break;
    case 'rock-pile':
      for (const x of [-0.4, 0, 0.4])
        mesh(new T.IcosahedronGeometry(0.35, 0), '#8e8d7d', x, 0.3, x * 0.4);
      break;
    case 'crusher':
      machine();
      for (let i = 0; i < 6; i++) box(0.06, 0.45, 0.1, (i - 3) * 0.12, 1, 0.38);
      break;
    case 'mine-cage':
      for (const x of [-0.5, 0.5]) for (const z of [-0.4, 0.4]) box(0.045, 1.8, 0.045, x, 0.9, z);
      box(1.1, 0.08, 0.9);
      box(1.1, 0.08, 0.9, 0, 1.8);
      break;
    case 'ore-cars':
      cart();
      box(1.4, 0.5, 0.8, 0, 0.6, 0, steel);
      break;
    case 'pens':
      for (const x of [-0.8, 0.8]) {
        for (const z of [-1, 1]) box(0.07, 1, 0.07, x, 0.5, z, wood);
        for (const y of [0.35, 0.7]) box(0.06, 0.07, 2, x, y, 0, wood);
      }
      break;
    case 'milking-stand':
      box(1.25, 0.25, 1.6, 0, 0.125, 0, wood);
      for (const x of [-0.5, 0.5]) box(0.06, 1.4, 0.06, x, 0.7, 0.7);
      break;
    case 'feed-trough':
      box(1.3, 0.25, 0.45, 0, 0.2, 0, wood);
      box(1.1, 0.02, 0.3, 0, 0.34, 0, '#7e914c');
      break;
    case 'hay-rack':
      rack();
      box(1.3, 0.5, 0.6, 0, 0.7, 0, '#b29b51');
      break;
    case 'pump-hall':
      for (const x of [-0.6, 0.6]) {
        box(0.5, 0.2, 0.8, x, 0.1);
        const pump = cyl(0.24, 0.7, x, 0.45);
        pump.rotation.x = Math.PI / 2;
      }
      break;
    case 'pipework':
      for (const x of [-0.5, 0.5]) {
        cyl(0.08, 1.8, x, 0.9);
        const pipe = cyl(0.08, 1, x, 0.4);
        pipe.rotation.z = Math.PI / 2;
      }
      break;
    case 'valves':
    case 'gauges':
      for (const x of [-0.4, 0, 0.4]) {
        const gauge = cyl(0.12, 0.05, x, 0.7, 0, name === 'valves' ? red : '#e6ddc2');
        gauge.rotation.x = Math.PI / 2;
        box(0.02, 0.15, 0.015, x, 0.7, 0.04, dark);
      }
      break;
    case 'screen':
      box(1, 0.06, 1.3, 0, 0.6).rotation.x = -0.3;
      for (const x of [-0.45, 0.45]) box(0.05, 0.65, 0.05, x, 0.3);
      break;
    case 'freight-train':
      for (const z of [-1.2, 0, 1.2]) {
        const p = prop('finished-pallet');
        p.position.z = z;
        group.add(p);
      }
      break;
    case 'shuttle':
      {
        const body = mesh(new T.ConeGeometry(0.75, 3.5, 8), '#c9cdc6', 0, 0.9);
        body.rotation.x = Math.PI / 2;
        box(3, 0.08, 1.2, 0, 0.5, 0, '#b5bfbd');
      }
      break;
    case 'engine-stand': {
      box(0.75, 0.07, 0.65);
      box(0.1, 0.9, 0.1, 0, 0.45);
      const engine = new T.Group();
      engine.name = 'radial-engine';
      group.add(engine);
      const crank = cyl(0.2, 0.28, 0, 1.15, 0, dark);
      crank.rotation.x = Math.PI / 2;
      engine.add(crank);
      for (let i = 0; i < 7; i++) {
        const angle = (i * Math.PI * 2) / 7;
        const head = cyl(
          0.09,
          0.3,
          Math.sin(angle) * 0.28,
          1.15 + Math.cos(angle) * 0.28,
          0,
          steel,
        );
        head.rotation.z = -angle;
        engine.add(head);
      }
      break;
    }
    case 'wall-propeller':
      box(0.14, 1.8, 0.06, 0, 1, 0, wood).rotation.z = 0.35;
      cyl(0.12, 0.1, 0, 1, 0.03).rotation.x = Math.PI / 2;
      break;
    case 'bunded-fuel':
      box(1.2, 0.1, 0.6, 0, 0.07, 0, dark);
      for (const x of [-0.35, 0, 0.35]) {
        box(0.25, 0.45, 0.35, x, 0.35, 0, '#7b884b');
        box(0.12, 0.045, 0.05, x, 0.62);
      }
      break;
    case 'windsock':
      box(0.03, 1.7, 0.03);
      mesh(new T.ConeGeometry(0.15, 0.65, 6), red, 0, 1.6, 0.3).rotation.x = Math.PI / 2;
      break;
  }
  batch(group);
  return group;
}
export function furnishInterior(rig: InteriorRig, b: Building, primary = true) {
  const v = rig.volume,
    model = buildingArchitecture(b.kind, b.architecture)?.name ?? '',
    kind = b.aircraftHangar ? 'hangar' : b.kind;
  let names = [...(equipment[kind] ?? ['workbench'])];
  if (/Machine shop/.test(model))
    names = ['lathe', 'drill-press', 'swarf-bin', 'workbench', 'oil-rack'];
  if (b.kind === 'garage' && primary)
    names.push(...Array(Math.max(0, rig.doors.length - 1)).fill('tool-chest'));
  if (b.kind === 'garage' && /Mechanic/.test(model)) names.push('pit-grate');
  if (b.kind === 'garage' && v.width >= 12) names.push('parts-store');
  if (b.kind === 'factory' && /offices/i.test(model)) names.push('office');
  if (b.kind === 'forge' && /Foundry|Furnace/.test(model)) names.push('power-hammer');
  if (b.kind === 'forge' && /pattern/i.test(model)) names.push('sand-floor');
  if (b.kind === 'sawmill' && /Band-saw/.test(model))
    names = names.map((n) => (n === 'saw' ? 'band-saw' : n));
  if (b.kind === 'starport' && b.architecture === 'model-5') names.push('shuttle');
  if (!primary)
    names =
      b.kind === 'sawmill'
        ? ['logs', 'lumber', 'hand-cart']
        : ['pallet-racks', 'sacks', 'workbench'];
  const placed: T.Group[] = [];
  for (const [i, name] of names.entries()) {
    if (
      [
        'tractor',
        'parked-biplane',
        'repair-biplane',
        'animals',
        'bales',
        'stored-boats',
        'hull-cradle',
      ].includes(name)
    )
      continue;
    const g = prop(name);
    g.userData.fixedInteriorProp = true;
    if (name === 'copper-kettles') {
      const steam = new T.Group();
      steam.name = 'kettle-steam';
      for (let j = 0; j < 3; j++) {
        const puff = new T.Mesh(
          new T.IcosahedronGeometry(0.12, 0),
          new T.MeshStandardMaterial({
            color: '#e2e9df',
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            roughness: 1,
          }),
        );
        puff.position.set(-0.6, 2.1 + j * 0.15, 0);
        steam.add(puff);
      }
      g.add(steam);
    }
    const bounds = new T.Box3().setFromObject(g, true),
      size = bounds.getSize(new T.Vector3());
    // Furniture keeps metre-scale dimensions; layouts vary with each real volume.
    const side = i % 2 ? 1 : -1,
      columns = Math.max(1, Math.floor((v.depth - 0.8) / 1.7));
    const x =
      i < 3 ? (i - 1) * Math.min(v.width / 4, 1.6) : side * (v.width / 2 - size.x / 2 - 0.28);
    const z =
      i < 3
        ? v.z - v.depth * 0.05
        : v.z -
          v.depth / 2 +
          0.45 +
          size.z / 2 +
          (Math.floor((i - 3) / 2) % columns) *
            Math.max(0.7, (v.depth - size.z - 1) / Math.max(1, columns - 1));
    g.position.set(
      T.MathUtils.clamp(
        v.x + x,
        v.x - v.width / 2 - bounds.min.x + 0.22,
        v.x + v.width / 2 - bounds.max.x - 0.22,
      ),
      0.28 - bounds.min.y,
      T.MathUtils.clamp(
        z,
        v.z - v.depth / 2 - bounds.min.z + 0.22,
        v.z + v.depth / 2 - bounds.max.z - 0.22,
      ),
    );
    if (name === 'lift') g.position.x = v.x;
    if (kind === 'sawmill' && ['log-carriage', 'saw', 'band-saw'].includes(name)) {
      g.position.x = v.x - Math.min(1.3, v.width / 4);
      g.position.z = v.z + (name === 'log-carriage' ? 1 : -1.1);
    }
    if (kind === 'starport' && i < 3) g.position.x = v.x + (i - 1) * Math.min(v.width / 3, 5);
    if (name === 'pens') {
      g.scale.z = 1.5;
      g.position.x = v.x;
      g.position.z = v.z;
    }
    if (
      [
        'pegboard',
        'spanners',
        'hammer-rack',
        'clamp-rail',
        'calendar',
        'gyle-board',
        'weather-board',
        'wall-propeller',
        'chisels',
        'drill-steels',
        'dust-duct',
      ].includes(name)
    ) {
      g.position.y += Math.min(1.1, Math.max(0, v.eaves - 0.18 - size.y - 0.28));
    }
    if (name === 'parts-store' && rig.doors[2]) {
      g.position.x = rig.doors[2].bay.x;
      g.position.z = v.z - v.depth / 2 + size.z / 2 + 0.3;
    }
    if (kind === 'garage' && ['workbench', 'bench-grinder', 'parts-washer'].includes(name)) {
      g.position.z = v.z - v.depth / 2 + 0.625;
      g.position.x = v.x + (name === 'bench-grinder' ? -1.5 : name === 'parts-washer' ? 1.5 : 0);
    }
    (i < 3 ? rig.principal : rig.detail).add(g);
    placed.push(g);
  }
  // Mutable stock indicators remain separate from fixed material batches.
  if (kind === 'warehouse' || kind === 'haybarn') {
    const goods = new T.Group();
    goods.userData.interiorProp = kind === 'warehouse' ? 'rack-stock' : 'bales';
    const hay = kind === 'haybarn';
    const levels = hay ? Math.floor((v.eaves - 0.5) / 0.6) : 3;
    for (let i = 0; i < levels * 3; i++) {
      const m = new T.Mesh(
        new T.BoxGeometry(hay ? 0.95 : 0.36, hay ? 0.58 : 0.34, hay ? 0.65 : 0.4),
        detailMaterial(hay ? 'hay' : 'siding', hay ? '#b2a063' : '#a78958', 0.02),
      );
      m.position.set(
        ((i % 3) - 1) * (hay ? 1 : 0.44),
        (hay ? 0.29 : 0.2) + Math.floor(i / 3) * (hay ? 0.6 : 0.65),
        0,
      );
      goods.add(m);
    }
    const rack = placed.find((g) => g.userData.interiorProp === 'pallet-racks');
    goods.position.copy(
      hay ? new T.Vector3(v.x, 0.28, v.z) : (rack?.position ?? new T.Vector3(v.x, 0.3, v.z)),
    );
    rig.principal.add(goods);
  }
  rig.group.userData.effects = [];
  rig.group.traverse((o) => {
    if (o.name === 'hearth-coals' || o.name === 'kettle-steam') rig.group.userData.effects.push(o);
  });
  rig.group.userData.propNames = names;
  rig.group.userData.furnished = true;
}
/** Populate expensive reused vehicles once, when the browser has its real texture canvas. */
export function populateInteriorModels(rig: InteriorRig, b: Building, w: World, me?: Player) {
  if (rig.group.userData.modelsReady) {
    refreshInteriorDisplay(rig, b, w, me);
    return;
  }
  rig.group.userData.modelsReady = true;
  const v = rig.volume,
    names = rig.group.userData.propNames as string[];
  const add = (g: T.Group, name: string, x: number, z: number, lift = 0) => {
    g.userData.interiorProp = name;
    g.name = name;
    g.userData.driver?.removeFromParent();
    g.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(g, true),
      size = bounds.getSize(new T.Vector3());
    const raised = Math.max(0, Math.min(lift, v.eaves - 0.18 - size.y - 0.28));
    g.position.set(v.x + x, 0.28 - bounds.min.y + raised, v.z + z);
    rig.principal.add(g);
    g.userData.interiorBounds = size.toArray();
    return g;
  };
  if (names.includes('tractor')) {
    const g = new T.Group(),
      slot = [0, 24, 25, 26][Math.floor(buildingDoorHash(b.id) * 4)];
    fleetTractor(
      g,
      slot,
      '#7b8a43',
      () => new T.Mesh(new T.PlaneGeometry(0, 0), new T.MeshBasicMaterial()),
    );
    add(g, 'tractor', 0, 0, b.kind === 'garage' ? 0.7 : 0);
    g.userData.vehicleSlot = slot;
    const lift = rig.principal.getObjectByName('lift');
    const arms = lift?.getObjectByName('lift-arms');
    if (lift && arms) {
      lift.position.z = g.position.z;
      rig.group.updateMatrixWorld(true);
      const vehicleBox = new T.Box3().setFromObject(g, true),
        armBox = new T.Box3().setFromObject(arms, true);
      arms.position.y += vehicleBox.min.y - armBox.max.y;
    }
  }
  if (names.includes('hull-cradle')) {
    const candidates = [MOTORBOAT, 3].filter(
      (slot) => (vehicleDef(w, slot).length ?? Infinity) < v.depth - 0.45,
    );
    let slot = candidates[Math.floor(buildingDoorHash(b.id) * candidates.length)] ?? MOTORBOAT;
    const build = () =>
      slot === 3 ? createCanalBoat('#76949a').group : createMotorboat('#76949a').group;
    let hull = build();
    hull.userData.driver?.removeFromParent();
    let bounds = new T.Box3().setFromObject(hull, true),
      size = bounds.getSize(new T.Vector3());
    // Some fittings project beyond the catalogue hull. Use the smaller real craft
    // when the full repair model cannot fit; never shrink a human-scale boat.
    if (slot === 3 && (size.z > v.depth - 0.45 || size.x + 1.3 > v.width - 0.45)) {
      hull.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      slot = MOTORBOAT;
      hull = build();
      hull.userData.driver?.removeFromParent();
      bounds = new T.Box3().setFromObject(hull, true);
      size = bounds.getSize(new T.Vector3());
    }
    hull.userData.marineLighting?.group?.removeFromParent();
    hull.position.set(0, 0.45 - bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
    const cradle = new T.Group();
    cradle.userData.repairHullSlot = slot;
    cradle.add(hull);
    const staging = new T.Group();
    staging.name = 'repair-staging';
    cradle.add(staging);
    const mat = new T.MeshStandardMaterial({ color: wood, roughness: 1 });
    const beam = (
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
    ) => {
      const m = new T.Mesh(new T.BoxGeometry(width, height, depth), mat);
      m.position.set(x, y, z);
      staging.add(m);
    };
    for (const z of [-size.z * 0.3, size.z * 0.3]) beam(0, 0.225, z, size.x * 0.85, 0.45, 0.22);
    for (const side of [-1, 1]) {
      const x = side * (size.x / 2 + 0.3);
      beam(x, 0.75, 0, 0.5, 0.1, size.z * 0.8);
      for (const z of [-size.z * 0.33, size.z * 0.33]) beam(x, 0.35, z, 0.08, 0.7, 0.08);
    }
    add(cradle, 'hull-cradle', -Math.min(v.width * 0.2, (v.width - size.x - 1.3) / 2), 0);
  }
  if (names.includes('parked-biplane'))
    for (const [i, name] of ['parked-biplane', 'repair-biplane'].entries()) {
      const g = createBiplane(
        i ? '#b1b5a2' : (tractorPaint(me ? vehiclePaint(me, 2) : undefined)?.color ?? '#e5c979'),
        i === 1,
      ).group;
      if (i) {
        const trestles = new T.Group();
        trestles.name = 'repair-trestles';
        const material = new T.MeshStandardMaterial({ color: wood, roughness: 0.9 });
        g.updateMatrixWorld(true);
        for (const z of [-1.2, 1.2]) {
          const contact = new T.Raycaster(
            new T.Vector3(0, 0, z),
            new T.Vector3(0, 1, 0),
          ).intersectObject(g, true)[0];
          const top = contact?.point.y ?? 1.2;
          const beam = new T.Mesh(new T.BoxGeometry(1.15, 0.12, 0.2), material);
          beam.position.set(0, top - 0.06, z);
          trestles.add(beam);
          for (const side of [-1, 1]) {
            const leg = new T.Mesh(new T.BoxGeometry(0.1, top - 0.12, 0.13), material);
            leg.position.set(side * 0.4, (top - 0.12) / 2, z);
            trestles.add(leg);
          }
        }
        g.add(trestles);
      }
      add(g, name, (i ? 1 : -1) * 4.8, i ? -1.5 : 1);
    }
  const animal =
    b.kind === 'dairy'
      ? 'cows'
      : b.kind === 'sheepfold'
        ? 'sheep'
        : b.kind === 'piggery'
          ? 'pigs'
          : undefined;
  if (animal) {
    const g = new T.Group();
    for (const part of interiorAnimal(animal)) {
      const m = new T.Mesh(
        part.geometry,
        new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      );
      m.position.copy(part.pivot);
      g.add(m);
    }
    add(g, 'animals', 0, 0);
    g.userData.stockAnimal = animal;
  }
  refreshInteriorDisplay(rig, b, w, me);
}
export function updateInteriorStock(rig: InteriorRig, b: Building) {
  const total = Object.values(b.stock).reduce((a, n) => a + Math.max(0, n), 0),
    fraction = total / Math.max(1, b.capacity),
    tier = total === 0 ? 0 : fraction < 0.25 ? 1 : fraction < 0.65 ? 2 : 3;
  for (const o of rig.principal.children) {
    if (o.userData.stockAnimal) o.visible = (b.stock[o.userData.stockAnimal] ?? 0) > 0;
    if (o.userData.interiorProp === 'rack-stock')
      o.children.forEach((c, i) => (c.visible = i < tier * 3));
    if (o.userData.interiorProp === 'bales')
      o.children.forEach(
        (c, i) =>
          (c.visible =
            i <
            Math.ceil(
              o.children.length *
                Math.min(1, Math.max(0, b.stock.hay ?? 0) / Math.max(1, b.capacity)),
            )),
      );
  }
  rig.group.userData.stockTier = tier;
}

/** Cheap local effects update only while a full-detail open interior is nearby. */
export function animateInteriorEffects(rig: InteriorRig, dt: number) {
  const time = (rig.group.userData.effectTime ?? 0) + dt;
  rig.group.userData.effectTime = time;
  for (const effect of (rig.group.userData.effects ?? []) as T.Object3D[]) {
    if (effect.name === 'hearth-coals')
      (effect as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>).material.emissiveIntensity =
        0.5 + 0.12 * Math.sin(time * 9) + 0.06 * Math.sin(time * 17);
    else
      effect.children.forEach((puff, i) => {
        const age = (time * 0.35 + i / 3) % 1;
        puff.position.y = 2.05 + age * 0.5;
        puff.scale.setScalar(0.6 + age * 0.7);
        (puff as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>).material.opacity =
          0.2 * Math.sin(age * Math.PI);
      });
  }
}

/** Refresh only changing displays; the shell and its animation rigs stay intact. */
export function refreshInteriorDisplay(rig: InteriorRig, b: Building, w: World, me?: Player) {
  const oldTractor = rig.principal.getObjectByName('tractor');
  if (b.kind === 'garage' && oldTractor) {
    const records = Object.entries(w.parkedVehicles ?? {}).filter(
      ([, v]) => v.inside === b.id && isTractor(v.slot),
    );
    const stored = records.find(([, v]) => v.owner === me?.id) ?? records[0];
    const slot = stored?.[1].slot ?? [0, 24, 25, 26][Math.floor(buildingDoorHash(b.id) * 4)];
    const key = JSON.stringify([stored?.[0], slot, stored?.[1].paint, w.vehicleTuning?.[slot]]);
    if (rig.group.userData.storedTractorKey !== key) {
      rig.group.userData.storedTractorKey = key;
      const g = new T.Group();
      fleetTractor(
        g,
        slot,
        tractorPaint(stored?.[1].paint)?.color ?? (stored ? vehicleDef(w, slot).color : '#7b8a43'),
        () => new T.Mesh(new T.PlaneGeometry(0, 0), new T.MeshBasicMaterial()),
      );
      configureVehicleVisual(g, w, slot);
      g.userData.driver?.removeFromParent();
      g.name = 'tractor';
      g.userData.interiorProp = 'tractor';
      g.userData.vehicleSlot = slot;
      g.userData.parkedVehicle = stored?.[0];
      g.position.copy(oldTractor.position);
      const oldBox = new T.Box3().setFromObject(oldTractor, true),
        newBox = new T.Box3().setFromObject(g, true);
      g.position.y += oldBox.min.y - newBox.min.y;
      oldTractor.traverse((o) => {
        if (o instanceof T.Mesh) {
          if (!o.geometry.userData.shared) o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (!m.userData.shared) m.dispose();
        }
      });
      oldTractor.removeFromParent();
      rig.principal.add(g);
    }
  }
  const parked = rig.principal.getObjectByName('parked-biplane');
  if (parked)
    for (const material of (parked.userData.airframePaint ?? []) as T.MeshStandardMaterial[])
      material.color.set(tractorPaint(me ? vehiclePaint(me, 2) : undefined)?.color ?? '#e5c979');
  if (!(rig.group.userData.propNames as string[] | undefined)?.includes('stored-boats')) return;
  const v = rig.volume,
    threshold = buildingPlan(b).volumes[0].depth / 2;
  const boats = (b.storedBoats ?? storedBoatDisplay(w, b)).filter(
    (boat) =>
      (vehicleDef(w, boat.slot).length ?? 0) > threshold === !!rig.group.userData.waterSideStorage,
  );
  const key = JSON.stringify(
    boats.map((boat) => [boat, vehicleDef(w, boat.slot).length, vehicleDef(w, boat.slot).beam]),
  );
  if (key === rig.group.userData.storedKey) return;
  rig.group.userData.storedKey = key;
  let holder = rig.principal.getObjectByName('stored-boats') as T.Group | undefined;
  if (!holder) {
    holder = new T.Group();
    holder.name = 'stored-boats';
    holder.userData.interiorProp = 'stored-boats';
    rig.principal.add(holder);
  }
  holder.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
  holder.clear();
  let nextZ = v.z - v.depth / 2 + 0.3;
  for (const boat of boats) {
    const def = vehicleDef(w, boat.slot),
      length = def.length ?? 0,
      beam = def.beam ?? 0;
    if (
      !length ||
      !beam ||
      length > v.depth - 0.6 ||
      beam + 1 > v.width * 0.45 ||
      nextZ + length > v.z + v.depth / 2 - 0.3
    )
      continue;
    const g = yardBoat({
      name: def.name,
      kind: boat.slot === 3 ? 'canal' : boat.slot === MOTORBOAT ? 'sport' : 'work',
      length,
      beam,
      color: tractorPaint(boat.paint)?.color ?? def.color,
      cabin: boat.slot === 3 ? 1.8 : 0,
    });
    const q = new T.Box3().setFromObject(g, true);
    if (q.max.y - q.min.y > v.eaves - 0.5) {
      g.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.geometry.dispose();
          (o.material as T.Material).dispose();
        }
      });
      continue;
    }
    g.position.set(v.x + v.width / 2 - beam / 2 - 0.85, 0.28 - q.min.y, nextZ + length / 2);
    g.userData.storedBoat = boat;
    holder.add(g);
    nextZ += length + 0.3;
  }
}

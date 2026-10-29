// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { createCharterWheelhouse } from './charter-wheelhouse';
import { createFishingLights, type MarineLightLayout } from './fishing-lights';
const lightLayout: MarineLightLayout = {
  deck: [new T.Vector3(-1.2, 3.2, 0.35), new T.Vector3(1.2, 3.2, 0.35)],
  targets: [new T.Vector3(-1, 1.05, -3.3), new T.Vector3(1, 1.05, -3.3)],
  cabin: new T.Vector3(0, 3.08, 3.4),
  cabinTarget: new T.Vector3(0, 1.8, 3.6),
  deckPower: 32,
  cabinPower: 5,
  specs: [
    ['port', '#ff3020', 1.6, 3.3, 3.8],
    ['starboard', '#1cff68', -1.6, 3.3, 3.8],
    ['stern', '#fff4d2', 0, 2, -6.45],
    ['masthead', '#fff4d2', 0, 4.8, 2.9],
    ['trawlWhite', '#fff4d2', 0, 5, 2.9],
  ],
};
let deckMap: T.CanvasTexture, nameMap: T.CanvasTexture, glassMap: T.CanvasTexture;
function textures() {
  if (!deckMap) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#d4cab0';
    c.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 8)
      for (let x = 0; x < 512; x += 8) {
        c.fillStyle = (x + y) % 16 ? '#b6ad95' : '#eee7d1';
        c.fillRect(x, y, 2, 2);
      }
    for (let x = 0; x < 512; x += 128) {
      c.fillStyle = '#a69b82';
      c.fillRect(x, 0, 2, 512);
    }
    deckMap = new T.CanvasTexture(canvas);
    deckMap.wrapS = deckMap.wrapT = T.RepeatWrapping;
    deckMap.repeat.set(2, 5);
    const name = document.createElement('canvas');
    name.width = 1024;
    name.height = 256;
    const n = name.getContext('2d')!;
    n.clearRect(0, 0, 1024, 256);
    n.fillStyle = '#173c4c';
    n.font = 'bold 86px Georgia';
    n.textAlign = 'center';
    n.fillText('COASTAL BELLE', 512, 116);
    n.font = '30px sans-serif';
    n.fillText('CHARTER FISHING  •  SIX GUESTS', 512, 183);
    nameMap = new T.CanvasTexture(name);
    const g = document.createElement('canvas');
    g.width = g.height = 4;
    const gc = g.getContext('2d')!;
    gc.fillStyle = '#fff';
    gc.fillRect(0, 0, 4, 4);
    glassMap = new T.CanvasTexture(g);
    for (const t of [deckMap, nameMap, glassMap]) {
      t.colorSpace = T.SRGBColorSpace;
      t.userData.shared = true;
    }
  }
}
/** A flared semi-displacement hull, open aft working deck and human-scale enclosed helm. */
export function createCharterBoat(color = '#326f85') {
  textures();
  const group = new T.Group(),
    fixed = new T.Group();
  group.name = 'Coastal Belle charter boat';
  group.add(fixed);
  const white = new T.MeshStandardMaterial({ color: '#f2eee0', roughness: 0.55 });
  const paint = new T.MeshStandardMaterial({ color, roughness: 0.48 });
  const dark = new T.MeshStandardMaterial({ color: '#1d3038', roughness: 0.65 });
  const metal = new T.MeshStandardMaterial({ color: '#a4afb1', metalness: 0.65, roughness: 0.36 });
  const cushion = new T.MeshStandardMaterial({ color: '#8aa4a8', roughness: 0.9 });
  const wood = new T.MeshStandardMaterial({ color: '#a77a49', roughness: 0.75 });
  const deck = new T.MeshStandardMaterial({ map: deckMap, roughness: 0.96 });
  const glass = new T.MeshStandardMaterial({
    color: '#8fb8bf',
    transparent: true,
    opacity: 0.25,
    roughness: 0.17,
    metalness: 0.08,
    side: T.DoubleSide,
    depthWrite: false,
    emissiveMap: glassMap,
  });
  function mesh(g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = fixed) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) =>
    mesh(new T.BoxGeometry(w, h, d), m, x, y, z);
  function rod(a: number[], b: number[], r = 0.035, m: T.Material = metal) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const o = mesh(new T.CylinderGeometry(r, r, delta.length(), 6), m);
    o.position.copy(start.add(end).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return o;
  }
  const sections = [
    [-6.5, 1.95],
    [-5, 2.35],
    [-3, 2.5],
    [0, 2.5],
    [3, 2.2],
    [5, 1.65],
    [6.5, 0.85],
    [7.5, 0.035],
  ];
  // Flat transom, soft chines, high flared bow; no scaled human or borrowed canal hull.
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [z, width] of sections) {
    const sheer = Math.max(0, z - 3) * 0.055;
    for (const [x, y] of [
      [-width, 1.08 + sheer],
      [-width * 0.86, -0.18],
      [-width * 0.45, -1.05],
      [width * 0.45, -1.05],
      [width * 0.86, -0.18],
      [width, 1.08 + sheer],
    ])
      vertices.push(x, y, z);
  }
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 5; j++) {
      const a = i * 6 + j,
        b = a + 6;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  for (const i of [0, sections.length - 1])
    for (let j = 1; j < 5; j++) {
      const a = i * 6;
      if (i === 0) indices.push(a, a + j, a + j + 1);
      else indices.push(a, a + j + 1, a + j);
    }
  const hull = new T.BufferGeometry();
  hull.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  hull.setAttribute(
    'uv',
    new T.Float32BufferAttribute(new Float32Array((vertices.length / 3) * 2), 2),
  );
  for (let i = 0; i < indices.length; i += 3)
    [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  hull.setIndex(indices);
  hull.computeVertexNormals();
  mesh(hull, white);
  const outline = [
    ...sections.map(([z, w]) => new T.Vector2(-w, z)),
    ...sections
      .slice()
      .reverse()
      .map(([z, w]) => new T.Vector2(w, z)),
  ];
  const shape = new T.Shape(outline),
    deckGeom = new T.ShapeGeometry(shape);
  deckGeom.rotateX(Math.PI / 2); // local Y maps to Z
  mesh(deckGeom, deck, 0, 1.05, 0).material.side = T.DoubleSide;
  // Continuous rub rails follow the actual sheer, with painted side panels below them.
  for (const side of [-1, 1]) {
    for (let i = 0; i < sections.length - 1; i++) {
      const [z, w] = sections[i],
        [z2, w2] = sections[i + 1];
      rod(
        [side * w, 1.12 + Math.max(0, z - 3) * 0.055, z],
        [side * w2, 1.12 + Math.max(0, z2 - 3) * 0.055, z2],
        0.07,
        dark,
      );
      rod(
        [side * w, 0.79 + Math.max(0, z - 3) * 0.055, z],
        [side * w2, 0.79 + Math.max(0, z2 - 3) * 0.055, z2],
        0.14,
        paint,
      );
    }
    // Six fishing stations: knee-height bulwark with continuous stainless safety rails.
    for (const z of [-6.2, -4.5, -2.6, -0.7])
      rod([side * 2.23, 1.08, z], [side * 2.23, 2.05, z], 0.035);
    rod([side * 2.23, 2.05, -6.2], [side * 2.23, 2.05, -0.7]);
    rod([side * 2.23, 1.57, -6.2], [side * 2.23, 1.57, -0.7], 0.025);
    for (const z of [-4.2, -2.5, -0.8]) {
      rod([side * 2.2, 1.6, z], [side * 2.32, 2.12, z + 0.12], 0.055, white);
      // Stowed rods sit forward, not in the standing passengers' faces.
    }
    for (const z of [-4.8, 0, 3.8]) {
      rod(
        [side * (z > 2 ? 2.02 : 2.5), 1.16, z],
        [side * (z > 2 ? 2.02 : 2.5), 0.45, z],
        0.015,
        wood,
      );
      mesh(new T.CapsuleGeometry(0.14, 0.55, 3, 8), white, side * (z > 2 ? 2.05 : 2.52), 0.25, z);
    }
    for (const z of [1.3, 1.6, 1.9]) {
      rod([side * 1.7, 1.3, z], [side * 1.75, 3.6, z + 0.2], 0.013, dark);
      rod([side * 1.7, 1.3, z], [side * 1.71, 1.8, z + 0.05], 0.03, wood);
    }
    // Forward companion benches leave the aft fishing deck open.
    box(0.5, 0.38, 1.45, white, side * 1.05, 1.27, 0.85);
    box(0.53, 0.08, 1.48, cushion, side * 1.05, 1.5, 0.85);
    box(0.08, 0.4, 1.48, cushion, side * 1.32, 1.71, 0.85);
  }
  rod([-2.23, 2.05, -6.2], [2.23, 2.05, -6.2]);
  // Bait station and iced fish locker at the transom, with a clear walk-through deck.
  box(1.5, 0.62, 0.8, white, 0, 1.36, -5.55);
  box(1.55, 0.08, 0.85, wood, 0, 1.71, -5.55);
  box(0.65, 0.015, 0.38, metal, 0.35, 1.76, -5.5);
  rod([0.55, 1.75, -5.7], [0.55, 2, -5.7], 0.025);
  rod([0.55, 2, -5.7], [0.35, 2, -5.7], 0.025);
  box(1.25, 0.03, 0.72, dark, 0, 1.08, -2.9);
  box(1.17, 0.025, 0.64, white, 0, 1.1, -2.9);
  // Cabin shell uses real window openings so the helm has an unobstructed view.
  for (const side of [-1, 1]) box(0.08, 0.68, 4.55, white, side * 1.5, 1.39, 2.45);
  for (const z of [0.2, 4.72]) box(3.05, 0.68, 0.08, white, 0, 1.39, z);
  // Remove solid upper cabin/deck overlap: lower box only, windows above the sill.
  for (const side of [-1, 1]) {
    for (const z of [0.2, 1.7, 3.2, 4.72]) box(0.075, 1.43, 0.075, white, side * 1.52, 2.44, z);
    box(0.08, 0.12, 4.6, paint, side * 1.52, 3.12, 2.45);
    for (const z of [0.95, 2.45, 3.96]) {
      const win = mesh(new T.PlaneGeometry(1.4, 1.27), glass, side * 1.528, 2.44, z, group);
      win.rotation.y = (side * Math.PI) / 2;
    }
    const label = mesh(
      new T.PlaneGeometry(2.5, 0.62),
      new T.MeshStandardMaterial({ map: nameMap, transparent: true, depthWrite: false }),
      side * 1.55,
      1.41,
      2.5,
    );
    label.rotation.y = (side * Math.PI) / 2;
  }
  for (const x of [-1.52, 0, 1.52]) box(0.075, 1.43, 0.075, white, x, 2.44, 4.72);
  for (const x of [-0.76, 0.76]) mesh(new T.PlaneGeometry(1.4, 1.27), glass, x, 2.44, 4.725, group);
  box(3.32, 0.16, 4.85, paint, 0, 3.25, 2.45);
  box(3.15, 0.045, 4.7, white, 0, 3.35, 2.45);
  // Aft bulkhead around the glazed companionway.
  for (const x of [-1.1, 1.1]) box(0.83, 1.43, 0.08, white, x, 2.44, 0.2);
  box(0.82, 0.18, 0.09, white, 0, 3.06, 0.2);
  box(0.76, 1.78, 0.055, wood, 0, 1.96, 0.19);
  mesh(new T.PlaneGeometry(0.56, 0.7), glass, 0, 2.43, 0.155, group).rotation.y = Math.PI;
  box(0.12, 0.035, 0.05, metal, 0.24, 1.85, 0.14);
  const orange = new T.MeshStandardMaterial({ color: '#e78439', roughness: 0.7 });
  for (const x of [-1.1, 1.1])
    mesh(new T.TorusGeometry(0.29, 0.075, 6, 20), orange, x, 2.3, 0.11).rotation.y = Math.PI;
  // Liferaft, radar, antennas and a single mast: proper powered-vessel lights, no trawl signals.
  mesh(new T.CapsuleGeometry(0.36, 0.85, 4, 12), white, -0.6, 3.72, 1.2).rotation.z = Math.PI / 2;
  for (const x of [-1.05, -0.15]) rod([x, 3.35, 0.8], [x, 3.9, 1.6], 0.027, dark);
  box(0.65, 0.13, 0.55, white, 0.65, 3.46, 2);
  box(1, 0.12, 0.23, white, 0.65, 3.62, 2);
  rod([0, 3.35, 2.9], [0, 5, 2.9], 0.045, white);
  for (const x of [-1.2, 1.2]) rod([x, 3.35, 1.9], [x, 5.15, 1.65], 0.018, white);
  // Bow pulpit, cleats and anchor roller.
  for (const side of [-1, 1]) {
    rod([side * 1.6, 1.2, 5], [side * 1.6, 2.08, 5]);
    rod([side * 1.6, 2.08, 5], [side * 0.2, 2.35, 7.1]);
    rod([side * 0.2, 1.3, 7.1], [side * 0.2, 2.35, 7.1]);
  }
  rod([-0.2, 2.35, 7.1], [0.2, 2.35, 7.1]);
  box(0.23, 0.12, 0.65, metal, 0, 1.28, 7.2);
  rod([0, 1.32, 7.3], [0, 0.45, 7.35], 0.045, dark);
  rod([-0.35, 0.6, 7.35], [0.35, 0.6, 7.35], 0.04, dark);
  for (const z of [-5.6, 5])
    for (const side of [-1, 1]) {
      const x = side * (z > 0 ? 1.25 : 1.75);
      rod([x, 1.08, z], [x, 1.3, z], 0.04);
      rod([x - 0.16, 1.3, z], [x + 0.16, 1.3, z], 0.04);
    }
  const cockpit = createCharterWheelhouse();
  cockpit.group.position.y = 0.21;
  group.add(cockpit.group);
  const driver = createHuman('seated').group;
  driver.position.set(0.48, 1.05, 2.5);
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0.48, 2.43, 2.5);
  group.userData.viewPitch = -0.19;
  group.userData.lamp = new T.Vector3(0, 3.4, 4.9);
  const lighting = createFishingLights(glass, cockpit.cabinLightMaterial, lightLayout);
  group.add(lighting.group);
  group.userData.marineLighting = lighting;
  batch(fixed);
  return { group, cockpit, lighting, animate: (turn: number) => cockpit.animate(turn) };
}

// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { createCharterWheelhouse } from './charter-wheelhouse';
import { createFishingLights, type MarineLightLayout } from './fishing-lights';
/** Compact twin-screw coastal tug, 16.8 × 5.94 m; metre-scale helm and fittings. */
export function createTugboat(color = '#b94d34') {
  const group = new T.Group(),
    fixed = new T.Group();
  group.name = 'Breakwater coastal tug';
  group.add(fixed);
  const mat = (color: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.65 });
  const steel = mat('#202e32', 0.35),
    paint = mat(color, 0.2),
    cream = mat('#e4dfcd'),
    rubber = mat('#151b1d'),
    brass = mat('#a39255', 0.6),
    deck = mat('#536a5d');
  const glass = new T.MeshStandardMaterial({
    color: '#93bbc4',
    transparent: true,
    opacity: 0.23,
    roughness: 0.2,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const add = (g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = fixed) => {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), m, x, y, z);
  const rod = (a: number[], b: number[], r = 0.04, m: T.Material = steel) => {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      v = B.clone().sub(A);
    const o = add(new T.CylinderGeometry(r, r, v.length(), 8), m);
    o.position.copy(A.add(B).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    return o;
  };
  // Round shoulders and spoon bow, flared topsides above a red antifouling bottom.
  const sections = [
    [-8.4, 1.7],
    [-7.4, 2.5],
    [-5.5, 2.92],
    [-2, 2.97],
    [2.8, 2.85],
    [5.8, 2.3],
    [7.5, 1.2],
    [8.4, 0.05],
  ];
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [z, w] of sections)
    for (const [x, y] of [
      [-w, 1.25],
      [-w * 0.95, 0.15],
      [-w * 0.72, -1.1],
      [-w * 0.35, -1.85],
      [w * 0.35, -1.85],
      [w * 0.72, -1.1],
      [w * 0.95, 0.15],
      [w, 1.25],
    ])
      vertices.push(x, y + Math.max(0, z - 4) * 0.07, z);
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 7; j++) {
      const a = i * 8 + j,
        b = a + 8;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  for (const i of [0, sections.length - 1])
    for (let k = 1; k < 7; k++) indices.push(i * 8, i * 8 + k, i * 8 + k + 1);
  const hull = new T.BufferGeometry();
  hull.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  hull.setIndex(indices);
  hull.computeVertexNormals();
  const hullMat = steel.clone();
  hullMat.side = T.DoubleSide;
  add(hull, hullMat);
  const outline = new T.Shape();
  outline.moveTo(-sections[0][1], sections[0][0]);
  for (const [z, w] of sections) outline.lineTo(-w, z);
  for (const [z, w] of [...sections].reverse()) outline.lineTo(w, z);
  outline.closePath();
  const deckGeo = new T.ShapeGeometry(outline);
  deckGeo.rotateX(Math.PI / 2);
  const deckIndex = deckGeo.getIndex()!;
  for (let i = 0; i < deckIndex.count; i += 3) {
    const b = deckIndex.getX(i + 1);
    deckIndex.setX(i + 1, deckIndex.getX(i + 2));
    deckIndex.setX(i + 2, b);
  }
  deckGeo.computeVertexNormals();
  add(deckGeo, deck, 0, 1.27, 0);
  // Heavy continuous fender rail, individual tyres and hull rubbing strips.
  for (const side of [-1, 1]) {
    for (let i = 0; i < sections.length - 1; i++) {
      const [z, w] = sections[i],
        [nz, nw] = sections[i + 1];
      rod([side * w, 1.2, z], [side * nw, 1.2, nz], 0.17, rubber);
      rod([side * w, 0.25, z], [side * nw, 0.25, nz], 0.055, paint);
    }
    for (const z of [-6.6, -4.2, -1.6, 1.1, 4.4]) {
      const tire = add(new T.TorusGeometry(0.38, 0.13, 8, 16), rubber, side * 2.91, 0.72, z);
      tire.rotation.y = Math.PI / 2;
      rod([side * 2.78, 1.5, z], [side * 2.94, 1.05, z], 0.025, brass);
    }
    for (const z of [-6, -3.8, 0, 5.8]) {
      box(0.65, 0.09, 0.5, steel, side * 2.2, 1.34, z);
      for (const dx of [-0.2, 0.2]) {
        add(new T.CylinderGeometry(0.09, 0.09, 0.4, 8), steel, side * 2.2 + dx, 1.56, z);
        box(0.25, 0.07, 0.17, steel, side * 2.2 + dx, 1.76, z);
      }
    }
  }
  // Raised wheelhouse forward leaves a clear aft towing deck. Windows are real openings.
  box(3.35, 0.08, 4.4, paint, 0, 1.31, 2.5);
  for (const side of [-1, 1]) box(0.09, 1, 3.3, cream, side * 1.63, 1.8, 3.2);
  for (const z of [1.55, 4.85]) box(3.35, 1, 0.09, cream, 0, 1.8, z);
  box(3.6, 0.18, 3.65, paint, 0, 3.72, 3.2);
  box(3.35, 0.15, 3.3, cream, 0, 3.52, 3.2);
  for (const side of [-1, 1]) {
    for (const z of [1.55, 2.7, 3.8, 4.85]) box(0.09, 1.2, 0.09, cream, side * 1.63, 2.9, z);
    box(0.03, 1.13, 3.1, glass, side * 1.64, 2.91, 3.2);
    box(0.12, 0.12, 3.3, cream, side * 1.65, 2.3, 3.2);
    for (const z of [1.8, 2.2, 2.6]) {
      box(0.42, 0.12, 0.26, steel, side * 1.94, 1.33 + (z - 1.8) * 0.5, z);
    }
    rod([side * 2.3, 1.4, 1.6], [side * 2.3, 2.3, 2.9], 0.035, cream);
    for (const z of [-6.5, -5, -3.5, -2])
      rod([side * 2.65, 1.3, z], [side * 2.65, 2.2, z], 0.035, cream);
    rod([side * 2.65, 2.2, -6.5], [side * 2.65, 2.2, -2], 0.035, cream);
    const ring = add(
      new T.TorusGeometry(0.28, 0.065, 8, 20),
      mat('#ef6e29'),
      side * 1.75,
      2.1,
      1.4,
    );
    ring.rotation.y = Math.PI / 2;
  }
  for (const z of [1.55, 4.85]) {
    for (const x of [-0.55, 0.55]) box(0.07, 1.2, 0.08, cream, x, 2.9, z);
    box(3.2, 1.13, 0.025, glass, 0, 2.91, z);
  }
  // Twin funnels, ventilation grilles, mast, radar and antennae.
  for (const x of [-1.15, 1.15]) {
    box(0.48, 2.1, 0.62, paint, x, 2.55, 0.3);
    box(0.52, 0.25, 0.67, steel, x, 3.65, 0.3);
    for (let y = 2; y < 3.5; y += 0.16) box(0.51, 0.045, 0.06, steel, x, y, -0.03);
  }
  rod([0, 3.8, 2.9], [0, 6.8, 2.9], 0.075, cream);
  rod([-1, 5.4, 2.9], [1, 5.4, 2.9], 0.045, cream);
  box(1.4, 0.1, 0.18, cream, 0, 6.15, 2.9);
  rod([-0.7, 3.9, 3.6], [-0.7, 6.2, 3.6], 0.016, steel);
  rod([0.7, 3.9, 3.6], [0.7, 5.9, 3.6], 0.016, steel);
  // Working towing drum, towing pins and curved stern fairlead; no fishing gantry.
  box(2.5, 0.45, 1.4, paint, 0, 1.5, -2.7);
  const winch = new T.Group();
  winch.position.set(0, 2, -2.7);
  group.add(winch);
  for (const x of [-0.9, 0.9]) {
    const end = add(new T.CylinderGeometry(0.57, 0.57, 0.12, 16), steel, x, 0, 0, winch);
    end.rotation.z = Math.PI / 2;
  }
  const cable = add(new T.CylinderGeometry(0.43, 0.43, 1.7, 20), brass, 0, 0, 0, winch);
  cable.rotation.z = Math.PI / 2;
  for (let x = -0.8; x < 0.85; x += 0.08) {
    const coil = add(new T.TorusGeometry(0.44, 0.018, 5, 16), steel, x, 0, 0, winch);
    coil.rotation.y = Math.PI / 2;
  }
  for (const x of [-0.65, 0.65])
    add(new T.CylinderGeometry(0.14, 0.18, 0.8, 10), steel, x, 1.75, -6.4);
  rod([-1.9, 1.4, -6.7], [-1.4, 2.25, -5.9], 0.09, steel);
  rod([1.9, 1.4, -6.7], [1.4, 2.25, -5.9], 0.09, steel);
  rod([-1.4, 2.25, -5.9], [1.4, 2.25, -5.9], 0.09, steel);
  for (const z of [-4.2, -5.1]) {
    box(1.1, 0.12, 0.65, steel, 0, 1.36, z);
    for (const x of [-0.4, 0.4]) box(0.14, 0.06, 0.08, brass, x, 1.46, z);
  }
  // Bow push knees and deck anchor windlass.
  for (const x of [-0.6, 0.6]) box(0.32, 1.1, 0.5, rubber, x, 1.55, 7.7);
  add(new T.CylinderGeometry(0.28, 0.35, 0.48, 12), steel, 0, 1.55, 6.4);
  const cockpit = createCharterWheelhouse('BREAKWATER / COASTAL TOWING', 512);
  cockpit.group.position.set(0, 0.45, 0);
  group.add(cockpit.group);
  const driver = createHuman('seated').group;
  driver.position.set(0.48, 1.5, 2.5);
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0.48, 2.88, 2.5);
  group.userData.viewPitch = -0.1;
  group.userData.lamp = new T.Vector3(0, 3.85, 4.9);
  const layout: MarineLightLayout = {
    deck: [new T.Vector3(-1.3, 3.6, 1.5), new T.Vector3(1.3, 3.6, 1.5)],
    targets: [new T.Vector3(-1, 1.3, -5), new T.Vector3(1, 1.3, -5)],
    cabin: new T.Vector3(0, 3.36, 3.4),
    cabinTarget: new T.Vector3(0, 2, 3.4),
    deckPower: 28,
    cabinPower: 5,
    specs: [
      ['port', '#ff3020', 1.7, 3.9, 3.8],
      ['starboard', '#1cff68', -1.7, 3.9, 3.8],
      ['masthead', '#fff4d2', 0, 6, 2.9],
      ['towWhite', '#fff4d2', 0, 5.2, 2.9],
      ['towYellow', '#ffcf40', 0, 2.9, -7.3],
      ['stern', '#fff4d2', 0, 2.3, -7.3],
      ['trawlWhite', '#fff4d2', 0, 6.6, 2.9],
    ],
  };
  const lighting = createFishingLights(cream, cockpit.cabinLightMaterial, layout);
  group.add(lighting.group);
  group.userData.marineLighting = lighting;
  batch(fixed);
  batch(winch);
  return {
    group,
    cockpit,
    lighting,
    animate(turn: number) {
      cockpit.animate(turn);
    },
  };
}

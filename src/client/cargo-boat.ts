// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { VehicleDef } from '../shared/types';
import { batch } from './tractor';
import { createHuman } from './human';
import { createCharterWheelhouse } from './charter-wheelhouse';
import { createFishingLights, type MarineLightLayout } from './fishing-lights';

/** Metre-scale coastal freighter; the authored hull dimensions do not scale the human helm. */
export function createCargoBoat(color: string, vessel: VehicleDef) {
  const group = new T.Group(),
    fixed = new T.Group(),
    cargo = new T.Group();
  group.name = vessel.name;
  group.add(fixed, cargo);
  const length = vessel.length!,
    beam = vessel.beam!,
    aft = -length / 2 + 3;
  const mat = (color: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.75 });
  const paint = mat(color, 0.3),
    steel = mat('#26383b', 0.4),
    deck = mat('#747c70'),
    cream = mat('#e3dfcb'),
    timber = mat('#977045'),
    rubber = mat('#202327');
  function box(
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    parent = fixed,
  ) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function rod(a: number[], b: number[], r = 0.035, m: T.Material = cream) {
    const A = new T.Vector3(...a),
      B = new T.Vector3(...b),
      v = B.clone().sub(A);
    const o = new T.Mesh(new T.CylinderGeometry(r, r, v.length(), 6), m);
    o.position.copy(A.add(B).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    fixed.add(o);
  }
  const sections = [
    [-0.5, 0.34],
    [-0.43, 0.48],
    [-0.25, 0.5],
    [0.23, 0.5],
    [0.38, 0.4],
    [0.48, 0.15],
    [0.5, 0.015],
  ].map(([z, w]) => [z * length, w * beam]);
  const vertices: number[] = [],
    indices: number[] = [];
  for (const [z, w] of sections)
    for (const [x, y] of [
      [-w, 1.2],
      [-w * 0.93, -0.1],
      [-w * 0.7, -1.25],
      [w * 0.7, -1.25],
      [w * 0.93, -0.1],
      [w, 1.2],
    ])
      vertices.push(x, y, z);
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 5; j++) {
      const a = i * 6 + j,
        b = a + 6;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  for (const i of [0, sections.length - 1])
    for (let j = 1; j < 5; j++) indices.push(i * 6, i * 6 + j, i * 6 + j + 1);
  const hull = new T.BufferGeometry();
  hull.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  hull.setIndex(indices);
  hull.computeVertexNormals();
  const hullMat = paint.clone();
  hullMat.side = T.DoubleSide;
  fixed.add(new T.Mesh(hull, hullMat));
  // The central hold remains open: a low floor with side walkways and a deep coaming.
  box(beam * 0.7, 0.15, length * 0.48, steel, 0, 0.3, 0);
  for (const side of [-1, 1]) {
    box(beam * 0.13, 0.16, length * 0.65, deck, side * beam * 0.42, 1.22, -length * 0.03);
    box(0.12, 0.9, length * 0.5, paint, side * beam * 0.35, 0.83, 0);
    for (let z = -length * 0.38; z <= length * 0.35; z += 1.8)
      rod([side * beam * 0.47, 1.25, z], [side * beam * 0.47, 2.15, z]);
    rod([side * beam * 0.47, 2.15, -length * 0.38], [side * beam * 0.47, 2.15, length * 0.35]);
    for (const z of [-length * 0.35, 0, length * 0.28]) {
      const tire = new T.Mesh(new T.TorusGeometry(0.31, 0.1, 6, 12), rubber);
      tire.position.set(side * beam * 0.5, 0.75, z);
      tire.rotation.y = Math.PI / 2;
      fixed.add(tire);
      rod([side * beam * 0.46, 1.35, z], [side * beam * 0.51, 1, z], 0.025, steel);
      for (const dz of [-0.2, 0.2]) {
        rod([side * beam * 0.39, 1.25, z + dz], [side * beam * 0.39, 1.65, z + dz], 0.08, steel);
        box(0.3, 0.06, 0.15, steel, side * beam * 0.39, 1.67, z + dz);
      }
    }
  }
  for (const z of [-length * 0.25, length * 0.25]) box(beam * 0.7, 0.9, 0.14, paint, 0, 0.83, z);
  box(beam * 0.8, 0.15, 4, deck, 0, 1.22, aft);
  box(beam * 0.55, 0.15, length * 0.13, deck, 0, 1.22, length * 0.33);
  // Aft wheelhouse has open window framing, clear sight over the hold and a real-sized door.
  const glass = new T.MeshStandardMaterial({
    color: '#aac8ce',
    transparent: true,
    opacity: 0.16,
    roughness: 0.25,
    depthWrite: false,
    side: T.DoubleSide,
  });
  for (const side of [-1, 1]) {
    box(0.1, 0.7, 2.7, cream, side * 1.4, 1.62, aft);
    for (const z of [aft - 1.35, aft, aft + 1.35]) box(0.08, 1.4, 0.08, cream, side * 1.4, 2.65, z);
    box(0.03, 1.35, 2.6, glass, side * 1.4, 2.65, aft);
  }
  for (const z of [aft - 1.35, aft + 1.35]) {
    box(2.8, 0.7, 0.1, cream, 0, 1.62, z);
    box(2.7, 1.35, 0.025, glass, 0, 2.65, z);
    for (const x of [-0.46, 0.46]) box(0.07, 1.4, 0.08, cream, x, 2.65, z);
  }
  box(3.05, 0.16, 3, paint, 0, 3.4, aft);
  box(0.45, 1.8, 0.5, steel, -1.65, 2.2, aft - 0.8);
  rod([0, 3.5, aft], [0, 5.9, aft], 0.065);
  rod([-0.6, 5.2, aft], [0.6, 5.2, aft]);
  box(1.15, 0.1, 0.18, cream, 0, 5.6, aft);
  const cockpit = createCharterWheelhouse('COASTER / COASTAL FREIGHT', vessel.tank);
  cockpit.group.position.set(0, 0.4, aft - 3.4);
  group.add(cockpit.group);
  const driver = createHuman('seated').group;
  driver.position.set(0.48, 1.45, aft - 0.9);
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0.48, 2.83, aft - 0.9);
  group.userData.viewPitch = -0.08;
  group.userData.lamp = new T.Vector3(0, 3.5, aft + 1.4);
  // Individual pallet loads appear progressively; empty holds remain visibly empty.
  for (let row = 0; row < 5; row++)
    for (const side of [-1, 1]) {
      const load = new T.Group();
      cargo.add(load);
      const z = (row - 2) * length * 0.085,
        x = side * beam * 0.17;
      box(beam * 0.29, 0.12, length * 0.075, timber, x, 0.49, z, load);
      box(beam * 0.27, 0.75, length * 0.07, timber, x, 0.93, z, load);
      for (const dx of [-beam * 0.09, beam * 0.09])
        box(0.055, 0.78, length * 0.072, steel, x + dx, 0.93, z, load);
    }
  const layout: MarineLightLayout = {
    deck: [new T.Vector3(-1.1, 3.35, aft + 1.4), new T.Vector3(1.1, 3.35, aft + 1.4)],
    targets: [new T.Vector3(-1, 0.5, 0), new T.Vector3(1, 0.5, 0)],
    cabin: new T.Vector3(0, 3.15, aft),
    cabinTarget: new T.Vector3(0, 1.8, aft),
    deckPower: 28,
    cabinPower: 5,
    specs: [
      ['port', '#ff3020', 1.5, 3.5, aft + 1],
      ['starboard', '#1cff68', -1.5, 3.5, aft + 1],
      ['masthead', '#fff4d2', 0, 5.9, aft],
      ['stern', '#fff4d2', 0, 2, -length * 0.46],
      ['trawlWhite', '#fff4d2', 0, 5.2, aft],
    ],
  };
  const lighting = createFishingLights(cream, cockpit.cabinLightMaterial, layout);
  group.add(lighting.group);
  group.userData.marineLighting = lighting;
  batch(fixed);
  for (const load of cargo.children) batch(load as T.Group);
  const setLoad = (fraction: number) => {
    cargo.visible = fraction > 0;
    cargo.children.forEach(
      (load, i) =>
        (load.visible = i < Math.ceil(T.MathUtils.clamp(fraction, 0, 1) * cargo.children.length)),
    );
  };
  group.userData.setCargoLoad = setLoad;
  return {
    group,
    cargo,
    cockpit,
    lighting,
    animate(turn: number) {
      cockpit.animate(turn);
    },
    setLoad,
  };
}
